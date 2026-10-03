// ── The village: turns hook events into dwarf behaviour ──
// Isomorphic (no Node imports): used by the bridge and by the browser demo.

import { classifyTool, ACTIVITY_BUILDING } from './classify.mjs';
import {
  migrateData, recordToolCall, recordBytes, recordBuilding,
  agentDTO, buildingDTO, statsDTO, agentLevel, pushRecent,
} from './profiles.mjs';
import { createControl, orderContextOutput, ordersNotice, stopWithOrdersOutput } from './control.mjs';
import { createTranscriptWatcher } from './transcripts.mjs';
import { createCommands } from './commands.mjs';
import { createAlerts } from './alerts.mjs';
import { createSessions } from './sessions.mjs';

export const DEFAULT_SETTINGS = {
  approvalMode: 'both',     // 'both' | 'village' | 'terminal'
  approvalWaitSec: 45,      // 'both': wait this long for the village before the terminal asks
  ordersMode: 'auto',       // 'auto': idle Claude sessions wait for village orders while the village is open | 'leash' | 'off'
  codexHold: false,         // also hold idle Codex sessions in 'auto' mode (enable once verified)
  leashWaitMin: 45,         // how long an idle dwarf waits in the village for new orders
  mainTimeoutMin: 180,      // main dwarves go home after this much silence
  subTimeoutMin: 15,
};

const MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const ASK_TOOLS = new Set(['AskUserQuestion', 'request_user_input']);

/**
 * @param {{ data?: any, settings?: any, prices?: any, now?: () => number,
 *   emit?: (msg: any) => void, onChange?: () => void, hasViewers?: () => boolean,
 *   readTranscript?: (path: string) => any[], setTimer?: Function, clearTimer?: Function }} opts
 */
