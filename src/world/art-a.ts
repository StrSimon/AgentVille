// Building art, part 1: town hall, campfire, guild, forge, arena, tavern, well, library.
import { Graphics } from 'pixi.js';
import { gableRoof, hipRoof, iso, leftFaceRect, prism, rightFaceRect, TW, windowFace } from './iso';
import {
  DARK_STONE, PLASTER, STONE, WINDOW_LIT, WOOD, WOOD_FLAT, type ArtCtx, type ArtResult, type Light,
} from './art-types';

/** Point on the left (SW) face at fraction t along, height z. */
export function leftFacePoint(gx: number, gy: number, w: number, d: number, t: number, z: number): { x: number; y: number } {
  const D = iso(gx, gy + d), C = iso(gx + w, gy + d);
  return { x: D.x + (C.x - D.x) * t, y: D.y + (C.y - D.y) * t - z };
}

export function rightFacePoint(gx: number, gy: number, w: number, d: number, t: number, z: number): { x: number; y: number } {
  const C = iso(gx + w, gy + d), B = iso(gx + w, gy);
  return { x: C.x + (B.x - C.x) * t, y: C.y + (B.y - C.y) * t - z };
}

function windowLights(gx: number, gy: number, w: number, d: number, rows: number[], cols: number[], base = 0.55): Light[] {
  const out: Light[] = [];
  for (const z of rows) for (const t of cols) {
    const p = leftFacePoint(gx, gy, w, d, t, z + 6);
    out.push({ x: p.x, y: p.y, radius: 26, color: WINDOW_LIT, base, active: 0.35 });
  }
  return out;
}

function timberFrame(g: Graphics, gx: number, gy: number, w: number, d: number, z: number, h: number): void {
  for (const t of [0.02, 0.33, 0.66, 0.98]) leftFaceRect(g, gx, gy, w, d, t, z, 2.5, h, 0x5a3b26);
  leftFaceRect(g, gx, gy, w, d, 0.5, z + h * 0.5, w * 64 * 0.9, 2.5, 0x5a3b26);
  for (const t of [0.02, 0.5, 0.98]) rightFaceRect(g, gx, gy, w, d, t, z, 2.5, h, 0x4a311f);
}

function banner(g: Graphics, x: number, y: number, color: number, h = 22): void {
  g.rect(x - 0.8, y - h - 10, 1.6, h + 10).fill(0x3b2f25);
  g.poly([x, y - h - 8, x + 12, y - h - 6, x + 12, y - h + 8, x + 6, y - h + 4, x, y - h + 8]).fill(color);
}

export function townhall({ g, b, level, lit }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx, gy, w, d, 10, STONE);
  prism(g, gx, gy, w, d, 46, PLASTER, 10);
  timberFrame(g, gx, gy, w, d, 10, 46);
  for (const t of [0.18, 0.82]) windowFace(g, lit, 'left', gx, gy, w, d, t, 26, 12, 15);
  for (const t of [0.3, 0.7]) windowFace(g, lit, 'right', gx, gy, w, d, t, 26, 10, 14);
  leftFaceRect(g, gx, gy, w, d, 0.5, 10, 18, 28, 0x4a2f1f);
  leftFaceRect(g, gx, gy, w, d, 0.5, 34, 22, 4, 0x8a5a3a);
  gableRoof(g, gx, gy, w, d, 56, 30, 0xa63d2f);
  // clock tower on the ridge
  prism(g, gx + 1.5, gy + 1, 1, 1, 44, STONE, 62);
  hipRoof(g, gx + 1.5, gy + 1, 1, 1, 106, 30, 0x7a2a22, 0.08);
  const clock = leftFacePoint(gx + 1.5, gy + 1, 1, 1, 0.5, 86);
  g.circle(clock.x, clock.y, 8).fill(0xf5ecd6).stroke({ width: 1.5, color: 0x3b2f25 });
  g.moveTo(clock.x, clock.y).lineTo(clock.x, clock.y - 5).stroke({ width: 1.4, color: 0x3b2f25 });
  g.moveTo(clock.x, clock.y).lineTo(clock.x + 4, clock.y + 1).stroke({ width: 1.4, color: 0x3b2f25 });
  for (let i = 0; i < Math.min(4, 1 + Math.floor(level / 3)); i++) {
    const p = leftFacePoint(gx, gy, w, d, 0.08 + i * 0.28, 0);
    banner(g, p.x - 6, p.y + 6, i % 2 ? 0xa63d2f : 0xf59e0b);
  }
  // benches where waiting dwarves sit
  const benches: Graphics[] = [];
  for (const row of [0, 1]) {
    const bench = new Graphics();
    const by = gy + d + 1.05 + row * 1.1;
    prism(bench, gx - 0.6, by, 4.4, 0.3, 5, WOOD);
    for (const x of [gx - 0.5, gx + 1.6, gx + 3.6]) prism(bench, x, by + 0.2, 0.12, 0.1, 5, { top: 0x4a311f, left: 0x3b2718, right: 0x2e1f13 });
    bench.zIndex = iso(gx - 0.6, by + 0.3).y - 1;
    benches.push(bench);
  }
  const clockLight = { x: clock.x, y: clock.y, radius: 26, color: 0xfff1c9, base: 0.6, active: 0 };
  return { lights: [...windowLights(gx, gy, w, d, [26], [0.18, 0.82], 0.7), clockLight], emitters: [], top: clock.y - 60, extras: benches };
}

