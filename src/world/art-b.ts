// Building art, part 2: scriptorium, observatory, tower, post, mine, gate, apothecary.
import { Graphics } from 'pixi.js';
import { gableRoof, hipRoof, iso, leftFaceRect, prism, TW, windowFace } from './iso';
import { DARK_STONE, PLASTER, STONE, WINDOW_LIT, WOOD, type ArtCtx, type ArtResult } from './art-types';
import { leftFacePoint } from './art-a';

export function scriptorium({ g, b, lit }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx + 0.2, gy + 0.2, w - 0.4, d - 0.4, 62, PLASTER);
  for (const z of [12, 38]) windowFace(g, lit, 'left', gx + 0.2, gy + 0.2, w - 0.4, d - 0.4, 0.5, z, 9, 15);
  windowFace(g, lit, 'right', gx + 0.2, gy + 0.2, w - 0.4, d - 0.4, 0.5, 30, 8, 14);
  hipRoof(g, gx + 0.2, gy + 0.2, w - 0.4, d - 0.4, 62, 52, 0x9d3f8f);
  // quill sign
  const p = leftFacePoint(gx + 0.2, gy + 0.2, w - 0.4, d - 0.4, 0.92, 26);
  g.poly([p.x + 4, p.y, p.x + 16, p.y - 16, p.x + 13, p.y + 1]).fill(0xf5ecd6);
  const top = iso(gx + w / 2, gy + d / 2);
  const window = leftFacePoint(gx + 0.2, gy + 0.2, w - 0.4, d - 0.4, 0.5, 44);
  return {
    lights: [{ x: window.x, y: window.y, radius: 34, color: WINDOW_LIT, base: 0.6, active: 0.4 }],
    emitters: [{ x: window.x, y: window.y - 6, kind: 'magic', rate: 5, whenActive: true }],
    top: top.y - 130,
  };
}

export function observatory({ g, b, add }: ArtCtx): ArtResult {
  const c = iso(b.gx + b.w / 2, b.gy + b.d / 2);
  const rx = TW * 0.8, ry = rx / 2, h = 34;
  g.ellipse(c.x, c.y, rx, ry).fill(0x6c665b);
  g.rect(c.x - rx, c.y - h, rx * 2, h).fill(0x8f887b);
  g.ellipse(c.x, c.y - h, rx, ry).fill(0xa49e92);
  g.roundRect(c.x - 6, c.y - 18, 12, 18, 6).fill(0x3b2f25);
  // dome
  g.moveTo(c.x - rx * 0.86, c.y - h).arc(c.x, c.y - h, rx * 0.86, Math.PI, 0).closePath().fill(0x5b7aa8);
  g.moveTo(c.x - rx * 0.86, c.y - h).arc(c.x, c.y - h, rx * 0.86, Math.PI, Math.PI * 1.45).lineTo(c.x, c.y - h).closePath().fill({ color: 0xffffff, alpha: 0.12 });
  g.rect(c.x - 4, c.y - h - rx * 0.84, 8, rx * 0.84).fill(0x1d2433);
  const scope = new Graphics().roundRect(-3, -34, 6, 34, 3).fill(0xc9a96e).circle(0, -34, 4).fill(0x8a6a3a);
  scope.position.set(c.x, c.y - h - 10);
  add(scope);
  return {
    lights: [{ x: c.x, y: c.y - h - 20, radius: 50, color: 0x7dd3fc, base: 0.35, active: 0.5 }],
    emitters: [{ x: c.x, y: c.y - h - 44, kind: 'magic', rate: 3, whenActive: true }],
    animate: (t, active) => { scope.rotation = -0.6 + Math.sin(t * (active ? 0.9 : 0.2)) * 0.5; },
    top: c.y - h - rx - 30,
  };
}

