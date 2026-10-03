// Painted dwarves (Codex image_gen sprites): one texture per pose, animated
// with squash, bob and sway so they feel alive without frame-by-frame art.
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Activity, Source } from '../types';
import type { SpriteSet } from './sprites';

export interface PaintedTextures { stand: Texture; walk: Texture; sit: Texture }

export interface PaintedParts {
  root: Container;
  body: Container;
  sprite: Sprite;
  ring: Graphics;
  shadow: Graphics;
  textures: PaintedTextures;
}

export type Pose = 'walk' | 'work' | 'alert' | 'bored' | 'idle' | 'sleep';

const HEIGHT = 56;

/** Painted textures for a look (see lib/variant); falls back to the clan's base look. */
export function paintedTextures(sprites: SpriteSet, look: string): PaintedTextures | null {
  const base = look.startsWith('claude') ? 'claude' : 'codex';
  const key = sprites[`dwarf-${look}-stand`] ? look : base;
  const stand = sprites[`dwarf-${key}-stand`];
  const walk = sprites[`dwarf-${key}-walk`] || stand;
  const sit = sprites[`dwarf-${key}-sit`] || stand;
  return stand ? { stand, walk, sit } : null;
}

export function buildPaintedDwarf(textures: PaintedTextures, source: Source, isSub: boolean): PaintedParts {
  const root = new Container();
  const ring = new Graphics();
  const shadow = new Graphics().ellipse(0, 0, 11, 4.5).fill({ color: 0x000000, alpha: 0.32 });
  const body = new Container();
  const sprite = new Sprite(textures.stand);
  sprite.anchor.set(0.5, 0.98);
  if (source === 'custom') sprite.tint = 0xa9c4ff;
  body.addChild(sprite);
  root.addChild(ring, shadow, body);
  root.scale.set(isSub ? 0.8 : 1);
  const parts = { root, body, sprite, ring, shadow, textures };
  setTexture(parts, textures.stand);
  return parts;
}

function setTexture(p: PaintedParts, tex: Texture): void {
  if (p.sprite.texture === tex) return;
  p.sprite.texture = tex;
  const s = HEIGHT / tex.height;
  p.sprite.scale.set(Math.sign(p.sprite.scale.x || 1) * s, s);
}

/** Per-frame pose animation. `facing` is -1 (left) or 1 (right). */
export function animatePainted(p: PaintedParts, pose: Pose, activity: Activity, t: number, seed: number, facing: number): void {
  const s = seed % 100;
  const sp = p.sprite;
  const tex = pose === 'walk' ? p.textures.walk
    : pose === 'bored' || pose === 'idle' || pose === 'sleep' ? p.textures.sit
      : p.textures.stand;
  setTexture(p, tex);
  // sprites are painted facing lower-left: flip to face right
  const base = HEIGHT / sp.texture.height;
  let sx = base, sy = base, rot = 0, y = 0;
  switch (pose) {
    case 'walk':
      y = -Math.abs(Math.sin(t * 12 + s)) * 2.4;
      rot = Math.sin(t * 12 + s) * 0.05;
      break;
    case 'work': {
      const swing = activity === 'coding' || activity === 'installing' || activity === 'testing';
      const k = Math.max(0, Math.sin(t * (swing ? 9 : 3) + s));
      // big wind-up and a squashy strike for tool work; a busy nod for desk work
      y = swing ? -k * 4.5 : -Math.abs(Math.sin(t * 2.6 + s)) * 1.6;
      sy = base * (1 - (swing ? (1 - k) * 0.09 : 0));
      sx = base * (1 + (swing ? (1 - k) * 0.06 : 0));
      rot = swing ? (0.5 - k) * 0.2 : Math.sin(t * 2.6 + s) * 0.05;
      break;
    }
    case 'alert':
      y = -Math.abs(Math.sin(t * 5)) * 4;
      rot = Math.sin(t * 9) * 0.06;
      break;
    case 'bored': {
      // breathing, an occasional big sigh and a look around
      const cycle = (t + s) % 9;
      sy = base * (1 + Math.sin(t * 2 + s) * 0.015 + (cycle < 1.2 ? Math.sin(cycle / 1.2 * Math.PI) * 0.05 : 0));
      rot = cycle > 5 && cycle < 6.5 ? 0.04 : 0;
      facing = Math.floor((t + s) / 4.5) % 2 ? -facing : facing;
      break;
    }
    case 'idle':
      sy = base * (1 + Math.sin(t * 1.6 + s) * 0.015);
      break;
    case 'sleep':
      sy = base * (1 + Math.sin(t * 1.1 + s) * 0.025);
      rot = 0.05;
      break;
  }
  sp.scale.set(facing > 0 ? -sx : sx, sy);
  sp.rotation = rot;
  p.body.y = y;
}
