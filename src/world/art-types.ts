import type { Container, Graphics } from 'pixi.js';
import type { ParticleKind } from './particles';
import type { BuildingDef } from './layout';
import { MAT } from './materials';

export interface Light {
  x: number; y: number;
  radius: number;
  color: number;
  /** brightness at night when idle (0..1) */
  base: number;
  /** extra brightness while dwarves work here */
  active: number;
  flicker?: boolean;
}

export interface Emitter {
  x: number; y: number;
  kind: ParticleKind;
  /** particles per second */
  rate: number;
  whenActive?: boolean;
}

export interface ArtResult {
  lights: Light[];
  emitters: Emitter[];
  /** per-frame animation hook (t = seconds, active = dwarves inside) */
  animate?: (t: number, active: number) => void;
  /** world y of the top of the building (for the name plate) */
  top: number;
  /** extra pieces that must be y-sorted separately (benches, carts…) */
  extras?: Container[];
}

export interface ArtCtx {
  g: Graphics;
  /** warm window light, faded in at night */
  lit: Graphics;
  b: BuildingDef;
  level: number;
  add: (child: Container) => void;
}


export const STONE = MAT.stone;
export const DARK_STONE = MAT.darkStone;
export const WOOD = MAT.wood;
export const PLASTER = MAT.plaster;
export const ROCK = MAT.rock;
/** Flat colors for small details where textures would be noise. */
export const WOOD_FLAT = { top: 0x9a6b45, left: 0x7a5236, right: 0x5c3d28 };
export const STONE_FLAT = { top: 0xb3ab9c, left: 0x8f887b, right: 0x6c665b };
export const WINDOW_LIT = 0xffd27a;
export const WINDOW_DARK = 0x2a2f3d;
