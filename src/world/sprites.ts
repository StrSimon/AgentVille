// Painted sprites generated with Codex image_gen (see art/). Optional: the world
// falls back to procedural art for anything that isn't available.
import { Assets, type Texture } from 'pixi.js';

export type SpriteSet = Record<string, Texture>;

/** Load every sprite listed in /art/manifest.json; resolves to {} if art is missing. */
export async function loadSprites(): Promise<SpriteSet> {
  try {
    const res = await fetch('/art/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return {};
    const manifest = (await res.json()) as Record<string, { width: number; height: number }>;
    const names = Object.keys(manifest);
    const textures = await Promise.all(names.map(n => Assets.load<Texture>(`/art/sprites/${n}.webp`).catch(() => null)));
    const out: SpriteSet = {};
    names.forEach((n, i) => { if (textures[i]) out[n] = textures[i]!; });
    return out;
  } catch {
    return {};
  }
}

/**
 * How wide a building sprite is relative to its footprint (painted art includes
 * steps, bushes and eaves that overhang the grid footprint).
 */
export const SPRITE_FIT: Record<string, { width: number; lift?: number }> = {
  townhall: { width: 1.02 },
  forge: { width: 1.05 },
  arena: { width: 1.0 },
  library: { width: 1.02 },
  scriptorium: { width: 1.18 },
  guild: { width: 1.05 },
  apothecary: { width: 1.18 },
  observatory: { width: 1.18 },
  tower: { width: 1.2 },
  post: { width: 1.18 },
  mine: { width: 1.35 },
  gate: { width: 1.3 },
  well: { width: 1.9 },
  tavern: { width: 1.05 },
  campfire: { width: 2.3, lift: -4 },
};
