// Map seamless textures onto isometric faces and add light/occlusion on top.
import { FillGradient, FillPattern, Matrix, type Graphics, type Texture } from 'pixi.js';
import {
  cobbleTexture, dirtTexture, grassTexture, plasterTexture, rockTexture, shingleTexture, stoneWallTexture, woodTexture,
} from './textures';

export type Orient = 'top' | 'left' | 'right';

export interface Material {
  texture: () => Texture;
  /** pixels of world per texture pixel along the face */
  scale?: number;
}

const patterns = new Map<string, FillPattern>();
let patternId = 0;
const ids = new WeakMap<Texture, number>();

/** Texture-space → world-space transform for each face orientation (sun from the upper left). */
function matrixFor(orient: Orient, s: number): Matrix {
  switch (orient) {
    case 'top': return new Matrix(0.5 * s, 0.25 * s, -0.5 * s, 0.25 * s, 0, 0);
    case 'left': return new Matrix(0.45 * s, 0.225 * s, 0, 0.5 * s, 0, 0);
    case 'right': return new Matrix(0.45 * s, -0.225 * s, 0, 0.5 * s, 0, 0);
  }
}

export function pattern(tex: Texture, orient: Orient, s = 1): FillPattern {
  if (!ids.has(tex)) ids.set(tex, patternId++);
  const key = `${ids.get(tex)}-${orient}-${s}`;
  let p = patterns.get(key);
  if (!p) {
    p = new FillPattern({ texture: tex, repetition: 'repeat' });
    p.setTransform(matrixFor(orient, s));
    patterns.set(key, p);
  }
  return p;
}

const SHADE: Record<Orient, number> = { top: 0, left: 0.1, right: 0.36 };

/** Fill a face polygon with a material, then darken it according to its orientation. */
export function paintFace(g: Graphics, pts: number[], mat: Material, orient: Orient, extraShade = 0): void {
  const tex = mat.texture();
  // large painted textures: keep the same world density and let one tile span ~4 grid tiles
  const norm = tex.width > 128 ? (128 / tex.width) * 2 : 1;
  g.poly(pts).fill(pattern(tex, orient, (mat.scale ?? 1) * norm));
  const shade = SHADE[orient] + extraShade;
  if (shade > 0) g.poly(pts).fill({ color: 0x0b0f1c, alpha: Math.min(0.8, shade) });
}

let aoGradient: FillGradient | null = null;

/** Soft contact shadow along the bottom of a wall face (ambient occlusion). */
export function wallAO(g: Graphics, x1: number, y1: number, x2: number, y2: number, height = 14): void {
  aoGradient ||= new FillGradient({
    start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
    colorStops: [{ offset: 0, color: 'rgba(8,10,20,0)' }, { offset: 1, color: 'rgba(8,10,20,0.42)' }],
  });
  g.poly([x1, y1 - height, x2, y2 - height, x2, y2, x1, y1]).fill(aoGradient);
}

let roofSheen: FillGradient | null = null;

/** Light sheen from the ridge down (roofs catch the sky). */
export function sheen(g: Graphics, pts: number[], alpha = 0.16): void {
  roofSheen ||= new FillGradient({
    start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
    colorStops: [{ offset: 0, color: 'rgba(255,240,215,0.9)' }, { offset: 0.55, color: 'rgba(255,240,215,0)' }],
  });
  g.poly(pts).fill({ fill: roofSheen, alpha } as never);
}

export const MAT = {
  stone: { texture: () => stoneWallTexture(0xa39b8c), scale: 1 } as Material,
  darkStone: { texture: () => stoneWallTexture(0x6f6a63), scale: 1 } as Material,
  plaster: { texture: () => plasterTexture(0xe6d8ba), scale: 1 } as Material,
  wood: { texture: () => woodTexture(0x8a5c3a), scale: 0.9 } as Material,
  rock: { texture: () => rockTexture(0x6e6a66), scale: 1.2 } as Material,
  cobble: { texture: () => cobbleTexture(), scale: 0.9 } as Material,
  dirt: { texture: () => dirtTexture(), scale: 1 } as Material,
  grass: (base: number): Material => ({ texture: () => grassTexture(base), scale: 1 }),
  shingle: (base: number): Material => ({ texture: () => shingleTexture(base), scale: 0.8 }),
};
