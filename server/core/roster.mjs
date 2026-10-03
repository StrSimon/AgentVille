// ── Resident roster ──────────────────────────────────────
// Sessions borrow a persistent dwarf from the village so XP accumulates.
// A new session prefers a free dwarf of the same tool (Claude/Codex) that
// already belongs to the project's clan; otherwise a new dwarf moves in.

import { dwarfName, hashStr } from './names.mjs';

export function profileSource(p) {
  return p.source || 'claude';
}

export function profileKind(p) {
  return p.kind || (p.parentId ? 'sub' : 'main');
}

function takenNames(agents) {
  return new Set(Object.values(agents).map(p => p.name));
}

function newId(prefix, seed, agents) {
  let id = `${prefix}-${hashStr(seed).toString(36).slice(0, 6)}`;
  let n = 1;
  while (agents[id]) id = `${prefix}-${hashStr(seed + n++).toString(36).slice(0, 6)}`;
  return id;
}

function pick(candidates, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const [id, p] of candidates) {
    const s = score(p) * 1e13 + (p.lastSeen || 0);
    if (s > bestScore) { best = id; bestScore = s; }
  }
  return best;
}

/**
 * Claim a main dwarf for a new session.
 * @param {Record<string, any>} agents persisted profiles
 * @param {Set<string>} busy ids currently bound to a live session
 * @returns {{ id: string, isNew: boolean, name: string }}
 */
export function claimMain(agents, busy, { source, project, seed }) {
  const free = Object.entries(agents).filter(([id, p]) =>
    !busy.has(id) && profileKind(p) === 'main' && profileSource(p) === source);
  const sameClan = free.filter(([, p]) => p.clan && p.clan === project);
  const clanless = free.filter(([, p]) => !p.clan);
  const id = pick(sameClan, () => 1) ?? pick(clanless, () => 1);
  if (id) return { id, isNew: false, name: agents[id].name };
  const fresh = newId(source, seed, agents);
  return { id: fresh, isNew: true, name: dwarfName(fresh, takenNames(agents)) };
}

/**
 * Claim a sub-agent dwarf. Prefers the same specialty (agent type) in the same project.
 * @returns {{ id: string, isNew: boolean, name: string }}
 */
export function claimSub(agents, busy, { source, project, agentType, seed }) {
  const free = Object.entries(agents).filter(([id, p]) =>
    !busy.has(id) && profileKind(p) === 'sub' && profileSource(p) === source);
  const sameType = free.filter(([, p]) => (p.agentType || '') === (agentType || '') && (!p.clan || p.clan === project));
  const sameClan = free.filter(([, p]) => p.clan === project);
  const id = pick(sameType, p => (p.clan === project ? 1 : 0)) ?? pick(sameClan, () => 1);
  if (id) return { id, isNew: false, name: agents[id].name };
  const fresh = newId('sub', seed, agents);
  return { id: fresh, isNew: true, name: dwarfName(fresh, takenNames(agents)) };
}