export function tower({ g, b, level, add, lit }: ArtCtx): ArtResult {
  const { gx, gy } = b;
  const h = 96 + Math.min(level, 6) * 4;
  prism(g, gx + 0.25, gy + 0.25, 1.5, 1.5, h, STONE);
  for (const z of [20, 52]) leftFaceRect(g, gx + 0.25, gy + 0.25, 1.5, 1.5, 0.5, z, 5, 12, 0x1d2433);
  windowFace(g, lit, 'left', gx + 0.25, gy + 0.25, 1.5, 1.5, 0.5, 80, 7, 12);
  prism(g, gx, gy, 2, 2, 8, STONE, h);
  for (const [x, y] of [[0, 0], [1.6, 0], [0, 1.6], [1.6, 1.6], [0.8, 1.6], [1.6, 0.8]]) prism(g, gx + x, gy + y, 0.4, 0.4, 8, STONE, h + 8);
  const top = iso(gx + 1, gy + 1);
  const pole = { x: top.x + 10, y: top.y - h - 8 };
  g.rect(pole.x - 0.8, pole.y - 36, 1.6, 36).fill(0x3b2f25);
  const flag = new Graphics().poly([0, 0, 18, 4, 0, 10]).fill(0xfacc15);
  flag.position.set(pole.x, pole.y - 36);
  add(flag);
  const brazier = { x: top.x - 6, y: top.y - h - 10 };
  g.ellipse(brazier.x, brazier.y, 7, 3.5).fill(0x3a3d45);
  return {
    lights: [
      { x: brazier.x, y: brazier.y - 8, radius: 90, color: 0xffc24a, base: 0.25, active: 0.9, flicker: true },
      { x: top.x, y: top.y - 86, radius: 22, color: WINDOW_LIT, base: 0.6, active: 0 },
    ],
    emitters: [{ x: brazier.x, y: brazier.y - 2, kind: 'fire', rate: 14, whenActive: true }],
    animate: (t) => { flag.scale.x = 0.8 + Math.sin(t * 4) * 0.2; },
    top: pole.y - 50,
  };
}

export function post({ g, b, add, lit }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx, gy, w, d, 32, WOOD);
  for (const t of [0.25, 0.75]) windowFace(g, lit, 'left', gx, gy, w, d, t, 12, 10, 12);
  leftFaceRect(g, gx, gy, w, d, 0.5, 0, 12, 20, 0x3b2718);
  gableRoof(g, gx, gy, w, d, 32, 22, 0xd97706);
  const box = iso(gx + w + 0.3, gy + d - 0.2);
  prism(g, gx + w + 0.15, gy + d - 0.45, 0.35, 0.35, 16, { top: 0xef4444, left: 0xdc2626, right: 0xb91c1c });
  g.rect(box.x - 0.8, box.y - 2, 1.6, 4).fill(0x3b2f25);
  // parcels
  const pc = iso(gx - 0.2, gy + d + 0.3);
  g.rect(pc.x - 8, pc.y - 8, 10, 8).fill(0xc9a96e);
  g.rect(pc.x - 2, pc.y - 14, 9, 7).fill(0xb08458);
  // a raven that takes off while commits fly out
  const bird = new Graphics().poly([-6, 0, 0, -3, 6, 0, 0, -1]).fill(0x111827);
  const roof = iso(gx + w / 2, gy + d / 2);
  bird.position.set(roof.x, roof.y - 60);
  add(bird);
  return {
    lights: [{ x: roof.x - 16, y: roof.y - 6, radius: 32, color: WINDOW_LIT, base: 0.55, active: 0.3 }],
    emitters: [],
    animate: (t, active) => {
      if (active) {
        bird.position.set(roof.x + Math.cos(t * 1.4) * 46, roof.y - 80 + Math.sin(t * 1.4) * 14);
        bird.scale.y = 0.6 + Math.abs(Math.sin(t * 12)) * 0.8;
      } else {
        bird.position.set(roof.x, roof.y - 58);
        bird.scale.y = 1;
      }
    },
    top: roof.y - 96,
  };
}

