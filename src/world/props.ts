import { Container, FillGradient, Graphics, Sprite } from 'pixi.js';
import type { SpriteSet } from './sprites';
import { iso, rng, shade } from './iso';
import type { Prop } from './layout';

const PINE = 0x2c6a3a;
const OAK = 0x4f8f3c;
const TRUNK = 0x6b4a32;

const foliage = new Map<number, FillGradient>();

/** Radial "sun from the upper left" gradient for round canopies. */
function canopyFill(base: number): FillGradient {
  let f = foliage.get(base);
  if (!f) {
    f = new FillGradient({
      type: 'radial',
      center: { x: 0.32, y: 0.28 }, innerRadius: 0,
      outerCenter: { x: 0.45, y: 0.45 }, outerRadius: 0.75,
      colorStops: [
        { offset: 0, color: shade(base, 0.32) },
        { offset: 0.45, color: base },
        { offset: 1, color: shade(base, -0.45) },
      ],
    });
    foliage.set(base, f);
  }
  return f;
}

export interface PropView {
  root: Container;
  /** swaying part (tree crowns) */
  canopy?: Container;
  phase: number;
}

function pine(s: number, r: () => number): { trunk: Graphics; canopy: Container } {
  const trunk = new Graphics().rect(-2.5 * s, -12 * s, 5 * s, 14 * s).fill(TRUNK).rect(0.5 * s, -12 * s, 2 * s, 14 * s).fill(shade(TRUNK, -0.3));
  const canopy = new Container();
  const g = new Graphics();
  const tint = shade(PINE, (r() - 0.5) * 0.2);
  for (let i = 0; i < 4; i++) {
    const y = -10 * s - i * 11 * s, w = (19 - i * 4.2) * s, h = 22 * s;
    g.poly([-w, y, 0, y - h, 0, y + 2 * s]).fill(shade(tint, 0.12 - i * 0.02));
    g.poly([0, y + 2 * s, 0, y - h, w, y]).fill(shade(tint, -0.3));
    // needle highlights along the lit edge
    for (let k = 0; k < 3; k++) {
      const t = 0.25 + k * 0.22;
      g.moveTo(-w * t, y - h * (1 - t) * 0.95).lineTo(-w * t + 4 * s, y - h * (1 - t) * 0.95 + 2 * s)
        .stroke({ width: 1, color: shade(tint, 0.35), alpha: 0.5 });
    }
    g.poly([-w, y, 0, y + 2 * s, w, y, 0, y + 4 * s]).fill({ color: 0x0b1a10, alpha: 0.28 });
  }
  canopy.addChild(g);
  return { trunk, canopy };
}

function oak(s: number, r: () => number): { trunk: Graphics; canopy: Container } {
  const trunk = new Graphics();
  trunk.poly([-3.5 * s, 0, -2.5 * s, -18 * s, 2.5 * s, -18 * s, 3.5 * s, 0]).fill(TRUNK);
  trunk.poly([0.5 * s, 0, 0.8 * s, -18 * s, 2.5 * s, -18 * s, 3.5 * s, 0]).fill(shade(TRUNK, -0.3));
  const canopy = new Container();
  const g = new Graphics();
  const base = shade(OAK, (r() - 0.5) * 0.25);
  const blobs = [
    [-9, -24, 12], [9, -25, 11.5], [0, -36, 14], [-6, -42, 9], [7, -40, 9.5], [0, -27, 12],
  ];
  // dark under-layer gives depth between clumps
  g.ellipse(0, -28 * s, 21 * s, 17 * s).fill(shade(base, -0.5));
  for (const [x, y, rad] of blobs) {
    g.circle(x * s, y * s, rad * s).fill(canopyFill(base));
  }
  for (let i = 0; i < 6; i++) {
    g.circle((-10 + r() * 14) * s, (-44 + r() * 18) * s, (1.5 + r() * 2) * s).fill({ color: shade(base, 0.45), alpha: 0.55 });
  }
  canopy.addChild(g);
  return { trunk, canopy };
}

/** Build a decoration. Origin = where it touches the ground. */
const PAINTED: Partial<Record<Prop['kind'], { key: string; width: number }>> = {
  pine: { key: 'tree-pine', width: 46 },
  oak: { key: 'tree-oak', width: 54 },
  bush: { key: 'bush', width: 30 },
  rock: { key: 'rock', width: 26 },
};

