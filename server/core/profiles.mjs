// ── Persistent profiles & statistics ─────────────────────
// Operates on a plain data object { agents, buildings, stats } so the same
// code runs in the Node bridge (persisted to disk) and in the browser demo.

import { agentXP, buildingXP, levelInfo, AGENT_LEVELS, buildingLevelTable } from './levels.mjs';
import { costOf, tokensOf, modelLabel } from './pricing.mjs';
import { addUsage } from './usage.mjs';
import { profileKind, profileSource } from './roster.mjs';

const MAX_RECENT = 30;

/**
 * @typedef {Record<string, any>} Bag
 * @typedef {{ version: number, agents: Bag, buildings: Bag, cursors: Bag, limits: Bag,
 *   stats: { daily: Bag, hourly: Bag, projects: Bag, models: Bag } }} VillageData
 */

/** @returns {VillageData} */
export function emptyData() {
  return { version: 2, agents: {}, buildings: {}, cursors: {}, limits: {}, stats: { daily: {}, hourly: {}, projects: {}, models: {} } };
}

/** Upgrade legacy (v1) data in place. */
export function migrateData(data) {
  const d = data && typeof data === 'object' ? data : {};
  d.agents ||= {};
  d.buildings ||= {};
  d.cursors ||= {};
  d.stats ||= {};
  d.limits ||= {};
  d.stats.daily ||= {};
  d.stats.hourly ||= {};
  d.stats.projects ||= {};
  d.stats.models ||= {};
  for (const p of Object.values(d.agents)) {
    p.source ||= 'claude';
    p.kind ||= p.parentId ? 'sub' : 'main';
    p.usage ||= {};
    p.cost ||= 0;
    p.tokens ||= 0;
    p.activityCounts ||= {};
    p.recentActivity ||= [];
    if (p.totalBytes) {
      p.totalInputBytes = (p.totalInputBytes || 0) + Math.ceil(p.totalBytes / 2);
      p.totalOutputBytes = (p.totalOutputBytes || 0) + Math.floor(p.totalBytes / 2);
      delete p.totalBytes;
    }
  }
  d.version = 2;
  return d;
}

/**
 * @param {VillageData} data
 * @param {string} id
 * @param {{ name: string, source: string, kind: string, clan?: string|null, parentId?: string|null, agentType?: string|null, now: number }} opts
 */
export function createProfile(data, id, { name, source, kind, clan, parentId, agentType, now }) {
  data.agents[id] = {
    name, source, kind,
    clan: clan || null,
    parentId: parentId || null,
    agentType: agentType || null,
    toolCalls: 0,
    totalInputBytes: 0,
    totalOutputBytes: 0,
    sessions: 0,
    subAgentsSpawned: 0,
    firstSeen: now,
    lastSeen: now,
    recentActivity: [],
    activityCounts: {},
    usage: {},
    cost: 0,
    tokens: 0,
  };
  return data.agents[id];
}

export function hourKey(ts) {
  return Math.floor(ts / 3_600_000);
}

const HOURLY_KEEP = 24 * 8;

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bucket(obj, key) {
  return (obj[key] ||= { cost: 0, tokens: 0, toolCalls: 0 });
}

/** Record a tool call for an agent + global statistics. */
export function recordToolCall(data, id, { activity, detail, project, now }) {
  const p = data.agents[id];
  if (!p) return;
  p.toolCalls++;
  p.lastSeen = now;
  p.activityCounts[activity] = (p.activityCounts[activity] || 0) + 1;
  const source = profileSource(p);
  bucket(data.stats.daily[dayKey(now)] ||= {}, source).toolCalls++;
  if (project) bucket(data.stats.projects[project] ||= {}, source).toolCalls++;
  pushRecent(p, activity, detail, now);
}

export function pushRecent(p, activity, detail, now) {
  const last = p.recentActivity[p.recentActivity.length - 1];
  if (last && last.activity === activity && last.detail === detail) return;
  p.recentActivity.push({ activity, detail, timestamp: now });
  if (p.recentActivity.length > MAX_RECENT) p.recentActivity.splice(0, p.recentActivity.length - MAX_RECENT);
}

export function recordBytes(data, id, inBytes, outBytes, now) {
  const p = data.agents[id];
  if (!p) return;
  p.totalInputBytes += inBytes;
  p.totalOutputBytes += outBytes;
  p.lastSeen = now;
}

/** Record model usage (tokens + cost) for an agent. Returns the cost added. */
export function recordUsage(data, id, { model, usage, project, now, prices }) {
  const p = data.agents[id];
  if (!p) return 0;
  const source = profileSource(p);
  const cost = costOf(usage, model, source, prices);
  const tokens = tokensOf(usage);
  const m = (p.usage[model] ||= { cost: 0 });
  addUsage(m, usage);
  m.cost += cost;
  p.cost += cost;
  p.tokens += tokens;
  const day = bucket(data.stats.daily[dayKey(now)] ||= {}, source);
  day.cost += cost; day.tokens += tokens;
  const hour = bucket(data.stats.hourly[hourKey(now)] ||= {}, source);
  hour.cost += cost; hour.tokens += tokens;
  pruneHourly(data, now);
  if (project) {
    const pr = bucket(data.stats.projects[project] ||= {}, source);
    pr.cost += cost; pr.tokens += tokens;
  }
  const gm = (data.stats.models[model] ||= { source, cost: 0, tokens: 0 });
  addUsage(gm, usage);
  gm.cost += cost; gm.tokens += tokens;
  return cost;
}

function pruneHourly(data, now) {
  const min = hourKey(now) - HOURLY_KEEP;
  for (const k of Object.keys(data.stats.hourly)) if (Number(k) < min) delete data.stats.hourly[k];
}