export function campfire({ g, b, add }: ArtCtx): ArtResult {
  const c = iso(b.gx + 0.5, b.gy + 0.5);
  g.ellipse(c.x, c.y, 26, 13).fill({ color: 0x000000, alpha: 0.25 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.ellipse(c.x + Math.cos(a) * 20, c.y + Math.sin(a) * 10, 5, 3.5).fill(i % 2 ? 0x8f887b : 0x7a7469);
  }
  g.poly([c.x - 14, c.y + 2, c.x + 12, c.y - 6, c.x + 14, c.y - 2, c.x - 12, c.y + 6]).fill(0x5c3d28);
  g.poly([c.x - 12, c.y - 6, c.x + 14, c.y + 3, c.x + 12, c.y + 7, c.x - 14, c.y - 2]).fill(0x6b4a32);
  // log seats
  for (const [dx, dy] of [[-46, 4], [44, 2], [-6, -26], [6, 28]]) {
    g.roundRect(c.x + dx - 13, c.y + dy - 4, 26, 8, 4).fill(0x6b4a32);
    g.ellipse(c.x + dx + 12, c.y + dy, 3, 4).fill(0xb08458);
  }
  const ember = new Graphics().ellipse(0, 0, 12, 6).fill(0xff7a1a);
  ember.position.set(c.x, c.y - 2);
  ember.blendMode = 'add';
  add(ember);
  return {
    lights: [{ x: c.x, y: c.y - 10, radius: 150, color: 0xff9a3c, base: 1, active: 0.2, flicker: true }],
    emitters: [{ x: c.x, y: c.y - 4, kind: 'fire', rate: 22 }, { x: c.x, y: c.y - 10, kind: 'sparks', rate: 1.5 }, { x: c.x, y: c.y - 30, kind: 'smoke', rate: 1.2 }],
    animate: (t) => { ember.alpha = 0.6 + Math.sin(t * 9) * 0.2 + Math.sin(t * 23) * 0.1; },
    top: c.y - 50,
  };
}

export function guild({ g, b, level, lit }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx, gy, w, d, 42, STONE);
  for (const t of [0.22, 0.5, 0.78]) windowFace(g, lit, 'left', gx, gy, w, d, t, 14, 12, 20);
  for (const t of [0.3, 0.7]) windowFace(g, lit, 'right', gx, gy, w, d, t, 14, 11, 18);
  hipRoof(g, gx, gy, w, d, 42, 34, 0x2f5d9e);
  if (level >= 4) {
    prism(g, gx + w - 1, gy, 1, 1, 34, STONE, 42);
    hipRoof(g, gx + w - 1, gy, 1, 1, 76, 26, 0x1e3a6e, 0.06);
  }
  const p = leftFacePoint(gx, gy, w, d, 0.04, 0);
  banner(g, p.x - 4, p.y + 4, 0x60a5fa, 30);
  // map table in front
  const tbl = iso(gx + w / 2 + 0.8, gy + d + 0.35);
  g.poly([tbl.x - 12, tbl.y - 8, tbl.x, tbl.y - 14, tbl.x + 12, tbl.y - 8, tbl.x, tbl.y - 2]).fill(0xe9dcc0);
  g.rect(tbl.x - 1, tbl.y - 2, 2, 6).fill(0x5c3d28);
  return { lights: windowLights(gx, gy, w, d, [14], [0.22, 0.5, 0.78]), emitters: [], top: iso(gx + w / 2, gy + d / 2).y - 110 };
}