export function drawProp(p: Prop, seed: number, sprites: SpriteSet = {}): PropView {
  const root = new Container();
  const s = p.s;
  const r = rng(seed);
  let canopy: Container | undefined;
  const painted = PAINTED[p.kind];
  if (painted && sprites[painted.key]) {
    const sprite = new Sprite(sprites[painted.key]);
    sprite.anchor.set(0.5, 0.97);
    sprite.scale.set((painted.width * s * (0.9 + r() * 0.2)) / sprite.texture.width);
    if (r() < 0.5) sprite.scale.x *= -1;
    const holder = new Container();
    holder.addChild(sprite);
    root.addChild(holder);
    if (p.kind === 'pine' || p.kind === 'oak') canopy = holder;
    const pos = iso(p.gx, p.gy);
    root.position.set(pos.x, pos.y);
    root.zIndex = pos.y;
    return { root, canopy, phase: r() * Math.PI * 2 };
  }
  switch (p.kind) {
    case 'pine':
    case 'oak': {
      const parts = p.kind === 'pine' ? pine(s, r) : oak(s, r);
      root.addChild(parts.trunk, parts.canopy);
      canopy = parts.canopy;
      break;
    }
    case 'bush': {
      const g = new Graphics();
      const base = shade(OAK, -0.1);
      g.ellipse(0, -4 * s, 12 * s, 7 * s).fill(shade(base, -0.45));
      g.circle(-5 * s, -6 * s, 7 * s).fill(canopyFill(base));
      g.circle(5 * s, -7 * s, 7 * s).fill(canopyFill(base));
      g.circle(0, -10 * s, 6 * s).fill(canopyFill(shade(base, 0.08)));
      if (r() < 0.5) for (let i = 0; i < 4; i++) g.circle((r() - 0.5) * 16 * s, (-4 - r() * 9) * s, 1.3).fill(r() < 0.5 ? 0xf472b6 : 0xfde68a);
      root.addChild(g);
      break;
    }
    case 'rock': {
      const g = new Graphics();
      g.poly([-11 * s, 0, -8 * s, -9 * s, 1 * s, -13 * s, 11 * s, -5 * s, 9 * s, 2 * s, -2 * s, 3 * s]).fill(0x858a98);
      g.poly([1 * s, -13 * s, 11 * s, -5 * s, 9 * s, 2 * s, 2 * s, -2 * s]).fill(0x5b606e);
      g.poly([-8 * s, -9 * s, 1 * s, -13 * s, 2 * s, -2 * s, -5 * s, -4 * s]).fill(0xa3a8b5);
      g.ellipse(-3 * s, -9 * s, 3 * s, 1.5 * s).fill({ color: 0x5a7a3a, alpha: 0.7 });
      root.addChild(g);
      break;
    }
    case 'flowers': {
      const g = new Graphics();
      const colors = [0xf472b6, 0xfde047, 0xffffff, 0xa78bfa, 0xfb7185];
      for (let i = 0; i < 7; i++) {
        const x = (r() - 0.5) * 18, y = (r() - 0.5) * 6;
        g.moveTo(x, y).lineTo(x + (r() - 0.5) * 2, y - 6).stroke({ width: 1, color: 0x3f7d3a });
        g.circle(x, y - 7, 1.9).fill(colors[i % colors.length]);
        g.circle(x - 0.5, y - 7.5, 0.7).fill({ color: 0xffffff, alpha: 0.6 });
      }
      root.addChild(g);
      break;
    }
    case 'mushroom': {
      const g = new Graphics();
      g.rect(-1.5, -5, 3, 5).fill(0xf5f0e1);
      g.ellipse(0, -6, 5.5, 3.8).fill(0xdc2626);
      g.ellipse(-1.5, -7, 2.5, 1.2).fill({ color: 0xffffff, alpha: 0.25 });
      g.circle(-2, -7, 0.9).fill(0xffffff).circle(1.8, -6.3, 0.8).fill(0xffffff);
      root.addChild(g);
      break;
    }
    case 'lantern': {
      const g = new Graphics();
      g.rect(-1.3, -26, 2.6, 26).fill(0x2d2a26).rect(0.3, -26, 1, 26).fill(0x1a1816);
      g.rect(-4.5, -33, 9, 9).fill(0x3b352e);
      g.rect(-3, -31.5, 6, 6).fill(0xffd27a);
      g.poly([-5.5, -33, 0, -37.5, 5.5, -33]).fill(0x2d2a26);
      g.ellipse(0, 1, 5, 2).fill({ color: 0x000000, alpha: 0.25 });
      root.addChild(g);
      break;
    }
  }
  const pos = iso(p.gx, p.gy);
  root.position.set(pos.x, pos.y);
  root.zIndex = pos.y;
  return { root, canopy, phase: r() * Math.PI * 2 };
}

/** World position of a lantern's light. */
export function lanternLight(p: Prop): { x: number; y: number } {
  const pos = iso(p.gx, p.gy);
  return { x: pos.x, y: pos.y - 28 };
}

/** Height (px) a prop casts a shadow from. */
export function propHeight(p: Prop): number {
  return p.kind === 'pine' ? 58 * p.s : p.kind === 'oak' ? 50 * p.s : p.kind === 'lantern' ? 30 : 0;
}