/** Burn rate: last 24 hours by hour, totals per source, and the current pace. */
export function burnDTO(data, now) {
  const current = hourKey(now);
  const hours = [];
  const last24 = { cost: 0, tokens: 0, bySource: {} };
  for (let h = current - 23; h <= current; h++) {
    const b = data.stats.hourly[h] || {};
    const entry = { hour: h * 3_600_000, cost: 0, tokens: 0, bySource: {} };
    for (const [source, v] of Object.entries(b)) {
      entry.cost += v.cost; entry.tokens += v.tokens;
      entry.bySource[source] = v.cost;
      const s = (last24.bySource[source] ||= { cost: 0, tokens: 0 });
      s.cost += v.cost; s.tokens += v.tokens;
    }
    last24.cost += entry.cost; last24.tokens += entry.tokens;
    hours.push(entry);
  }
  // Pace: blend the running hour (scaled by elapsed minutes) with the previous one.
  const elapsed = Math.max(0.1, (now % 3_600_000) / 3_600_000);
  const prev = hours[hours.length - 2]?.cost || 0;
  const cur = hours[hours.length - 1]?.cost || 0;
  const perHour = (prev * (1 - elapsed) + cur) / 1;
  return { hours, last24, perHour, projected24h: perHour * 24 };
}

export function recordBuilding(data, buildingId, { toolCalls = 0, inBytes = 0, outBytes = 0, visitor, now }) {
  const b = (data.buildings[buildingId] ||= {
    toolCalls: 0, totalInputBytes: 0, totalOutputBytes: 0, uniqueVisitors: [], totalVisits: 0,
    firstActivity: now, lastActivity: now,
  });
  b.toolCalls += toolCalls;
  b.totalInputBytes += inBytes;
  b.totalOutputBytes += outBytes;
  if (visitor) {
    b.totalVisits = (b.totalVisits || 0) + 1;
    if (!b.uniqueVisitors.includes(visitor)) b.uniqueVisitors.push(visitor);
  }
  b.lastActivity = now;
  return buildingDTO(data, buildingId);
}

export function agentLevel(p) {
  return levelInfo(agentXP(p), AGENT_LEVELS);
}

export function buildingDTO(data, id) {
  const b = data.buildings[id] || { toolCalls: 0, totalInputBytes: 0, totalOutputBytes: 0, uniqueVisitors: [], totalVisits: 0 };
  const xp = buildingXP(b);
  return {
    id,
    xp,
    ...levelInfo(xp, buildingLevelTable(id)),
    toolCalls: b.toolCalls,
    visitors: (b.uniqueVisitors || []).length,
    visits: b.totalVisits || 0,
    lastActivity: b.lastActivity || null,
  };
}

/** Public shape of a dwarf (persisted profile + live runtime state). */
export function agentDTO(data, id, rt) {
  const p = data.agents[id];
  const xp = agentXP(p);
  const models = Object.entries(p.usage || {}).sort((a, b) => b[1].cost - a[1].cost);
  const model = rt?.model || models[0]?.[0] || null;
  return {
    id,
    name: p.name,
    source: profileSource(p),
    kind: profileKind(p),
    parentId: rt?.parentId ?? p.parentId ?? null,
    agentType: p.agentType || null,
    project: rt?.project || p.clan || null,
    model,
    modelLabel: model ? modelLabel(model) : null,
    online: !!rt?.online,
    busy: !!rt?.busy,
    activity: rt?.online ? rt.activity : 'idle',
    detail: rt?.online ? rt.detail : '',
    attention: rt?.attention || null,
    leash: !!rt?.leash,
    orders: rt?.orders?.length || 0,
    failure: rt?.failure || null,
    xp,
    ...levelInfo(xp, AGENT_LEVELS),
    toolCalls: p.toolCalls,
    sessions: p.sessions,
    subAgentsSpawned: p.subAgentsSpawned || 0,
    cost: p.cost || 0,
    tokens: p.tokens || 0,
    bytesIn: p.totalInputBytes || 0,
    bytesOut: p.totalOutputBytes || 0,
    models: models.map(([m, u]) => ({ model: m, label: modelLabel(m), cost: u.cost, tokens: tokensOf(u) })),
    activityCounts: p.activityCounts || {},
    recentActivity: p.recentActivity || [],
    firstSeen: p.firstSeen,
    lastSeen: rt?.lastSeen || p.lastSeen,
  };
}

/** Aggregate statistics for the stats panel. */
export function statsDTO(data, now) {
  const bySource = { claude: { cost: 0, tokens: 0, toolCalls: 0, dwarves: 0 }, codex: { cost: 0, tokens: 0, toolCalls: 0, dwarves: 0 } };
  for (const p of Object.values(data.agents)) {
    const s = (bySource[profileSource(p)] ||= { cost: 0, tokens: 0, toolCalls: 0, dwarves: 0 });
    s.cost += p.cost || 0;
    s.tokens += p.tokens || 0;
    s.toolCalls += p.toolCalls || 0;
    s.dwarves++;
  }
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const key = dayKey(now - i * 86_400_000);
    days.push({ day: key, ...(data.stats.daily[key] || {}) });
  }
  const projects = Object.entries(data.stats.projects)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => total(b) - total(a))
    .slice(0, 12);
  const models = Object.entries(data.stats.models)
    .map(([model, v]) => ({ model, label: modelLabel(model), source: v.source, cost: v.cost, tokens: v.tokens }))
    .sort((a, b) => b.cost - a.cost);
  return {
    bySource, days, projects, models,
    today: data.stats.daily[dayKey(now)] || {},
    burn: burnDTO(data, now),
    limits: data.limits || {},
  };
}

function total(v) {
  return Object.values(v).reduce((sum, s) => sum + (typeof s === 'object' ? s.cost || 0 : 0), 0);
}
