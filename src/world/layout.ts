import type { Activity } from '../types';
import { iso, rng, type Pt } from './iso';

export type BuildingId =
  | 'townhall' | 'campfire' | 'guild' | 'forge' | 'scriptorium' | 'arena' | 'apothecary' | 'library'
  | 'observatory' | 'tower' | 'post' | 'mine' | 'gate' | 'well' | 'tavern';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  blurb: string;
  activities: Activity[];
  gx: number; gy: number; w: number; d: number;
  glow: number;
}

export const SOURCE_COLOR = { claude: 0xd4693f, codex: 0x1fae7c, custom: 0x5b8def } as const;

/** Village layout on a 32×32 grid; the plaza sits around (15, 15). */
export const BUILDINGS: BuildingDef[] = [
  { id: 'townhall', name: 'Town Hall', blurb: 'Dwarves wait here for your answer', activities: ['waiting'], gx: 13, gy: 9, w: 4, d: 3, glow: 0xfb4f6b },
  { id: 'campfire', name: 'Campfire', blurb: 'Idle dwarves warm their beards', activities: ['idle'], gx: 15, gy: 16, w: 1, d: 1, glow: 0xff9a3c },
  { id: 'guild', name: 'Architect Guild', blurb: 'Planning & delegating to sub-agents', activities: ['planning', 'delegating'], gx: 19, gy: 7, w: 3, d: 3, glow: 0x60a5fa },
  { id: 'forge', name: 'The Forge', blurb: 'Writing and editing code', activities: ['coding'], gx: 22, gy: 12, w: 3, d: 3, glow: 0xf97316 },
  { id: 'arena', name: 'The Arena', blurb: 'Tests, type checks and linters', activities: ['testing'], gx: 22, gy: 18, w: 4, d: 4, glow: 0x22c55e },
  { id: 'apothecary', name: 'Apothecary', blurb: 'Debugging failures', activities: ['debugging'], gx: 19, gy: 23, w: 2, d: 2, glow: 0x84cc16 },
  { id: 'tavern', name: 'The Tavern', blurb: 'Resting residents between sessions', activities: [], gx: 13, gy: 22, w: 3, d: 3, glow: 0xfbbf24 },
  { id: 'well', name: 'Well of Memory', blurb: 'Compacting context & memories', activities: ['remembering'], gx: 10, gy: 18, w: 1, d: 1, glow: 0x67e8f9 },
  { id: 'library', name: 'The Library', blurb: 'Reading & searching the code', activities: ['researching'], gx: 5, gy: 16, w: 3, d: 3, glow: 0xa78bfa },
  { id: 'scriptorium', name: 'Scriptorium', blurb: 'Writing docs & markdown', activities: ['writing'], gx: 8, gy: 11, w: 2, d: 2, glow: 0xe879f9 },
  { id: 'observatory', name: 'Observatory', blurb: 'Browsing the web & docs', activities: ['browsing'], gx: 8, gy: 5, w: 2, d: 2, glow: 0x38bdf8 },
  { id: 'tower', name: 'Watchtower', blurb: 'Reviewing diffs & PRs', activities: ['reviewing'], gx: 16, gy: 3, w: 2, d: 2, glow: 0xfacc15 },
  { id: 'post', name: 'Rune Post', blurb: 'Commits, pushes & pull requests', activities: ['committing'], gx: 18, gy: 18, w: 2, d: 2, glow: 0xfb923c },
  { id: 'mine', name: 'The Mine', blurb: 'Digging up dependencies', activities: ['installing'], gx: 3, gy: 7, w: 2, d: 2, glow: 0xfde047 },
  { id: 'gate', name: 'Sky Gate', blurb: 'Deploying to the world', activities: ['deploying'], gx: 25, gy: 24, w: 2, d: 1, glow: 0xc084fc },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map(b => [b.id, b])) as Record<BuildingId, BuildingDef>;

export const ACTIVITY_HOME: Record<Activity, BuildingId> = {
  planning: 'guild', delegating: 'guild', coding: 'forge', writing: 'scriptorium', testing: 'arena',
  debugging: 'apothecary', researching: 'library', browsing: 'observatory', reviewing: 'tower',
  committing: 'post', installing: 'mine', deploying: 'gate', waiting: 'townhall', remembering: 'well', idle: 'campfire',
};

export const PLAZA = { gx: 15.5, gy: 14.5 };
export const GRID = 32;

/** Door tile (in front of the left/south-west face) where dwarves gather. */
export function doorOf(b: BuildingDef): { gx: number; gy: number } {
  if (b.id === 'campfire' || b.id === 'well') return { gx: b.gx + 0.5, gy: b.gy + 1.6 };
  if (b.id === 'townhall') return { gx: b.gx + b.w / 2, gy: b.gy + b.d + 1.6 };
  return { gx: b.gx + b.w / 2, gy: b.gy + b.d + 0.7 };
}

