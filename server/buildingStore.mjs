// ── Persistent Building Store ────────────────────────────
// Saves building progression (XP, level, stats) to disk so
// they survive bridge restarts and accumulate over time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, 'data', 'buildings.json');

// ── Level System ────────────────────────────────────────

const BUILDING_LEVELS = [
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

const CAMPFIRE_LEVELS = [
  { level: 1,  title: 'Campsite',          minXP: 0 },
  { level: 2,  title: 'Gathering',         minXP: 100 },
  { level: 3,  title: 'Meeting Place',     minXP: 500 },
  { level: 4,  title: 'Town Square',       minXP: 1500 },
  { level: 5,  title: 'Trading Post',      minXP: 4000 },
  { level: 6,  title: 'Hub',               minXP: 10000 },
  { level: 7,  title: 'Grand Plaza',       minXP: 25000 },
  { level: 8,  title: 'Cultural Center',   minXP: 60000 },
  { level: 9,  title: 'Sacred Circle',     minXP: 140000 },
  { level: 10, title: 'Heart of Village',  minXP: 300000 },
];

export function getLevel(xp, buildingId) {
  const levels = buildingId === 'campfire' ? CAMPFIRE_LEVELS : BUILDING_LEVELS;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i].minXP) return levels[i];
  }
  return levels[0];
}

export function getNextLevel(xp, buildingId) {
  const levels = buildingId === 'campfire' ? CAMPFIRE_LEVELS : BUILDING_LEVELS;
  for (const lvl of levels) {
    if (xp < lvl.minXP) return lvl;
  }
  return null; // max level
}

// XP formula: tool calls + bytes bonus (slower than agents)
export function calculateXP(profile) {
  const toolXP = profile.toolCalls || 0;
  const bytes = (profile.totalInputBytes || 0) + (profile.totalOutputBytes || 0);
  const bytesXP = Math.floor(bytes / 10000);
  const visitXP = profile.totalVisits || 0;
  return toolXP + bytesXP + visitXP;
}

// ── Store ───────────────────────────────────────────────

let store = { buildings: {} };

try {
  if (fs.existsSync(STORE_PATH)) {
    store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
} catch {
  console.log('  ⚠ Could not load building store, starting fresh');
}

function save() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    const tmpPath = STORE_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2));
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.log(`  ⚠ Building save failed: ${err.message}`);
  }
}

let saveTimer = null;
function debouncedSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    save();
    saveTimer = null;
  }, 5000);
}

/**
 * Get or create a persistent building profile.
 */
export function getProfile(buildingId) {
  if (!store.buildings[buildingId]) {
    store.buildings[buildingId] = {
      toolCalls: 0,
      totalInputBytes: 0,
      totalOutputBytes: 0,
      uniqueVisitors: [],
      totalVisits: 0,
      firstActivity: Date.now(),
      lastActivity: Date.now(),
    };
    debouncedSave();
  }
  return store.buildings[buildingId];
}

/**
 * Record a tool use from an agent working in this building.
 */
export function recordActivity(buildingId, toolCalls, inputBytes, outputBytes) {
  const profile = getProfile(buildingId);
  profile.toolCalls += toolCalls;
  profile.totalInputBytes += inputBytes;
  profile.totalOutputBytes += outputBytes;
  profile.lastActivity = Date.now();
  debouncedSave();
}

/**
 * Record an agent visit (for campfire XP and unique visitor tracking).
 */
export function recordVisit(buildingId, agentId) {
  const profile = getProfile(buildingId);
  profile.totalVisits = (profile.totalVisits || 0) + 1;
  if (!profile.uniqueVisitors) profile.uniqueVisitors = [];
  if (!profile.uniqueVisitors.includes(agentId)) {
    profile.uniqueVisitors.push(agentId);
  }
  profile.lastActivity = Date.now();
  debouncedSave();
}

/**
 * Get enriched profile with computed XP and level.
 */
export function getEnrichedProfile(buildingId) {
  const profile = store.buildings[buildingId];
  if (!profile) return null;

  const xp = calculateXP(profile);
  const level = getLevel(xp, buildingId);
  const next = getNextLevel(xp, buildingId);

  return {
    buildingId,
    toolCalls: profile.toolCalls,
    totalInputBytes: profile.totalInputBytes,
    totalOutputBytes: profile.totalOutputBytes,
    uniqueVisitors: (profile.uniqueVisitors || []).length,
    totalVisits: profile.totalVisits || 0,
    firstActivity: profile.firstActivity,
    lastActivity: profile.lastActivity,
    xp,
    level: level.level,
    title: level.title,
    nextLevelXP: next ? next.minXP : null,
    nextTitle: next ? next.title : null,
  };
}

/**
 * Get all building profiles (for status/leaderboard).
 */
export function getAllProfiles() {
  return Object.keys(store.buildings).map(id => getEnrichedProfile(id));
}

// Save on process exit
process.on('exit', save);
process.on('SIGINT', () => { save(); process.exit(); });
process.on('SIGTERM', () => { save(); process.exit(); });