export function forge({ g, b, add }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx, gy, w, d, 36, DARK_STONE);
  prism(g, gx + 2.1, gy + 0.2, 0.7, 0.7, 92, { top: 0x6b4f43, left: 0x57403a, right: 0x3f2e29 });
  gableRoof(g, gx, gy, w, d, 36, 26, 0x4a3b33);
  // furnace mouth
  leftFaceRect(g, gx, gy, w, d, 0.3, 4, 22, 20, 0x1b0f0a);
  const mouth = new Graphics();
  leftFaceRect(mouth, gx, gy, w, d, 0.3, 6, 18, 14, 0xff7a1a);
  mouth.blendMode = 'add';
  add(mouth);
  rightFaceRect(g, gx, gy, w, d, 0.55, 14, 10, 14, 0xffa14a, 0.85);
  // anvil + barrel by the door
  const anvil = iso(gx + w / 2 + 0.6, gy + d + 0.35);
  g.poly([anvil.x - 9, anvil.y - 10, anvil.x + 9, anvil.y - 10, anvil.x + 6, anvil.y - 6, anvil.x - 6, anvil.y - 6]).fill(0x3a3d45);
  g.rect(anvil.x - 4, anvil.y - 6, 8, 7).fill(0x2a2c33);
  const barrel = iso(gx + w + 0.2, gy + d - 0.4);
  g.ellipse(barrel.x, barrel.y - 12, 7, 3.5).fill(0x2f6f9f);
  g.rect(barrel.x - 7, barrel.y - 12, 14, 12).fill(WOOD_FLAT.left);
  const chimney = iso(gx + 2.45, gy + 0.55);
  const m = leftFacePoint(gx, gy, w, d, 0.3, 14);
  return {
    lights: [
      { x: m.x, y: m.y, radius: 70, color: 0xff7a1a, base: 0.5, active: 0.6, flicker: true },
      { x: anvil.x, y: anvil.y - 12, radius: 40, color: 0xffb347, base: 0, active: 0.7, flicker: true },
    ],
    emitters: [
      { x: chimney.x, y: chimney.y - 96, kind: 'smoke', rate: 1.2 },
      { x: chimney.x, y: chimney.y - 96, kind: 'smoke', rate: 2.5, whenActive: true },
      { x: anvil.x, y: anvil.y - 12, kind: 'sparks', rate: 14, whenActive: true },
    ],
    animate: (t, active) => { mouth.alpha = 0.55 + (active ? 0.35 : 0) + Math.sin(t * 7) * 0.1; },
    top: chimney.y - 110,
  };
}

export function arena({ g, b, level, add }: ArtCtx): ArtResult {
  const c = iso(b.gx + b.w / 2, b.gy + b.d / 2);
  const rx = TW * 1.85, ry = rx / 2, h = 28;
  g.ellipse(c.x, c.y, rx, ry).fill(0x6c665b);
  g.rect(c.x - rx, c.y - h, rx * 2, h).fill(0x8f887b);
  g.ellipse(c.x, c.y - h, rx, ry).fill(0xb3ab9c);
  g.ellipse(c.x, c.y - h + 2, rx * 0.78, ry * 0.78).fill(0x8a7a55);
  g.ellipse(c.x, c.y - h + 5, rx * 0.72, ry * 0.7).fill(0xd9bf86);
  for (let a = 0.15; a < Math.PI - 0.1; a += 0.28) {
    const x = c.x + Math.cos(a) * rx * 0.985, y = c.y + Math.sin(a) * ry * 0.985;
    g.roundRect(x - 5, y - 22, 10, 16, 5).fill(0x2a2620);
  }
  // training dummy
  g.rect(c.x - 1.5, c.y - h - 18, 3, 18).fill(0x6b4a32);
  g.ellipse(c.x, c.y - h - 18, 6, 9).fill(0xc9a96e);
  const flags: Graphics[] = [];
  const count = 4 + Math.min(4, level);
  const colors = [0x22c55e, 0xf59e0b, 0x60a5fa, 0xfb4f6b];
  for (let i = 0; i < count; i++) {
    const a = Math.PI + (i / (count - 1)) * Math.PI;
    const x = c.x + Math.cos(a) * rx * 0.9, y = c.y - h + Math.sin(a) * ry * 0.9;
    g.rect(x - 0.8, y - 30, 1.6, 30).fill(0x3b2f25);
    const flag = new Graphics().poly([0, 0, 14, 3, 0, 8]).fill(colors[i % colors.length]);
    flag.position.set(x, y - 30);
    add(flag);
    flags.push(flag);
  }
  return {
    lights: [
      { x: c.x - rx * 0.8, y: c.y - h - 10, radius: 40, color: 0xffa94d, base: 0.6, active: 0.3, flicker: true },
      { x: c.x + rx * 0.8, y: c.y - h - 10, radius: 40, color: 0xffa94d, base: 0.6, active: 0.3, flicker: true },
    ],
    emitters: [{ x: c.x, y: c.y - h - 10, kind: 'sparks', rate: 10, whenActive: true }],
    animate: (t, active) => flags.forEach((f, i) => { f.scale.x = 0.8 + Math.sin(t * (active ? 7 : 3) + i) * 0.25; }),
    top: c.y - h - 60,
  };
}

