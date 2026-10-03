// ── Sessions ↔ dwarves: binding, automation detection, going home ──
// Split out of village.mjs; shares the village's runtime state through ctx.

import { claimMain, claimSub } from './roster.mjs';
import { createProfile } from './profiles.mjs';

/**
 * @param {{ data: any, rts: Map<string, any>, bindings: Map<string, string>, now: () => number,
 *   fx: Function, control: any, pushAgent: Function, changed: Function, runtime: Function,
 *   busyIds: (exceptKey: string) => Set<string>, readSessionMeta: Function, watchTranscript: Function }} ctx
 */
export function createSessions(ctx) {
  const { data, rts, bindings, now, fx, control, pushAgent, changed, runtime, busyIds, readSessionMeta, watchTranscript } = ctx;

  function wake(id, rt, extra) {
    Object.assign(rt, extra);
    rt.lastSeen = now();
    if (!rt.online) {
      rt.online = true;
      rt.activity = 'idle';
      rt.detail = '';
      data.agents[id].sessions++;
      fx('spawn', { agentId: id, name: data.agents[id].name, source: data.agents[id].source, parentId: rt.parentId || null });
    }
  }

  function bindMain(p) {
    const key = `${p.source}:${p.session_id}`;
    let id = bindings.get(key);
    if (!id || (rts.get(id)?.online && rts.get(id).bindKey !== key)) {
      const project = p.project;
      const claim = claimMain(data.agents, busyIds(key), { source: p.source, project, seed: key });
      id = claim.id;
      if (claim.isNew) createProfile(data, id, { name: claim.name, source: p.source, kind: 'main', clan: project, now: now() });
      bindings.set(key, id);
    }
    const prof = data.agents[id];
    if (p.project) prof.clan = p.project;
    prof.lastSeen = now();
    const rt = runtime(id);
    wake(id, rt, { bindKey: key, project: p.project || prof.clan, source: p.source, parentId: null });
    if (p.model) rt.model = p.model;
    if (p.transcript_path) watchTranscript(p.transcript_path, id);
    if (rt.headless === undefined || p.entrypoint) rt.headless = isAutomation(p);
    return id;
  }

  /** claude -p / Agent SDK / codex exec: nobody is waiting at a keyboard. */
  function isAutomation(p) {
    if (p.entrypoint) return /^sdk/.test(p.entrypoint);
    if (p.source === 'codex' && p.transcript_path) {
      const meta = readSessionMeta(p.transcript_path);
      return !!meta && (meta.originator === 'codex_exec' || meta.source === 'exec');
    }
    return false;
  }

  function bindSub(p, mainId) {
    const key = `${p.source}:${p.session_id}:${p.agent_id}`;
    let id = bindings.get(key);
    let spawned = false;
    if (!id) {
      const claim = claimSub(data.agents, busyIds(key), { source: p.source, project: p.project, agentType: p.agent_type, seed: key });
      id = claim.id;
      if (claim.isNew) {
        createProfile(data, id, { name: claim.name, source: p.source, kind: 'sub', clan: p.project, parentId: mainId, agentType: p.agent_type, now: now() });
      }
      bindings.set(key, id);
      data.agents[mainId].subAgentsSpawned = (data.agents[mainId].subAgentsSpawned || 0) + 1;
      spawned = true;
    }
    const prof = data.agents[id];
    prof.parentId = mainId;
    if (p.agent_type) prof.agentType = p.agent_type;
    if (p.project) prof.clan = p.project;
    const rt = runtime(id);
    wake(id, rt, { bindKey: key, project: p.project, source: p.source, parentId: mainId });
    if (p.source === 'claude' && p.transcript_path) {
      const dir = p.transcript_path.replace(/\.jsonl$/, '');
      watchTranscript(p.agent_transcript_path || `${dir}/subagents/agent-${p.agent_id}.jsonl`, id);
    } else if (p.transcript_path && p.source !== 'claude') {
      watchTranscript(p.transcript_path, id);
    }
    return { id, spawned };
  }

  /** Sub-agents of this session that are still out working. */
  function activeCrew(p) {
    const prefix = `${p.source}:${p.session_id}:`;
    let n = 0;
    for (const [k, id] of bindings) if (k.startsWith(prefix) && rts.get(id)?.online) n++;
    return n;
  }

  function goHome(id, why) {
    const rt = rts.get(id);
    if (!rt?.online) return;
    rt.online = false;
    rt.busy = false;
    rt.attention = null;
    rt.leash = false;
    rt.activity = 'idle';
    rt.detail = '';
    rt.bindKey = null;
    control.cancelWhere(r => r.agentId === id, 'went-home');
    fx('despawn', { agentId: id, name: data.agents[id]?.name, text: why });
    pushAgent(id);
  }

  /** User says this dwarf isn't really waiting (closed terminal etc.): send it home. */
  function dismiss(agentId) {
    if (!rts.get(agentId)?.online) return false;
    goHome(agentId, 'was sent home');
    for (const [k, v] of [...bindings]) if (v === agentId) bindings.delete(k);
    changed();
    return true;
  }


  return { bindMain, bindSub, activeCrew, goHome, dismiss };
}
