import { Container, Graphics } from 'pixi.js';
import { iso, rng, shade, TH, TW } from './iso';
import { MAT, paintFace } from './materials';
import { GRID, insideIsland } from './layout';

const GRASS_A = 0x3f7d3a;
const GRASS_B = 0x5a9a45;
const WATER = 0x2f6f9f;
const CLIFF_H = 54;

/** Static ground: island tiles, cliffs, roads, pond and the mountain. Cached as a texture. */
export function buildGround(paths: Set<string>): Container {
  const root = new Container({ label: 'ground' });
  const cliffs = new Graphics();
  const tiles = new Graphics();
  const detail = new Graphics();
  const r = rng(42);

  // Cliffs first (they hang below the island edge): rock strata under a band of soil
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (!insideIsland(gx, gy)) continue;
      const B = iso(gx + 1, gy), C = iso(gx + 1, gy + 1), D = iso(gx, gy + 1);
      const depth = CLIFF_H + ((gx * 7 + gy * 13) % 5) * 7;
      if (!insideIsland(gx, gy + 1)) {
        paintFace(cliffs, [D.x, D.y, C.x, C.y, C.x, C.y + depth, D.x, D.y + depth * 0.82], MAT.rock, 'left');
        paintFace(cliffs, [D.x, D.y, C.x, C.y, C.x, C.y + 15, D.x, D.y + 13], MAT.dirt, 'left');
        cliffs.poly([D.x, D.y - 1, C.x, C.y - 1, C.x, C.y + 4, D.x, D.y + 3]).fill({ color: GRASS_A, alpha: 0.95 });
      }
      if (!insideIsland(gx + 1, gy)) {
        paintFace(cliffs, [C.x, C.y, B.x, B.y, B.x, B.y + depth * 0.82, C.x, C.y + depth], MAT.rock, 'right');
        paintFace(cliffs, [C.x, C.y, B.x, B.y, B.x, B.y + 13, C.x, C.y + 15], MAT.dirt, 'right');
        cliffs.poly([C.x, C.y - 1, B.x, B.y - 1, B.x, B.y + 3, C.x, C.y + 4]).fill({ color: shade(GRASS_A, -0.2), alpha: 0.95 });
      }
    }
  }

  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (!insideIsland(gx, gy)) continue;
      const key = `${gx},${gy}`;
      const n = (Math.sin(gx * 0.55) + Math.cos(gy * 0.45) + Math.sin((gx + gy) * 0.3)) / 6 + 0.5;
      const top = iso(gx, gy), right = iso(gx + 1, gy), bottom = iso(gx + 1, gy + 1), left = iso(gx, gy + 1);
      const quad = [top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y];
      if (paths.has(key)) {
        paintFace(tiles, quad, MAT.cobble, 'top');
      } else {
        paintFace(tiles, quad, MAT.grass(GRASS_B), 'top');
        // large-scale meadow variation (sunny patches vs. shade)
        tiles.poly(quad).fill({ color: n > 0.5 ? 0xe8f59a : 0x24451f, alpha: Math.abs(n - 0.5) * 0.28 + r() * 0.03 });
        if (r() < 0.5) {
          const p = iso(gx + r(), gy + r());
          detail.poly([p.x - 3, p.y, p.x - 1, p.y - 6, p.x, p.y, p.x + 2, p.y - 5, p.x + 3, p.y]).fill({ color: shade(GRASS_B, 0.12), alpha: 0.7 });
        }
      }
    }
  }

  // Soft dirt shoulders where roads meet the meadow
  for (const key of paths) {
    const [gx, gy] = key.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (paths.has(`${gx + dx},${gy + dy}`) || !insideIsland(gx + dx, gy + dy)) continue;
      const a = iso(gx + (dx === 1 ? 1 : 0) + (dy !== 0 ? 0 : 0), gy + (dy === 1 ? 1 : 0));
      const b = dx !== 0 ? iso(gx + (dx === 1 ? 1 : 0), gy + 1) : iso(gx + 1, gy + (dy === 1 ? 1 : 0));
      detail.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 5, color: 0x5b4636, alpha: 0.45 });
    }
  }

  // Pond: an organic ellipse with a sandy shore instead of square tiles
  const pond = iso(6.5, 23.5);
  const pts = (rx: number, ry: number) => {
    const out: number[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3) * 0.06 + Math.cos(a * 5) * 0.04;
      out.push(pond.x + Math.cos(a) * rx * wob, pond.y + Math.sin(a) * ry * wob);
    }
    return out;
  };
  detail.poly(pts(TW * 2.15, TH * 2.0)).fill(0xc9b27c);
  detail.poly(pts(TW * 1.95, TH * 1.8)).fill(shade(WATER, -0.15));
  detail.poly(pts(TW * 1.6, TH * 1.45)).fill(WATER);
  detail.poly(pts(TW * 0.9, TH * 0.75)).fill({ color: 0xffffff, alpha: 0.06 });

  // Soft highlight on the plaza
  const plaza = iso(15.5, 15);
  detail.ellipse(plaza.x, plaza.y, TW * 2.6, TH * 2.6).fill({ color: 0xffe2b0, alpha: 0.05 });

  root.addChild(cliffs, tiles, detail, buildMountain());
  return root;
}

/** Rocky hill behind the mine (north-west corner). */
function buildMountain(): Graphics {
  const g = new Graphics();
  const peaks = [
    { gx: 1.5, gy: 4.5, h: 120, w: 2.8 },
    { gx: 3.5, gy: 3.2, h: 160, w: 3.2 },
    { gx: 6.0, gy: 2.4, h: 110, w: 2.4 },
    { gx: 1.0, gy: 8.0, h: 80, w: 2.0 },
  ];
  for (const p of peaks) {
    const base = iso(p.gx, p.gy);
    const half = p.w * TW * 0.42;
    const lit = [base.x - half, base.y + 10, base.x, base.y - p.h, base.x + half * 0.2, base.y + 16];
    const dark = [base.x + half * 0.2, base.y + 16, base.x, base.y - p.h, base.x + half, base.y + 8];
    paintFace(g, lit, MAT.rock, 'left', -0.05);
    paintFace(g, dark, MAT.rock, 'right', 0.05);
    // snow cap with a soft shaded side
    g.poly([base.x - half * 0.24, base.y - p.h * 0.7, base.x, base.y - p.h, base.x + 2, base.y - p.h * 0.76, base.x - half * 0.08, base.y - p.h * 0.66]).fill(0xf4f7fb);
    g.poly([base.x, base.y - p.h, base.x + half * 0.22, base.y - p.h * 0.69, base.x + 2, base.y - p.h * 0.76]).fill(0xc9d4e3);
  }
  return g;
}

/** Animated shimmer on the pond. */
export function buildWater(): Graphics {
  const g = new Graphics();
  for (let i = 0; i < 9; i++) {
    const p = iso(4.8 + (i % 3) * 1.1, 22.4 + Math.floor(i / 3) * 0.9);
    g.ellipse(p.x, p.y, 7, 1.6).fill({ color: 0xbfe6ff, alpha: 0.5 });
  }
  return g;
}
