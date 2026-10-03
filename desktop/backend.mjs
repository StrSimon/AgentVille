// ── Backend: in-process bridge, or an AgentVille that already runs ──
// The app prefers its own in-process server. If `npx agentville` is already
// serving the port, the app attaches to it instead: it follows the SSE stream
// for tray/notifications and answers requests through the token-protected API.

import { startServer, loadToken } from '../server/http.mjs';
import { paths } from '../server/store.mjs';

const RECONNECT_MS = 3000;

/** Probe the port: returns the health payload if AgentVille answers there. */
export async function probe(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) });
    const json = await res.json();
    return json?.name === 'agentville' ? json : null;
  } catch {
    return null;
  }
}

/** Start the bridge in this process. `onEvent` receives the initial snapshot too. */
async function startLocal({ port, onEvent }) {
  const srv = await startServer({ port, quiet: true, hasViewers: () => true, onEvent });
  onEvent(srv.village.snapshot());
  return {
    mode: 'local',
    url: srv.url,
    respond: async (id, answer) => srv.village.respond(id, answer),
    close: () => srv.close(),
  };
}

/** Follow `/events` of a running bridge; resolves when the stream ends. */
async function followEvents(port, onEvent, signal) {
  const res = await fetch(`http://127.0.0.1:${port}/events`, { signal });
  if (!res.ok || !res.body) throw new Error(`events: HTTP ${res.status}`);
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const data = frame.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
      if (!data) continue; // keepalive comment
      try { onEvent(JSON.parse(data)); } catch { /* ignore malformed frame */ }
    }
  }
}

/** Attach to an AgentVille that is already running (e.g. the CLI). */
function attachRemote({ port, onEvent, onLost }) {
  const abort = new AbortController();
  const token = loadToken(paths().home);
  let closed = false;

  (async () => {
    while (!closed) {
      try { await followEvents(port, onEvent, abort.signal); } catch { /* retry below */ }
      if (closed) return;
      await new Promise(r => setTimeout(r, RECONNECT_MS));
      // The other instance went away — let the app take over the port.
      if (!closed && !(await probe(port))) { closed = true; onLost(); return; }
    }
  })();

  return {
    mode: 'remote',
    url: `http://localhost:${port}`,
    respond: async (id, answer) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/requests/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-agentville-token': token },
        body: JSON.stringify(answer || { release: true }),
      });
      return res.ok && (await res.json()).ok === true;
    },
    close: async () => { closed = true; abort.abort(); },
  };
}

/**
 * Connect to a village on `port`: reuse a running AgentVille, else start one.
 * `onSwitch(backend)` fires when a remote instance disappears and the app
 * takes over with its own server.
 * Throws `{ code: 'EADDRINUSE' }` if something else holds the port.
 */
export async function connectBackend({ port, onEvent, onSwitch }) {
  const tryLocal = async () => {
    try {
      return await startLocal({ port, onEvent });
    } catch (err) {
      // Lost a race with another AgentVille starting up — attach to it instead.
      if (err?.code === 'EADDRINUSE' && (await probe(port))) return remote();
      throw err;
    }
  };
  const remote = () => attachRemote({
    port,
    onEvent,
    onLost: () => tryLocal().then(onSwitch, (err) => onSwitch(null, err)),
  });
  return (await probe(port)) ? remote() : tryLocal();
}
