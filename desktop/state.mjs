// ── Desktop-side mirror of the village ───────────────────
// Folds bridge events (snapshot, agent, request, request:closed) into a small
// model so the tray, dock badge and notifications can react to changes.
// Pure — no Electron imports, so it can be unit tested with node --test.

/**
 * @typedef {{ id: string, name?: string, online?: boolean, busy?: boolean,
 *   attention?: { kind: string } | null }} AgentLite
 * @typedef {{ id: string, agentId: string, kind: string }} RequestLite
 * @typedef {{ opened?: RequestLite, closedId?: string, done?: AgentLite }} Effects
 */

export function createTracker() {
  /** @type {Map<string, AgentLite>} */
  const agents = new Map();
  /** @type {Map<string, RequestLite>} */
  const requests = new Map();

  /** Apply one bridge event; returns what changed that is worth notifying about. */
  function apply(msg) {
    /** @type {Effects} */
    const fx = {};
    if (!msg || typeof msg !== 'object') return fx;
    switch (msg.type) {
      case 'snapshot':
        agents.clear();
        requests.clear();
        for (const a of msg.agents || []) agents.set(a.id, a);
        for (const r of msg.requests || []) requests.set(r.id, r);
        break;
      case 'agent': {
        const next = msg.agent;
        if (!next?.id) break;
        const prev = agents.get(next.id);
        agents.set(next.id, next);
        if (next.online && next.attention?.kind === 'done' && prev?.attention?.kind !== 'done') fx.done = next;
        break;
      }
      case 'request':
        if (msg.request?.id && !requests.has(msg.request.id)) {
          requests.set(msg.request.id, msg.request);
          fx.opened = msg.request;
        }
        break;
      case 'request:closed':
        if (msg.id && requests.delete(msg.id)) fx.closedId = msg.id;
        break;
      default:
        break;
    }
    return fx;
  }

  /** Online dwarves, how many are busy, and how many need the user. */
  function counts() {
    const needing = new Set([...requests.values()].map(r => r.agentId));
    let online = 0;
    let working = 0;
    for (const a of agents.values()) {
      if (!a.online) continue;
      online++;
      if (a.attention) needing.add(a.id);
      else if (a.busy) working++;
    }
    return { online, working, attention: needing.size };
  }

  return { apply, counts, agent: (id) => agents.get(id) };
}

/** Human status line for the tray menu, e.g. "3 working · 1 needs you". */
export function statusLine({ online, working, attention }) {
  const parts = [];
  if (working) parts.push(`${working} working`);
  if (attention) parts.push(`${attention} ${attention === 1 ? 'needs' : 'need'} you`);
  if (!parts.length && online) parts.push(`${online} idle`);
  return parts.length ? parts.join(' · ') : 'The village is quiet';
}