export function tavern({ g, b, lit }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx, gy, w, d, 8, STONE);
  prism(g, gx, gy, w, d, 34, PLASTER, 8);
  timberFrame(g, gx, gy, w, d, 8, 34);
  prism(g, gx + 0.3, gy + 0.3, 0.6, 0.6, 76, STONE);
  gableRoof(g, gx, gy, w, d, 42, 28, 0x8a3b2a);
  for (const t of [0.2, 0.8]) windowFace(g, lit, 'left', gx, gy, w, d, t, 18, 12, 13);
  for (const t of [0.35, 0.75]) windowFace(g, lit, 'right', gx, gy, w, d, t, 18, 10, 12);
  leftFaceRect(g, gx, gy, w, d, 0.5, 8, 14, 22, 0x4a2f1f);
  const sign = leftFacePoint(gx, gy, w, d, 0.66, 34);
  g.rect(sign.x, sign.y - 2, 14, 2).fill(0x3b2f25);
  g.roundRect(sign.x + 6, sign.y, 12, 10, 2).fill(0xd4a558);
  g.rect(sign.x + 9, sign.y + 2, 5, 6).fill(0xfff1c9);
  for (const t of [1.12, 1.35]) {
    const p = leftFacePoint(gx, gy, w, d, t, 0);
    g.ellipse(p.x, p.y - 12, 6, 3).fill(0x7a5236);
    g.rect(p.x - 6, p.y - 12, 12, 12).fill(0x5c3d28);
  }
  const ch = iso(gx + 0.6, gy + 0.6);
  return {
    lights: windowLights(gx, gy, w, d, [18], [0.2, 0.8], 0.9),
    emitters: [{ x: ch.x, y: ch.y - 80, kind: 'smoke', rate: 1.4 }],
    top: ch.y - 96,
  };
}

export function well({ g, b, add }: ArtCtx): ArtResult {
  const c = iso(b.gx + 0.5, b.gy + 0.5);
  g.ellipse(c.x, c.y, 18, 9).fill(0x6c665b);
  g.rect(c.x - 18, c.y - 14, 36, 14).fill(0x8f887b);
  g.ellipse(c.x, c.y - 14, 18, 9).fill(0xb3ab9c);
  const water = new Graphics().ellipse(0, 0, 13, 6).fill(0x67e8f9);
  water.position.set(c.x, c.y - 14);
  water.blendMode = 'add';
  add(water);
  for (const dx of [-15, 15]) g.rect(c.x + dx - 1.5, c.y - 44, 3, 32).fill(0x5c3d28);
  g.poly([c.x - 24, c.y - 40, c.x, c.y - 58, c.x + 24, c.y - 40, c.x, c.y - 34]).fill(0x6b3b2a);
  return {
    lights: [{ x: c.x, y: c.y - 16, radius: 60, color: 0x67e8f9, base: 0.5, active: 0.6 }],
    emitters: [{ x: c.x, y: c.y - 16, kind: 'magic', rate: 1 }, { x: c.x, y: c.y - 16, kind: 'magic', rate: 9, whenActive: true }],
    animate: (t, active) => { water.alpha = 0.45 + Math.sin(t * 2) * 0.15 + (active ? 0.3 : 0); },
    top: c.y - 70,
  };
}

export function library({ g, b, level, lit }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx, gy, w, d, 64, STONE);
  for (const z of [10, 36]) {
    for (const t of [0.2, 0.4, 0.6, 0.8]) windowFace(g, lit, 'left', gx, gy, w, d, t, z, 8, 16);
    for (const t of [0.25, 0.5, 0.75]) windowFace(g, lit, 'right', gx, gy, w, d, t, z, 7, 15);
  }
  leftFaceRect(g, gx, gy, w, d, 0.5, 0, 12, 8, 0x4a2f1f);
  hipRoof(g, gx, gy, w, d, 64, 36, 0x5b3f8f);
  const p = leftFacePoint(gx, gy, w, d, 0.96, 0);
  banner(g, p.x + 8, p.y, 0xa78bfa, 34);
  if (level >= 5) {
    const top = iso(gx + w / 2, gy + d / 2);
    g.circle(top.x, top.y - 104, 4).fill(0xfde047);
  }
  return { lights: windowLights(gx, gy, w, d, [10, 36], [0.2, 0.4, 0.6, 0.8], 0.45), emitters: [], top: iso(gx + w / 2, gy + d / 2).y - 130 };
}
