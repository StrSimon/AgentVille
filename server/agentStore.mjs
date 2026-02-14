// ── Persistent Agent Store ───────────────────────────────
// Saves agent profiles (name, stats, XP) to disk so they
// survive bridge restarts and accumulate over time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, 'data', 'agents.json');

// ── Level System ────────────────────────────────────────

const LEVELS = [
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

export function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(xp) {
  for (const lvl of LEVELS) {
    if (xp < lvl.minXP) return lvl;
  }
  return null; // max level reached
}

// XP formula: each tool use = 1 XP, plus bytes bonus
export function calculateXP(profile) {
  const bytes = (profile.totalInputBytes || 0) + (profile.totalOutputBytes || 0) + (profile.totalBytes || 0);
  return profile.toolCalls + Math.floor(bytes / 5000);
}

// ── Store ───────────────────────────────────────────────

let store = { agents: {} };

// Load from disk on startup
try {
  if (fs.existsSync(STORE_PATH)) {
    store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
} catch {
  console.log('  ⚠ Could not load agent store, starting fresh');
}

function save() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    // Atomic write: temp file → rename (prevents corruption on crash)
    const tmpPath = STORE_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2));
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.log(`  ⚠ Save failed: ${err.message}`);
  }
}

// Debounce saves (max once per 5s)
let saveTimer = null;
function debouncedSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    save();
    saveTimer = null;
  }, 5000);
}

/**
 * Get or create a persistent agent profile.
 * Returns { name, toolCalls, totalBytes, sessions, firstSeen, lastSeen, xp, level }
 */
export function getProfile(agentId, dwarfName, parentId) {
  if (!store.agents[agentId]) {
    store.agents[agentId] = {
      name: dwarfName,
      toolCalls: 0,
      totalInputBytes: 0,
      totalOutputBytes: 0,
      sessions: 0,
      subAgentsSpawned: 0,
      parentId: parentId || null,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      recentActivity: [],
    };
    debouncedSave();
  } else if (parentId && !store.agents[agentId].parentId) {
    store.agents[agentId].parentId = parentId;
    debouncedSave();
  }

  const profile = store.agents[agentId];

  // Update name if it was assigned before store existed
  if (dwarfName && profile.name !== dwarfName) {
    profile.name = dwarfName;
  }

  return profile;
}

/**
 * Get the stored name for an agentId, or null if unknown.
 */
export function getStoredName(agentId) {
  return store.agents[agentId]?.name || null;
}

/**
 * Record a tool use (from PreToolUse heartbeat).
 */
export function recordToolUse(agentId) {
  const profile = store.agents[agentId];
  if (!profile) return;
  profile.toolCalls++;
  profile.lastSeen = Date.now();
  debouncedSave();
}

/**
 * Record bytes from PostToolUse.
 */
export function recordBytes(agentId, inputBytes, outputBytes) {
  const profile = store.agents[agentId];
  if (!profile) return;
  profile.totalInputBytes = (profile.totalInputBytes || 0) + inputBytes;
  profile.totalOutputBytes = (profile.totalOutputBytes || 0) + outputBytes;
  profile.lastSeen = Date.now();
  debouncedSave();
}

const MAX_RECENT = 20;

/**
 * Record an activity change (persisted for history).
 */
export function recordActivity(agentId, activity, detail) {
  const profile = store.agents[agentId];
  if (!profile) return;
  if (!profile.recentActivity) profile.recentActivity = [];
  profile.recentActivity.push({ activity, detail, timestamp: Date.now() });
  if (profile.recentActivity.length > MAX_RECENT) {
    profile.recentActivity = profile.recentActivity.slice(-MAX_RECENT);
  }
  debouncedSave();
}

/**
 * Record that a parent agent spawned a sub-agent.
 */
export function recordSubAgentSpawn(parentAgentId) {
  const profile = store.agents[parentAgentId];
  if (!profile) return;
  profile.subAgentsSpawned = (profile.subAgentsSpawned || 0) + 1;
  debouncedSave();
}

/**
 * Increment session count (called on first heartbeat per agent per bridge run).
 */
export function recordSession(agentId) {
  const profile = store.agents[agentId];
  if (!profile) return;
  profile.sessions++;
  debouncedSave();
}

/**
 * Get enriched profile with computed XP and level.
 */
export function getEnrichedProfile(agentId) {
  const profile = store.agents[agentId];
  if (!profile) return null;

  const xp = calculateXP(profile);
  const level = getLevel(xp);
  const next = getNextLevel(xp);

  return {
    ...profile,
    totalInputBytes: (profile.totalInputBytes || 0) + (profile.totalBytes ? Math.ceil(profile.totalBytes / 2) : 0),
    totalOutputBytes: (profile.totalOutputBytes || 0) + (profile.totalBytes ? Math.floor(profile.totalBytes / 2) : 0),
    recentActivity: profile.recentActivity || [],
    xp,
    level: level.level,
    title: level.title,
    nextLevelXP: next ? next.minXP : null,
    nextTitle: next ? next.title : null,
  };
}

/**
 * Get all stored profiles (for leaderboard etc).
 */
export function getAllProfiles() {
  return Object.entries(store.agents).map(([id, profile]) => {
    const xp = calculateXP(profile);
    const level = getLevel(xp);
    const next = getNextLevel(xp);
    return {
      agentId: id,
      name: profile.name,
      toolCalls: profile.toolCalls,
      totalInputBytes: (profile.totalInputBytes || 0) + (profile.totalBytes ? Math.ceil(profile.totalBytes / 2) : 0),
      totalOutputBytes: (profile.totalOutputBytes || 0) + (profile.totalBytes ? Math.floor(profile.totalBytes / 2) : 0),
      sessions: profile.sessions,
      subAgentsSpawned: profile.subAgentsSpawned || 0,
      parentId: profile.parentId || null,
      firstSeen: profile.firstSeen,
      lastSeen: profile.lastSeen,
      xp,
      level: level.level,
      title: level.title,
      nextLevelXP: next ? next.minXP : null,
    };
  });
}

// Save on process exit
process.on('exit', save);
process.on('SIGINT', () => { save(); process.exit(); });
process.on('SIGTERM', () => { save(); process.exit(); });