export function mine({ g, b, add }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx, gy, w, d, 44, { top: 0x6b707e, left: 0x585c69, right: 0x434651 });
  prism(g, gx + 0.3, gy - 0.4, 1.4, 0.8, 26, { top: 0x7c8190, left: 0x5c6170, right: 0x474a55 }, 44);
  leftFaceRect(g, gx, gy, w, d, 0.5, 0, 30, 32, 0x0d0f14);
  leftFaceRect(g, gx, gy, w, d, 0.5, 30, 36, 5, 0x6b4a32);
  for (const t of [0.24, 0.76]) leftFaceRect(g, gx, gy, w, d, t, 0, 4, 34, 0x6b4a32);
  // rails toward the plaza
  const start = iso(gx + 1, gy + d), end = iso(gx + 1, gy + d + 1.8);
  for (const off of [-5, 5]) g.moveTo(start.x + off, start.y).lineTo(end.x + off, end.y).stroke({ width: 1.5, color: 0x9ca3af });
  for (let i = 0; i < 6; i++) {
    const k = i / 5;
    g.rect(start.x + (end.x - start.x) * k - 8, start.y + (end.y - start.y) * k - 1, 16, 2).fill(0x5c3d28);
  }
  const cart = new Graphics();
  cart.poly([-10, -12, 10, -12, 8, 0, -8, 0]).fill(0x52525b);
  cart.poly([-8, -12, 8, -12, 6, -17, -6, -17]).fill(0xfacc15);
  cart.circle(-6, 1, 3).fill(0x27272a).circle(6, 1, 3).fill(0x27272a);
  add(cart);
  const lamp = leftFacePoint(gx, gy, w, d, 0.82, 36);
  g.rect(lamp.x - 2, lamp.y - 4, 4, 5).fill(0xffd27a);
  return {
    lights: [{ x: lamp.x, y: lamp.y, radius: 46, color: 0xffd27a, base: 0.8, active: 0.2, flicker: true }],
    emitters: [{ x: start.x, y: start.y - 18, kind: 'sparks', rate: 4, whenActive: true }],
    animate: (t, active) => {
      const k = active ? (Math.sin(t * 1.2) + 1) / 2 : 0.1;
      cart.position.set(start.x + (end.x - start.x) * k, start.y + (end.y - start.y) * k);
    },
    top: iso(gx + 1, gy + 1).y - 110,
  };
}

export function gate({ g, b, add }: ArtCtx): ArtResult {
  const { gx, gy } = b;
  prism(g, gx, gy, 0.5, 0.6, 70, DARK_STONE);
  prism(g, gx + 1.5, gy, 0.5, 0.6, 70, DARK_STONE);
  prism(g, gx - 0.1, gy - 0.05, 2.2, 0.7, 12, STONE, 70);
  const c = iso(gx + 1, gy + 0.3);
  const ring = new Graphics();
  ring.ellipse(0, 0, 18, 28).stroke({ width: 4, color: 0xc084fc });
  ring.ellipse(0, 0, 12, 20).fill({ color: 0xe9d5ff, alpha: 0.35 });
  ring.position.set(c.x, c.y - 36);
  ring.blendMode = 'add';
  add(ring);
  for (const dx of [-26, 26]) {
    g.circle(c.x + dx, c.y - 64, 3).fill(0xc084fc);
  }
  return {
    lights: [{ x: c.x, y: c.y - 36, radius: 70, color: 0xc084fc, base: 0.45, active: 0.6 }],
    emitters: [{ x: c.x, y: c.y - 30, kind: 'portal', rate: 1.5 }, { x: c.x, y: c.y - 30, kind: 'portal', rate: 18, whenActive: true }],
    animate: (t, active) => {
      ring.alpha = 0.5 + Math.sin(t * 3) * 0.2 + (active ? 0.3 : 0);
      ring.scale.set(1 + Math.sin(t * (active ? 6 : 2)) * 0.05);
    },
    top: c.y - 110,
  };
}

export function apothecary({ g, b }: ArtCtx): ArtResult {
  const { gx, gy, w, d } = b;
  prism(g, gx, gy, w, d, 28, WOOD);
  leftFaceRect(g, gx, gy, w, d, 0.3, 10, 10, 11, 0xbef264, 0.85);
  leftFaceRect(g, gx, gy, w, d, 0.72, 0, 11, 18, 0x3b2718);
  gableRoof(g, gx, gy, w, d, 28, 22, 0x4d7c2f);
  // herbs under the eaves
  const e = leftFacePoint(gx, gy, w, d, 0.5, 30);
  for (let i = 0; i < 4; i++) g.ellipse(e.x - 14 + i * 9, e.y + 6, 2.5, 5).fill(i % 2 ? 0x65a30d : 0x84cc16);
  // cauldron
  const c = iso(gx + w + 0.35, gy + d + 0.2);
  g.ellipse(c.x, c.y - 2, 12, 6).fill(0x1f2937);
  g.ellipse(c.x, c.y - 8, 11, 5).fill(0x374151);
  g.ellipse(c.x, c.y - 9, 8.5, 3.5).fill(0x84cc16);
  return {
    lights: [{ x: c.x, y: c.y - 12, radius: 46, color: 0xa3e635, base: 0.45, active: 0.6 }],
    emitters: [{ x: c.x, y: c.y - 10, kind: 'bubbles', rate: 1.5 }, { x: c.x, y: c.y - 10, kind: 'bubbles', rate: 10, whenActive: true }],
    top: iso(gx + 1, gy + 1).y - 84,
  };
}