export function createVillage(opts = {}) {
  const now = opts.now || (() => Date.now());
  const emit = opts.emit || (() => {});
  const changed = opts.onChange || (() => {});
  const hasViewers = opts.hasViewers || (() => false);
  const readTranscript = opts.readTranscript || (() => []);
  const readSessionMeta = opts.readSessionMeta || (() => null);
  const data = migrateData(opts.data);
  const settings = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
  let prices = opts.prices;

  /** runtime state per dwarf id */
  const rts = new Map();
  /** sessionKey → dwarf id (main) ; subKey → dwarf id */
  const bindings = new Map();
  const taskHints = new Map();
  let fellowshipShown = false;

  const control = createControl({
    now,
    setTimer: opts.setTimer || ((fn, ms) => setTimeout(fn, ms)),
    clearTimer: opts.clearTimer || ((t) => clearTimeout(t)),
    onChange: (kind, req) => {
      if (kind === 'open') emit({ type: 'request', request: req });
      else emit({ type: 'request:closed', ...req });
      const rt = rts.get(req.agentId);
      if (rt && kind === 'close' && rt.attention?.requestId === req.id) {
        rt.attention = null;
        pushAgent(req.agentId);
      }
    },
  });

  // ── helpers ────────────────────────────────────────────

  const busyIds = (exceptKey) => new Set(
    [...rts.entries()].filter(([, rt]) => rt.online && rt.bindKey !== exceptKey).map(([id]) => id),
  );

  function pushAgent(id) {
    if (data.agents[id]) emit({ type: 'agent', agent: agentDTO(data, id, rts.get(id)) });
  }

  function fx(kind, payload) {
    emit({ type: 'fx', kind, ts: now(), ...payload });
  }

  function runtime(id) {
    let rt = rts.get(id);
    if (!rt) {
      // queued orders live in the persisted data so they survive a restart
      const orders = (data.orders[id] ||= []);
      rt = { online: false, busy: false, activity: 'idle', detail: '', attention: null, leash: false, orders, lastSeen: now() };
      rts.set(id, rt);
    }
    return rt;
  }

  function setActivity(id, activity, detail = '') {
    const rt = runtime(id);
    const moved = rt.activity !== activity;
    if (!moved && rt.detail === detail) return;
    rt.activity = activity;
    rt.detail = detail;
    const building = ACTIVITY_BUILDING[activity] || 'campfire';
    if (moved) {
      const b = recordBuilding(data, building, { visitor: id, now: now() });
      emit({ type: 'building', building: b });
    }
    if (activity !== 'idle') fx('activity', { agentId: id, activity, detail });
  }

  function setAttention(id, attention) {
    const rt = runtime(id);
    rt.attention = attention ? { since: now(), ...attention } : null;
  }

  function countTool(id, activity, detail, project) {
    const prof = data.agents[id];
    const before = agentLevel(prof).level;
    recordToolCall(data, id, { activity, detail, project, now: now() });
    const building = ACTIVITY_BUILDING[activity] || 'campfire';
    const prevB = buildingDTO(data, building).level;
    const b = recordBuilding(data, building, { toolCalls: 1, now: now() });
    emit({ type: 'building', building: b });
    if (b.level > prevB) fx('building-level', { buildingId: building, level: b.level, title: b.title });
    const after = agentLevel(prof);
    if (after.level > before) fx('level', { agentId: id, name: prof.name, level: after.level, title: after.title });
    if (MILESTONES.includes(prof.toolCalls)) fx('achievement', { agentId: id, name: prof.name, text: `${prof.name} swung the hammer ${prof.toolCalls.toLocaleString('en')} times!` });
    checkFellowship();
  }

  function checkFellowship() {
    if (fellowshipShown) return;
    const busySources = new Set([...rts.entries()].filter(([, r]) => r.online && r.busy).map(([id]) => data.agents[id]?.source));
    if (busySources.has('claude') && busySources.has('codex')) {
      fellowshipShown = true;
      fx('achievement', { text: 'Fellowship of the Forge — Claude and Codex dwarves working side by side!' });
    }
  }

  const transcripts = createTranscriptWatcher({
    data, rts, now, emit, pushAgent, readTranscript, getPrices: () => prices, onLimits: setLimits,
  });

  /** Plan limits per tool (Codex: from rollouts; Claude: from the status line bridge). */
  function setLimits(source, limits) {
    data.limits[source] = { ...limits, updatedAt: now() };
    emit({ type: 'limits', limits: data.limits });
    alerts.onLimits(source, limits);
    changed();
  }
  const watchTranscript = transcripts.watch;
  const ingestFor = transcripts.ingestFor;

  const sessions = createSessions({
    data, rts, bindings, now, fx, control, pushAgent, changed, runtime, busyIds, readSessionMeta, watchTranscript,
  });
  const { bindMain, bindSub, activeCrew, goHome, dismiss } = sessions;

  const alerts = createAlerts({ data, now, fx });
  let lastBurnCheck = 0;

  const commands = createCommands({
    data, rts, settings, control, now, fx, pushAgent, setActivity, setAttention, runtime, hasViewers, changed,
  });
  const { askPermission, askQuestion, takeOrders, waitForOrders } = commands;

  // ── main entry: one hook event ─────────────────────────

  /**
   * Handle a normalized hook payload. Resolves to the JSON the hook should print (or undefined).
   * @param {Record<string, any>} p
   */
  async function handleHook(p) {
    if (!p || !p.event || !p.session_id) return undefined;
    p.source = p.source === 'codex' ? 'codex' : p.source === 'claude' ? 'claude' : String(p.source || 'custom');
    const mainId = bindMain(p);
    const isSubEvent = p.agent_id && p.event !== 'SubagentStart' && p.event !== 'SubagentStop';
    const actor = isSubEvent ? bindSub(p, mainId).id : mainId;
    const rt = runtime(actor);
    let output;

    switch (p.event) {
      case 'SessionStart':
        setActivity(mainId, 'idle', p.event_source === 'resume' ? 'back at work' : 'arriving');
        break;

      case 'UserPromptSubmit':
        // The user typed in the terminal: release a session that was waiting for village orders.
        control.cancelWhere(r => r.agentId === mainId && r.kind === 'orders', 'terminal-input');
        runtime(mainId).awaitingCrew = false;
        setAttention(mainId, null);
        runtime(mainId).busy = true;
        setActivity(mainId, 'planning', 'new orders');
        break;

      case 'PreToolUse': {
        rt.busy = true;
        if (rt.attention?.kind !== 'permission' || !rt.attention.requestId) setAttention(actor, null);
        if (ASK_TOOLS.has(p.tool_name)) {
          setActivity(actor, 'waiting', '');
          output = await askQuestion(actor, p);
          break;
        }
        const c = classifyTool(p.tool_name, p.tool_input);
        if (!c) break;
        if (c.activity === 'delegating' && c.detail) taskHints.set(mainId, c.detail);
        countTool(actor, c.activity, c.detail, p.project);
        setActivity(actor, c.activity, c.detail);
        break;
      }

      case 'PermissionRequest': {
        const c = classifyTool(p.tool_name, p.tool_input);
        setActivity(actor, 'waiting', c?.detail || p.tool_name);
        output = await askPermission(actor, p, c);
        break;
      }

      case 'PostToolUse':
      case 'PostToolUseFailure': {
        if (rt.attention && rt.attention.kind !== 'done') setAttention(actor, null);
        const inB = Number(p.input_bytes) || 0;
        const outB = Number(p.output_bytes) || 0;
        if (inB || outB) {
          recordBytes(data, actor, inB, outB, now());
          const b = recordBuilding(data, ACTIVITY_BUILDING[rt.activity] || 'campfire', { inBytes: inB, outBytes: outB, now: now() });
          emit({ type: 'building', building: b });
        }
        if (rt.activity === 'waiting') setActivity(actor, 'coding', rt.detail);
        if (p.event === 'PostToolUseFailure') {
          rt.failure = { text: String(p.error || 'tool failed').slice(0, 80), at: now() };
          fx('failure', { agentId: actor, text: `${p.tool_name}: ${rt.failure.text}` });
          setActivity(actor, 'debugging', p.tool_name);
        }
        ingestFor(actor, false);
        const orders = takeOrders(actor);
        if (orders) output = orderContextOutput('PostToolUse', orders);
        if (orders) output.systemMessage = ordersNotice(orders);
        break;
      }

      case 'Notification':
        if (runtime(mainId).headless) break;
        if (p.notification_type === 'idle_prompt' && !rt.attention) {
          setAttention(mainId, { kind: 'done', text: 'waiting for your next task' });
          setActivity(mainId, 'waiting', '');
        } else if (p.notification_type === 'permission_prompt' && !rt.attention) {
          setAttention(mainId, { kind: 'permission', text: p.message || 'needs permission', terminal: true });
          setActivity(mainId, 'waiting', '');
        }
        break;

      case 'PreCompact':
        setActivity(mainId, 'remembering', 'organizing thoughts');
        break;

      case 'PostCompact':
        setActivity(mainId, 'planning', 'thoughts organized');
        break;

      case 'SubagentStart': {
        const sub = bindSub(p, mainId);
        setActivity(sub.id, 'planning', taskHints.get(mainId) || p.agent_type || 'new errand');
        pushRecent(data.agents[sub.id], 'planning', taskHints.get(mainId) || '', now());
        taskHints.delete(mainId);
        pushAgent(sub.id);
        break;
      }

      case 'SubagentStop': {
        const key = `${p.source}:${p.session_id}:${p.agent_id}`;
        const subId = bindings.get(key);
        if (subId) {
          if (p.agent_transcript_path) watchTranscript(p.agent_transcript_path, subId);
          ingestFor(subId, true);
          goHome(subId, 'errand done');
          bindings.delete(key);
        }
        // The parent finished its turn earlier and only waited for this crew — now it waits for you.
        const prt = runtime(mainId);
        if (prt.awaitingCrew && !prt.busy && activeCrew(p) === 0) {
          prt.awaitingCrew = false;
          setAttention(mainId, { kind: 'done', text: 'done — waiting for your reply' });
          setActivity(mainId, 'waiting', '');
        }
        break;
      }

      case 'Stop': {
        ingestFor(mainId, true);
        const mrt = runtime(mainId);
        mrt.busy = false;
        if (mrt.headless) {
          // automation finished its job: no waiting, no inbox — the dwarf just goes home
          goHome(mainId, 'finished its job');
          for (const [k, v] of [...bindings]) if (v === mainId) bindings.delete(k);
          break;
        }
        let orders = takeOrders(mainId);
        // Holding the Stop hook doesn't block the terminal (verified: typing there is accepted
        // immediately), so idle Claude sessions wait in the village where orders can reach them.
        const holdable = p.source === 'claude' || (p.source === 'codex' && settings.codexHold);
        const autoHold = settings.ordersMode === 'auto' && holdable && hasViewers();
        const hold = settings.ordersMode !== 'off' && (mrt.leash || autoHold) && activeCrew(p) === 0;
        if (!orders && hold) {
          setAttention(mainId, { kind: 'done', text: 'waiting for orders in the village', leashed: true });
          setActivity(mainId, 'waiting', '');
          pushAgent(mainId);
          orders = await waitForOrders(mainId, p);
        }
        const crew = activeCrew(p);
        if (orders) {
          setAttention(mainId, null);
          mrt.busy = true;
          setActivity(mainId, 'planning', 'new orders');
          output = stopWithOrdersOutput(orders, p.source);
        } else if (crew > 0) {
          // Background sub-agents are still working: the dwarf waits for its crew, not for you.
          mrt.awaitingCrew = true;
          setAttention(mainId, null);
          setActivity(mainId, 'delegating', `waiting for ${crew} helper${crew > 1 ? 's' : ''}`);
        } else {
          setAttention(mainId, { kind: 'done', text: 'done — waiting for your reply' });
          setActivity(mainId, 'waiting', '');
        }
        break;
      }

      case 'Interrupt':
        runtime(mainId).busy = false;
        setActivity(mainId, 'idle', 'interrupted');
        break;

      case 'SessionEnd': {
        ingestFor(mainId, true);
        const key = `${p.source}:${p.session_id}`;
        control.cancelWhere(r => r.sessionKey === key, 'session-ended');
        for (const [k, id] of [...bindings]) {
          if (k === key || k.startsWith(key + ':')) { goHome(id, 'went home'); bindings.delete(k); }
        }
        break;
      }

      default:
        break;
    }

    if (data.agents[actor]) pushAgent(actor);
    if (actor !== mainId) pushAgent(mainId);
    changed();
    return output;
  }

  /** Legacy/simple API: { agent, activity, detail, project }. */
  function handleHeartbeat(body) {
    const name = String(body.agent || 'Agent');
    const p = { source: 'custom', event: 'PreToolUse', session_id: name, project: body.project || '' };
    const id = bindMain(p);
    const activity = ACTIVITY_BUILDING[body.activity] ? body.activity : 'coding';
    if (activity === 'idle') setActivity(id, 'idle', body.detail || '');
    else { countTool(id, activity, body.detail || '', p.project); setActivity(id, activity, body.detail || ''); }
    runtime(id).busy = activity !== 'idle';
    pushAgent(id);
    changed();
    return id;
  }

  /** Periodic housekeeping: send silent dwarves home. */
  function tick() {
    const t = now();
    if (t - lastBurnCheck > 60_000) { lastBurnCheck = t; alerts.checkBurn(); }
    for (const [id, rt] of rts) {
      if (!rt.online) continue;
      const limit = (data.agents[id]?.kind === 'sub' ? settings.subTimeoutMin : settings.mainTimeoutMin) * 60_000;
      if (t - rt.lastSeen > limit && !control.forAgent(id).length) {
        goHome(id, 'fell asleep');
        for (const [k, v] of [...bindings]) if (v === id) bindings.delete(k);
      }
      if (rt.failure && t - rt.failure.at > 6000) { rt.failure = null; pushAgent(id); }
    }
  }

  function snapshot() {
    return {
      type: 'snapshot',
      agents: Object.keys(data.agents).map(id => agentDTO(data, id, rts.get(id))),
      buildings: Object.keys(ACTIVITY_BUILDING).map(a => ACTIVITY_BUILDING[a])
        .concat(['tavern'])
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .map(id => buildingDTO(data, id)),
      requests: control.list(),
      stats: statsDTO(data, now()),
      settings: { ...settings },
    };
  }

  function updateSettings(patch) {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (patch && patch[k] !== undefined) settings[k] = patch[k];
    }
    emit({ type: 'settings', settings: { ...settings } });
    return { ...settings };
  }

  return {
    data,
    settings,
    handleHook,
    handleHeartbeat,
    tick,
    respond: commands.respond,
    sendOrder: commands.sendOrder,
    setLeash: commands.setLeash,
    dismiss,
    snapshot,
    updateSettings,
    setPrices: (p) => { prices = p; },
    setLimits,
    stats: () => statsDTO(data, now()),
    status: () => ({
      online: [...rts.entries()].filter(([, r]) => r.online).map(([id]) => agentDTO(data, id, rts.get(id))),
      requests: control.list(),
    }),
    leaderboard: () => Object.keys(data.agents).map(id => agentDTO(data, id, rts.get(id))).sort((a, b) => b.xp - a.xp).slice(0, 50),
  };
}