/** Standing slots around a door so several dwarves don't overlap. */
export function slotPos(b: BuildingDef, slot: number): Pt {
  const door = doorOf(b);
  if (b.id === 'campfire') {
    const angle = (slot * 2.399) % (Math.PI * 2);
    const r = 1.35 + (slot % 3) * 0.25;
    return iso(b.gx + 0.5 + Math.cos(angle) * r, b.gy + 0.5 + Math.sin(angle) * r);
  }
  if (b.id === 'townhall') {
    // two benches in front of the hall
    const row = slot % 2, col = Math.floor(slot / 2);
    return iso(b.gx - 0.2 + col * 0.75, b.gy + b.d + 1.2 + row * 1.1);
  }
  if (b.id === 'tavern') {
    // beer garden in front of the tavern for resting residents
    const col = slot % 5, row = Math.floor(slot / 5);
    return iso(b.gx - 0.6 + col * 0.95 + (row % 2) * 0.45, b.gy + b.d + 0.9 + row * 0.85);
  }
  const ring = Math.floor(slot / 5), k = slot % 5;
  return iso(door.gx + (k - 2) * 0.55, door.gy + ring * 0.6 + (k % 2) * 0.2);
}

export function insideIsland(gx: number, gy: number): boolean {
  const dx = gx - 15.5, dy = gy - 15.5;
  const wobble = Math.sin(gx * 0.9) * 0.8 + Math.cos(gy * 0.7) * 0.8;
  return Math.hypot(dx, dy * 1.02) < 15 + wobble;
}

function occupied(): Set<string> {
  const s = new Set<string>();
  for (const b of BUILDINGS) {
    for (let x = Math.floor(b.gx) - 1; x < b.gx + b.w + 1; x++) {
      for (let y = Math.floor(b.gy) - 1; y < b.gy + b.d + 1; y++) s.add(`${x},${y}`);
    }
  }
  return s;
}

/** Cobblestone tiles: an L-shaped road from the plaza to every door, plus the plaza itself. */
export function pathTiles(): Set<string> {
  const out = new Set<string>();
  const px = Math.floor(PLAZA.gx), py = Math.floor(PLAZA.gy);
  for (let x = px - 2; x <= px + 2; x++) for (let y = py - 2; y <= py + 3; y++) out.add(`${x},${y}`);
  for (const b of BUILDINGS) {
    const d = doorOf(b);
    let x = Math.floor(d.gx), y = Math.floor(d.gy);
    out.add(`${x},${y}`);
    while (x !== px) { x += Math.sign(px - x); out.add(`${x},${y}`); }
    while (y !== py) { y += Math.sign(py - y); out.add(`${x},${y}`); }
  }
  return out;
}

export interface Prop { kind: 'pine' | 'oak' | 'bush' | 'rock' | 'flowers' | 'lantern' | 'mushroom'; gx: number; gy: number; s: number }

/** Deterministic trees, rocks, flowers and lanterns. */
export function props(paths: Set<string>): Prop[] {
  const r = rng(7);
  const occ = occupied();
  const out: Prop[] = [];
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (!insideIsland(gx, gy) || occ.has(`${gx},${gy}`) || paths.has(`${gx},${gy}`)) continue;
      if (inPond(gx, gy)) continue;
      const edge = Math.hypot(gx - 15.5, gy - 15.5) / 15;
      const roll = r();
      const jx = gx + 0.2 + r() * 0.6, jy = gy + 0.2 + r() * 0.6;
      if (roll < 0.06 + edge * 0.32) out.push({ kind: r() < 0.6 ? 'pine' : 'oak', gx: jx, gy: jy, s: 0.8 + r() * 0.5 });
      else if (roll < 0.62) {
        const k = r();
        if (k < 0.08) out.push({ kind: 'rock', gx: jx, gy: jy, s: 0.6 + r() * 0.7 });
        else if (k < 0.18) out.push({ kind: 'flowers', gx: jx, gy: jy, s: 1 });
        else if (k < 0.24) out.push({ kind: 'bush', gx: jx, gy: jy, s: 0.7 + r() * 0.4 });
        else if (k < 0.26) out.push({ kind: 'mushroom', gx: jx, gy: jy, s: 1 });
      }
    }
  }
  // Lanterns along the roads
  let i = 0;
  for (const key of paths) {
    if (i++ % 7 !== 3) continue;
    const [x, y] = key.split(',').map(Number);
    const side = paths.has(`${x + 1},${y}`) ? { gx: x + 0.5, gy: y + 1.05 } : { gx: x + 1.05, gy: y + 0.5 };
    if (!occ.has(`${Math.floor(side.gx)},${Math.floor(side.gy)}`)) out.push({ kind: 'lantern', ...side, s: 1 });
  }
  return out;
}

/** A small pond in the south-west meadow. */
export function inPond(gx: number, gy: number): boolean {
  return Math.hypot(gx - 6.5, (gy - 23.5) * 1.3) < 2.6;
}
