import type { Graphics } from 'pixi.js';
import { MAT, paintFace, sheen, wallAO, type Material } from './materials';

/** Isometric tile size in world pixels (2:1 diamond). */
export const TW = 64;
export const TH = 32;

export interface Pt { x: number; y: number }

/** Grid coordinate → world pixel (top corner of the tile at gx, gy). */
export function iso(gx: number, gy: number): Pt {
  return { x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) };
}

/** Center of a tile in world pixels. */
export function tileCenter(gx: number, gy: number): Pt {
  return iso(gx + 0.5, gy + 0.5);
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Mix two 0xRRGGBB colors. */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function shade(c: number, t: number): number {
  return t < 0 ? mix(c, 0x000000, -t) : mix(c, 0xffffff, t);
}

export interface PrismColors { top: number; left: number; right: number }

function isMaterial(c: PrismColors | Material): c is Material {
  return typeof (c as Material).texture === 'function';
}

/**
 * Draw an isometric box. (gx, gy) is the back corner in grid units relative to
 * the origin of `g`; w/d are footprint in tiles; h is height in pixels; z lifts the base.
 * Pass a Material for textured, lit faces or plain colors for flat ones.
 */
export function prism(g: Graphics, gx: number, gy: number, w: number, d: number, h: number, c: PrismColors | Material, z = 0): void {
  const A = iso(gx, gy), B = iso(gx + w, gy), C = iso(gx + w, gy + d), D = iso(gx, gy + d);
  const up = (p: Pt, dz: number) => [p.x, p.y - dz];
  const left = [...up(D, z), ...up(C, z), ...up(C, z + h), ...up(D, z + h)];
  const right = [...up(C, z), ...up(B, z), ...up(B, z + h), ...up(C, z + h)];
  const top = [...up(A, z + h), ...up(B, z + h), ...up(C, z + h), ...up(D, z + h)];
  if (isMaterial(c)) {
    paintFace(g, left, c, 'left');
    paintFace(g, right, c, 'right');
    paintFace(g, top, c, 'top', -0.02);
    if (h > 10) {
      wallAO(g, D.x, D.y - z, C.x, C.y - z, Math.min(16, h * 0.4));
      wallAO(g, C.x, C.y - z, B.x, B.y - z, Math.min(16, h * 0.4));
    }
    // crisp edge highlight where the lit face meets the shaded one
    g.moveTo(C.x, C.y - z).lineTo(C.x, C.y - z - h).stroke({ width: 1, color: 0xfff4dc, alpha: 0.18 });
    return;
  }
  g.poly(left).fill(c.left);
  g.poly(right).fill(c.right);
  g.poly(top).fill(c.top);
}

/** Pyramid (hip) roof over a footprint, covered in shingles of the given color. */
export function hipRoof(g: Graphics, gx: number, gy: number, w: number, d: number, base: number, rise: number, color: number, overhang = 0.12): void {
  const o = overhang;
  const A = iso(gx - o, gy - o), B = iso(gx + w + o, gy - o), C = iso(gx + w + o, gy + d + o), D = iso(gx - o, gy + d + o);
  const M = iso(gx + w / 2, gy + d / 2);
  const apex = [M.x, M.y - base - rise];
  const at = (p: Pt) => [p.x, p.y - base];
  const mat = MAT.shingle(color);
  paintFace(g, [...at(A), ...at(B), ...apex], mat, 'top', 0.04);
  paintFace(g, [...at(A), ...at(D), ...apex], mat, 'top', -0.08);
  const front = [...at(D), ...at(C), ...apex];
  paintFace(g, front, mat, 'left', 0.02);
  paintFace(g, [...at(C), ...at(B), ...apex], mat, 'right');
  sheen(g, front, 0.14);
  // eave shadow line
  g.moveTo(at(D)[0], at(D)[1]).lineTo(at(C)[0], at(C)[1]).lineTo(at(B)[0], at(B)[1]).stroke({ width: 2, color: 0x000000, alpha: 0.25 });
}

/** Gable roof with the ridge running along the grid x axis. */
export function gableRoof(g: Graphics, gx: number, gy: number, w: number, d: number, base: number, rise: number, color: number, o = 0.15): void {
  const A = iso(gx - o, gy - o), B = iso(gx + w + o, gy - o), C = iso(gx + w + o, gy + d + o), D = iso(gx - o, gy + d + o);
  const R1 = iso(gx - o, gy + d / 2), R2 = iso(gx + w + o, gy + d / 2);
  const at = (p: Pt, dz = 0) => [p.x, p.y - base - dz];
  const mat = MAT.shingle(color);
  paintFace(g, [...at(A), ...at(B), ...at(R2, rise), ...at(R1, rise)], mat, 'top', -0.06);
  // gable end wall in plaster
  paintFace(g, [...at(C), ...at(B), ...at(R2, rise)], MAT.plaster, 'right', 0.04);
  const front = [...at(D), ...at(C), ...at(R2, rise), ...at(R1, rise)];
  paintFace(g, front, mat, 'left', 0.04);
  sheen(g, front, 0.16);
  g.poly([...at(R1, rise), ...at(R2, rise)]).stroke({ width: 2.5, color: shade(color, 0.25), alpha: 0.8 });
  g.moveTo(at(D)[0], at(D)[1]).lineTo(at(C)[0], at(C)[1]).lineTo(at(B)[0], at(B)[1]).stroke({ width: 2, color: 0x000000, alpha: 0.25 });
}

/** A window or door on the left (south-west) face, at fraction t along the face. */
export function leftFaceRect(g: Graphics, gx: number, gy: number, w: number, d: number, t: number, z: number, width: number, height: number, color: number, alpha = 1): void {
  const D = iso(gx, gy + d), C = iso(gx + w, gy + d);
  const x = D.x + (C.x - D.x) * t, y = D.y + (C.y - D.y) * t;
  const dx = (C.x - D.x) / Math.hypot(C.x - D.x, C.y - D.y), dy = (C.y - D.y) / Math.hypot(C.x - D.x, C.y - D.y);
  const hw = width / 2;
  g.poly([x - dx * hw, y - dy * hw - z, x + dx * hw, y + dy * hw - z, x + dx * hw, y + dy * hw - z - height, x - dx * hw, y - dy * hw - z - height])
    .fill({ color, alpha });
}

/** A window on the right (south-east) face. */
export function rightFaceRect(g: Graphics, gx: number, gy: number, w: number, d: number, t: number, z: number, width: number, height: number, color: number, alpha = 1): void {
  const C = iso(gx + w, gy + d), B = iso(gx + w, gy);
  const x = C.x + (B.x - C.x) * t, y = C.y + (B.y - C.y) * t;
  const len = Math.hypot(B.x - C.x, B.y - C.y);
  const dx = (B.x - C.x) / len, dy = (B.y - C.y) / len;
  const hw = width / 2;
  g.poly([x - dx * hw, y - dy * hw - z, x + dx * hw, y + dy * hw - z, x + dx * hw, y + dy * hw - z - height, x - dx * hw, y - dy * hw - z - height])
    .fill({ color, alpha });
}

/**
 * A real window: wooden frame, dark glass with a sky reflection, mullions and a sill.
 * The warm interior light goes into `lit`, whose alpha follows the time of day.
 */
export function windowFace(
  g: Graphics, lit: Graphics, face: 'left' | 'right',
  gx: number, gy: number, w: number, d: number, t: number, z: number, width: number, height: number,
): void {
  const rect = face === 'left' ? leftFaceRect : rightFaceRect;
  rect(g, gx, gy, w, d, t, z - 1.5, width + 3, height + 3, 0x3b2a1e);
  rect(g, gx, gy, w, d, t, z, width, height, face === 'left' ? 0x2a3550 : 0x1c2438);
  rect(g, gx, gy, w, d, t, z + height * 0.55, width, height * 0.45, 0xa9cdee, face === 'left' ? 0.28 : 0.14);
  rect(lit, gx, gy, w, d, t, z, width, height, face === 'left' ? 0xffcf6e : 0xf2ad52);
  rect(lit, gx, gy, w, d, t, z + height * 0.5, width, height * 0.5, 0xffe9b0, 0.45);
  for (const l of [g, lit]) {
    rect(l, gx, gy, w, d, t, z, 1.3, height, 0x3b2a1e);
    rect(l, gx, gy, w, d, t, z + height / 2 - 0.6, width, 1.3, 0x3b2a1e);
  }
  rect(g, gx, gy, w, d, t, z - 3, width + 5, 2.2, 0xcfc6b4);
}
