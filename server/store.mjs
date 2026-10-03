// ── Paths & persistence (~/.agentville) ──────────────────

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyData, migrateData } from './core/profiles.mjs';
import { DEFAULT_PRICES } from './core/pricing.mjs';

export const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function homeDir() {
  return process.env.AGENTVILLE_HOME || path.join(os.homedir(), '.agentville');
}

export function paths(home = homeDir()) {
  return {
    home,
    data: path.join(home, 'village.json'),
    settings: path.join(home, 'settings.json'),
    prices: path.join(home, 'prices.json'),
    hookDir: path.join(home, 'hook'),
    log: path.join(home, 'agentville.log'),
  };
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Atomic write: temp file + rename, so a crash never leaves half a file. */
export function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

/** Import profiles from the pre-2.0 repo layout (server/data/agents.json + buildings.json). */
export function legacyData(dirs = [path.join(PACKAGE_DIR, 'server', 'data')]) {
  for (const dir of dirs) {
    const agents = readJSON(path.join(dir, 'agents.json'), null);
    if (!agents?.agents) continue;
    const buildings = readJSON(path.join(dir, 'buildings.json'), { buildings: {} });
    return migrateData({ agents: agents.agents, buildings: buildings.buildings || {} });
  }
  return null;
}

export function loadData(p = paths()) {
  const existing = readJSON(p.data, null);
  if (existing) return { data: migrateData(existing), migrated: false };
  const legacy = legacyData();
  if (legacy) return { data: legacy, migrated: true };
  return { data: emptyData(), migrated: false };
}

export function loadSettings(p = paths()) {
  return readJSON(p.settings, {});
}

/** User price overrides are merged over the built-in table. */
export function loadPrices(p = paths()) {
  const custom = readJSON(p.prices, {});
  return { ...DEFAULT_PRICES, ...custom };
}

/** Debounced saver: at most one write per `delayMs`, plus a final flush on exit. */
export function createSaver(file, getValue, delayMs = 3000) {
  let timer = null;
  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    try { writeJSON(file, pruneCursors(getValue())); } catch (err) { console.error(`  ⚠ save failed: ${err.message}`); }
  };
  return {
    schedule() {
      if (!timer) timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}

const CURSOR_TTL = 30 * 86_400_000;

function pruneCursors(data) {
  const now = Date.now();
  for (const [p, c] of Object.entries(data.cursors || {})) {
    if (c.lastRead && now - c.lastRead > CURSOR_TTL) delete data.cursors[p];
  }
  return data;
}

/**
 * Read complete JSONL lines appended since `cursor.offset`.
 * Handles truncation (file shorter than offset) by starting over.
 */
export function readTranscriptLines(file, cursor) {
  let fd;
  try {
    const stat = fs.statSync(file);
    if (stat.size < (cursor.offset || 0)) cursor.offset = 0;
    if (stat.size === cursor.offset) return [];
    fd = fs.openSync(file, 'r');
    const length = Math.min(stat.size - (cursor.offset || 0), 64 * 1024 * 1024);
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, cursor.offset || 0);
    const text = buf.toString('utf8');
    const end = text.lastIndexOf('\n');
    if (end < 0) return [];
    cursor.offset = (cursor.offset || 0) + Buffer.byteLength(text.slice(0, end + 1));
    const out = [];
    for (const line of text.slice(0, end).split('\n')) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch { /* partial or corrupt line */ }
    }
    return out;
  } catch {
    return [];
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

const metaCache = new Map();

/** First line of a Codex rollout (session_meta): who started this session? */
export function readSessionMeta(file) {
  if (metaCache.has(file)) return metaCache.get(file);
  let meta = null;
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const first = buf.toString('utf8', 0, n).split('\n')[0];
    const payload = JSON.parse(first).payload || {};
    meta = { originator: payload.originator || null, source: payload.source || null };
  } catch { /* not readable yet */ }
  if (meta) metaCache.set(file, meta);
  return meta;
}
