// ── Native notifications for dwarves that need you ──────
// Permission requests get Allow/Deny buttons on macOS, so you can approve a
// tool call without switching to the village. Clicking any notification
// brings the window to the front.

import { Notification } from 'electron';

const DONE_COOLDOWN_MS = 2 * 60_000;
const clip = (s, n = 180) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * @param {{ isWindowFocused: () => boolean, showWindow: () => void,
 *   respond: (id: string, answer: { decision: 'allow'|'deny' }) => Promise<unknown> }} deps
 */
export function createNotifier({ isWindowFocused, showWindow, respond }) {
  /** requestId → Notification (kept referenced so it isn't garbage-collected) */
  const open = new Map();
  /** agentId → last "done" notification time */
  const lastDone = new Map();
  const supported = Notification.isSupported();

  function show(key, options, onAction) {
    if (!supported || isWindowFocused()) return null;
    const n = new Notification({ silent: false, ...options });
    n.on('click', () => { showWindow(); forget(key); });
    n.on('close', () => forget(key));
    if (onAction) n.on('action', (_e, index) => { onAction(index); forget(key); });
    open.set(key, n);
    n.show();
    return n;
  }

  function forget(key) {
    open.delete(key);
  }

  /** A permission or question request was opened by a dwarf. */
  function requestOpened(req) {
    if (req.kind !== 'permission' && req.kind !== 'question') return;
    const what = req.kind === 'question'
      ? req.detail || 'has a question'
      : [req.tool, req.command || req.detail].filter(Boolean).join(': ');
    const body = clip([what, req.project && `· ${req.project}`].filter(Boolean).join(' '));
    const canAnswer = req.kind === 'permission' && process.platform === 'darwin';
    show(req.id, {
      title: `${req.name || 'A dwarf'} needs you`,
      body,
      actions: canAnswer ? [{ type: 'button', text: 'Allow' }, { type: 'button', text: 'Deny' }] : [],
      closeButtonText: canAnswer ? 'Later' : undefined,
    }, canAnswer ? (index) => {
      respond(req.id, { decision: index === 0 ? 'allow' : 'deny' }).catch(() => {});
    } : null);
  }

  /** The request was answered elsewhere (village, terminal, timeout). */
  function requestClosed(id) {
    const n = open.get(id);
    if (n) { n.close(); forget(id); }
  }

  /** A dwarf finished its turn and waits for your reply. */
  function agentDone(agent) {
    const t = Date.now();
    if (t - (lastDone.get(agent.id) || 0) < DONE_COOLDOWN_MS) return;
    if (show(`done:${agent.id}`, {
      title: `${agent.name || 'A dwarf'} is done`,
      body: clip([agent.attention?.text || 'Waiting for your next task', agent.project && `· ${agent.project}`].filter(Boolean).join(' ')),
    })) lastDone.set(agent.id, t);
  }

  /** Limits getting tight or an unusual burn rate. */
  function warning(fx) {
    show(`warn:${fx.ts}`, {
      title: fx.severity === 'critical' ? '⛈ AgentVille: limit almost reached' : '🌧 AgentVille warning',
      body: clip(fx.text || ''),
    });
  }

  return { requestOpened, requestClosed, agentDone, warning };
}
