import { extend } from '@pixi/react';
import {
  Container,
  Sprite,
  Graphics,
  TilingSprite,
  BlurFilter,
} from 'pixi.js';

// Register PixiJS classes for JSX usage:
// <pixiContainer>, <pixiSprite>, <pixiGraphics>, <pixiTilingSprite>
extend({ Container, Sprite, Graphics, TilingSprite, BlurFilter });

// ── Village constants ────────────────────────────────────

export const VILLAGE_W = 900;
export const VILLAGE_H = 700;
export const CENTER_X = 450;
export const CENTER_Y = 350;

// ── Decoration positions ─────────────────────────────────

export interface Decoration {
  sprite: string;
  x: number;
  y: number;
  w: number;
  sway?: boolean;
}

export const DECORATIONS: Decoration[] = [
  // ── Dense forest cluster (top-right) ──────────────────
  { sprite: 'tree-pine', x: 340, y: -280, w: 80, sway: true },
  { sprite: 'tree-pine', x: 380, y: -240, w: 65, sway: true },
  { sprite: 'tree-pine', x: 310, y: -230, w: 72, sway: true },
  { sprite: 'tree-pine', x: 360, y: -190, w: 58, sway: true },
  { sprite: 'tree-dead', x: 400, y: -300, w: 55, sway: true },
  { sprite: 'prop-mushroom', x: 325, y: -195, w: 22 },
  { sprite: 'prop-mushroom', x: 390, y: -210, w: 18 },

  // ── Forest edge (bottom-left) ─────────────────────────
  { sprite: 'tree-pine', x: -370, y: 210, w: 75, sway: true },
  { sprite: 'tree-pine', x: -340, y: 250, w: 68, sway: true },
  { sprite: 'tree-pine', x: -400, y: 270, w: 60, sway: true },
  { sprite: 'tree-dead', x: -310, y: 280, w: 52, sway: true },
  { sprite: 'tree-pine', x: -380, y: 300, w: 55, sway: true },
  { sprite: 'prop-mushroom', x: -350, y: 290, w: 20 },

  // ── Scattered trees (village edges) ───────────────────
  { sprite: 'tree-pine', x: -400, y: -260, w: 62, sway: true },
  { sprite: 'tree-pine', x: -420, y: -210, w: 50, sway: true },
  { sprite: 'tree-pine', x: 420, y: 200, w: 58, sway: true },
  { sprite: 'tree-dead', x: -430, y: 50, w: 48, sway: true },

  // ── Rock formation (near tower, bottom-right) ─────────
  { sprite: 'rock-crystal', x: 300, y: 190, w: 50 },
  { sprite: 'rock-small', x: 270, y: 210, w: 30 },
  { sprite: 'rock-small', x: 320, y: 220, w: 25 },

  // ── Rune stones (near guild, top-left) ────────────────
  { sprite: 'rock-rune', x: -300, y: -100, w: 48 },
  { sprite: 'rock-small', x: -280, y: -80, w: 28 },

  // ── Crystal outcrop (near library) ────────────────────
  { sprite: 'rock-crystal', x: -300, y: 150, w: 42 },
  { sprite: 'rock-small', x: -280, y: 170, w: 24 },

  // ── Scattered rocks ───────────────────────────────────
  { sprite: 'rock-small', x: -120, y: 280, w: 28 },
  { sprite: 'rock-small', x: 160, y: -260, w: 24 },
  { sprite: 'rock-small', x: -60, y: -290, w: 22 },

  // ── Lanterns along paths ──────────────────────────────
  { sprite: 'lantern-post', x: -100, y: -70, w: 30 },    // path to guild
  { sprite: 'lantern-post', x: 100, y: -50, w: 30 },     // path to forge
  { sprite: 'lantern-post', x: -100, y: 75, w: 30 },     // path to library
  { sprite: 'lantern-post', x: 100, y: 90, w: 30 },      // path to tower
  { sprite: 'lantern-post', x: 0, y: -120, w: 30 },      // path to arena
  { sprite: 'lantern-hanging', x: -30, y: 50, w: 28 },   // near campfire

  // ── Props near forge ──────────────────────────────────
  { sprite: 'prop-weapon-rack', x: 250, y: -120, w: 34 },
  { sprite: 'prop-barrel', x: 270, y: -55, w: 30 },
  { sprite: 'prop-barrel', x: 255, y: -45, w: 26 },

  // ── Props near guild ──────────────────────────────────
  { sprite: 'prop-crates', x: -250, y: -160, w: 34 },
  { sprite: 'prop-crates', x: -235, y: -145, w: 28 },

  // ── Minecart on path to forge ─────────────────────────
  { sprite: 'prop-minecart', x: 140, y: -35, w: 38 },

  // ── Village center (well + barrel) ────────────────────
  { sprite: 'prop-well', x: 50, y: 80, w: 48 },
  { sprite: 'prop-barrel', x: -45, y: 85, w: 24 },

  // ── Mushroom patch (forest floor) ─────────────────────
  { sprite: 'prop-mushroom', x: -360, y: 235, w: 26 },
  { sprite: 'prop-mushroom', x: 350, y: -255, w: 20 },
];

// ── Firefly config (seeded positions) ────────────────────

// Fireflies — clustered around forests and lanterns
const FIREFLY_ZONES = [
  // Forest top-right
  ...Array.from({ length: 8 }, (_, i) => ({
    x: CENTER_X + 310 + ((i * 23) % 120) - 60,
    y: CENTER_Y - 280 + ((i * 31) % 120),
  })),
  // Forest bottom-left
  ...Array.from({ length: 6 }, (_, i) => ({
    x: CENTER_X - 400 + ((i * 29) % 100),
    y: CENTER_Y + 210 + ((i * 17) % 100),
  })),
  // Village center (near lanterns)
  ...Array.from({ length: 6 }, (_, i) => ({
    x: CENTER_X - 80 + ((i * 37) % 160),
    y: CENTER_Y - 60 + ((i * 23) % 140),
  })),
  // Scattered
  ...Array.from({ length: 6 }, (_, i) => ({
    x: (15 + ((i * 41 + 7) % 70)) / 100 * VILLAGE_W,
    y: (15 + ((i * 29 + 13) % 70)) / 100 * VILLAGE_H,
  })),
];

export const FIREFLIES = FIREFLY_ZONES.map((pos, i) => ({
  ...pos,
  delay: (i * 0.53) % 5,
  speed: 0.0006 + (i % 5) * 0.0002,
  dx: ((i * 17) % 24) - 12,
  dy: ((i * 13) % 16) - 8,
  color: i % 5 < 3 ? 0xfbbf24 : i % 5 === 3 ? 0xfde68a : 0x86efac,
}));

// ── Dwarf sprite mapping ─────────────────────────────────

export const DWARF_SPRITE: Record<string, string> = {
  coding: 'dwarf-working',
  testing: 'dwarf-working',
  researching: 'dwarf-reading',
  reviewing: 'dwarf-reading',
  planning: 'dwarf-thinking',
  idle: 'dwarf-idle',
};

// ── Agent hash offset (same formula as AgentAvatar) ──────

export function agentOffset(id: string) {
  const hash =
    (id.charCodeAt(0) * 7 +
      id.charCodeAt(id.length - 1) * 13 +
      id.length * 3) %
    60 - 30;
  const hash2 =
    (id.charCodeAt(Math.floor(id.length / 2)) * 11 + id.length * 7) % 30 - 15;
  return { dx: hash, dy: 50 + Math.abs(hash2) };
}
