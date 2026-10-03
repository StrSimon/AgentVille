// ── Level tables & XP formulas (agents + buildings) ──────

export const AGENT_LEVELS = [
  { level: 1,  title: 'Apprentice',    minXP: 0 },
  { level: 2,  title: 'Journeyman',    minXP: 50 },
  { level: 3,  title: 'Craftsman',     minXP: 200 },
  { level: 4,  title: 'Smith',         minXP: 500 },
  { level: 5,  title: 'Master',        minXP: 1200 },
  { level: 6,  title: 'Grand Master',  minXP: 3000 },
  { level: 7,  title: 'Rune Master',   minXP: 7000 },
  { level: 8,  title: 'Legendary',     minXP: 15000 },
  { level: 9,  title: 'Mythical',      minXP: 30000 },
  { level: 10, title: 'Divine',        minXP: 60000 },
];

export const BUILDING_LEVELS = [
  { level: 1,  title: 'Outpost',        minXP: 0 },
  { level: 2,  title: 'Workshop',       minXP: 100 },
  { level: 3,  title: 'Hall',           minXP: 500 },
  { level: 4,  title: 'Stronghold',     minXP: 1500 },
  { level: 5,  title: 'Citadel',        minXP: 4000 },
  { level: 6,  title: 'Great Hall',     minXP: 10000 },
  { level: 7,  title: 'Grand Fortress', minXP: 25000 },
  { level: 8,  title: 'Ancient Keep',   minXP: 60000 },
  { level: 9,  title: 'Mythic Bastion', minXP: 140000 },
  { level: 10, title: 'Eternal Nexus',  minXP: 300000 },
];

export const CAMPFIRE_LEVELS = [
  { level: 1,  title: 'Campsite',         minXP: 0 },
  { level: 2,  title: 'Gathering',        minXP: 100 },
  { level: 3,  title: 'Meeting Place',    minXP: 500 },
  { level: 4,  title: 'Town Square',      minXP: 1500 },
  { level: 5,  title: 'Trading Post',     minXP: 4000 },
  { level: 6,  title: 'Hub',              minXP: 10000 },
  { level: 7,  title: 'Grand Plaza',      minXP: 25000 },
  { level: 8,  title: 'Cultural Center',  minXP: 60000 },
  { level: 9,  title: 'Sacred Circle',    minXP: 140000 },
  { level: 10, title: 'Heart of Village', minXP: 300000 },
];

/** Resolve level info for an XP value from a level table. */
export function levelInfo(xp, table = AGENT_LEVELS) {
  let current = table[0];
  let next = null;
  for (const lvl of table) {
    if (xp >= lvl.minXP) current = lvl;
    else { next = lvl; break; }
  }
  return {
    level: current.level,
    title: current.title,
    levelXP: current.minXP,
    nextLevelXP: next ? next.minXP : null,
    nextTitle: next ? next.title : null,
  };
}

/** Agent XP: 1 per tool call + 1 per 5 KB moved through tools. */
export function agentXP(p) {
  const bytes = (p.totalInputBytes || 0) + (p.totalOutputBytes || 0) + (p.totalBytes || 0);
  return (p.toolCalls || 0) + Math.floor(bytes / 5000);
}

/** Building XP: tool calls + visits + 1 per 10 KB. */
export function buildingXP(p) {
  const bytes = (p.totalInputBytes || 0) + (p.totalOutputBytes || 0);
  return (p.toolCalls || 0) + (p.totalVisits || 0) + Math.floor(bytes / 10000);
}

export function buildingLevelTable(buildingId) {
  return buildingId === 'campfire' ? CAMPFIRE_LEVELS : BUILDING_LEVELS;
}
