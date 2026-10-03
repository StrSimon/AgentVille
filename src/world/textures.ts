// Procedural, seamless material textures (drawn once on a 2D canvas).
// Every painter draws wrapped at the tile edges so patterns tile without seams.
import { Texture } from 'pixi.js';
import { rng } from './iso';

const SIZE = 128;
const cache = new Map<string, Texture>();

/** Painted ground textures (Codex image_gen) replace the procedural ones when available. */
const painted: { grass?: Texture; cobble?: Texture } = {};

export function usePaintedGround(grass?: Texture, cobble?: Texture): void {
  for (const t of [grass, cobble]) if (t) t.source.addressMode = 'repeat';
  painted.grass = grass;
  painted.cobble = cobble;
}

type Ctx = CanvasRenderingContext2D;

function hex(c: number, a = 1): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}

function vary(c: number, amt: number, r: () => number): number {
  const k = (r() - 0.5) * 2 * amt;
  const ch = (sh: number) => Math.max(0, Math.min(255, Math.round(((c >> sh) & 255) * (1 + k))));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Multiply a color's channels by f (f < 1 darkens, f > 1 lightens). */
function scale(c: number, f: number): number {
  const ch = (sh: number) => Math.max(0, Math.min(255, Math.round(((c >> sh) & 255) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Draw fn at (x, y) and its wrapped copies so the texture tiles seamlessly. */
function wrap(x: number, y: number, pad: number, fn: (x: number, y: number) => void): void {
  for (const dx of [0, -SIZE, SIZE]) {
    for (const dy of [0, -SIZE, SIZE]) {
      const nx = x + dx, ny = y + dy;
      if (nx > -pad && nx < SIZE + pad && ny > -pad && ny < SIZE + pad) fn(nx, ny);
    }
  }
}

function make(key: string, paint: (ctx: Ctx, r: () => number) => void, seed = 1): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  paint(ctx, rng(seed));
  const tex = Texture.from(canvas);
  tex.source.addressMode = 'repeat';
  tex.source.scaleMode = 'linear';
  cache.set(key, tex);
  return tex;
}

function noise(ctx: Ctx, r: () => number, color: number, count: number, size: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const x = r() * SIZE, y = r() * SIZE, s = size * (0.5 + r());
    ctx.fillStyle = hex(vary(color, 0.35, r), alpha * (0.4 + r() * 0.6));
    wrap(x, y, s, (px, py) => ctx.fillRect(px, py, s, s));
  }
}

export function grassTexture(base: number): Texture {
  if (painted.grass) return painted.grass;
  return make(`grass-${base}`, (ctx, r) => {
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, SIZE, SIZE);
    // soft mottling
    for (let i = 0; i < 26; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 10 + r() * 22;
      const c = vary(base, 0.18, r);
      wrap(x, y, rad, (px, py) => {
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, hex(c, 0.5));
        g.addColorStop(1, hex(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
    noise(ctx, r, base, 900, 1.4, 0.55);
    // blades
    ctx.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const x = r() * SIZE, y = r() * SIZE, h = 2 + r() * 4, lean = (r() - 0.5) * 2;
      ctx.strokeStyle = hex(vary(base, 0.45, r), 0.6);
      wrap(x, y, 6, (px, py) => { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + lean, py - h); ctx.stroke(); });
    }
  }, base);
}

export function cobbleTexture(): Texture {
  if (painted.cobble) return painted.cobble;
  return make('cobble', (ctx, r) => {
    ctx.fillStyle = '#5d564c';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const cell = 16;
    for (let gy = 0; gy < SIZE / cell; gy++) {
      for (let gx = 0; gx < SIZE / cell; gx++) {
        const cx = gx * cell + cell / 2 + (r() - 0.5) * 5 + (gy % 2) * 4;
        const cy = gy * cell + cell / 2 + (r() - 0.5) * 5;
        const rx = cell * (0.38 + r() * 0.1), ry = cell * (0.36 + r() * 0.1);
        const c = vary(0xa49a8a, 0.16, r);
        wrap(cx, cy, cell, (px, py) => {
          const g = ctx.createRadialGradient(px - rx * 0.35, py - ry * 0.4, 1, px, py, rx * 1.2);
          g.addColorStop(0, hex(vary(c, 0.1, r)));
          g.addColorStop(0.7, hex(c));
          g.addColorStop(1, hex(scale(c, 0.7)));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, (r() - 0.5) * 0.6, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    noise(ctx, r, 0x8a8070, 300, 1, 0.35);
  }, 11);
}

export function stoneWallTexture(base = 0x9c9486): Texture {
  return make(`wall-${base}`, (ctx, r) => {
    ctx.fillStyle = hex(scale(base, 0.55));
    ctx.fillRect(0, 0, SIZE, SIZE);
    const rowH = 14;
    for (let row = 0; row < SIZE / rowH; row++) {
      let x = row % 2 ? -10 : 0;
      while (x < SIZE) {
        const w = 18 + r() * 16;
        const c = vary(base, 0.2, r);
        const y = row * rowH;
        wrap(x + w / 2, y + rowH / 2, 30, (px, py) => {
          const g = ctx.createLinearGradient(0, py - rowH / 2, 0, py + rowH / 2);
          g.addColorStop(0, hex(scale(c, 1.12)));
          g.addColorStop(1, hex(scale(c, 0.8)));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(px - w / 2 + 1, py - rowH / 2 + 1, w - 2, rowH - 2, 2.5);
          ctx.fill();
        });
        x += w;
      }
    }
    noise(ctx, r, base, 500, 1, 0.3);
  }, base);
}

export function plasterTexture(base = 0xe2d4b6): Texture {
  return make(`plaster-${base}`, (ctx, r) => {
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, SIZE, SIZE);
    noise(ctx, r, base, 1400, 1.2, 0.45);
    for (let i = 0; i < 10; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 12 + r() * 20;
      wrap(x, y, rad, (px, py) => {
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, hex(scale(base, 0.88), 0.35));
        g.addColorStop(1, hex(base, 0));
        ctx.fillStyle = g;
        ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
  }, base);
}

export function woodTexture(base = 0x8a5c3a): Texture {
  return make(`wood-${base}`, (ctx, r) => {
    const plank = 16;
    for (let i = 0; i < SIZE / plank; i++) {
      const c = vary(base, 0.15, r);
      ctx.fillStyle = hex(c);
      ctx.fillRect(i * plank, 0, plank, SIZE);
      ctx.strokeStyle = hex(scale(c, 0.75), 0.55);
      for (let k = 0; k < 4; k++) {
        const x = i * plank + 2 + r() * (plank - 4);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= SIZE; y += 16) ctx.lineTo(x + Math.sin(y * 0.08 + i) * 1.2, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(20,10,5,0.55)';
      ctx.fillRect(i * plank, 0, 1.2, SIZE);
    }
  }, base);
}

export function shingleTexture(base: number): Texture {
  return make(`shingle-${base}`, (ctx, r) => {
    ctx.fillStyle = hex(scale(base, 0.5));
    ctx.fillRect(0, 0, SIZE, SIZE);
    const rowH = 10, w = 14;
    for (let row = 0; row < SIZE / rowH; row++) {
      for (let x = (row % 2) * -w / 2; x < SIZE + w; x += w) {
        const c = vary(base, 0.16, r);
        const y = row * rowH;
        wrap(x, y, w, (px, py) => {
          const g = ctx.createLinearGradient(0, py, 0, py + rowH + 3);
          g.addColorStop(0, hex(scale(c, 1.18)));
          g.addColorStop(0.75, hex(c));
          g.addColorStop(1, hex(scale(c, 0.55)));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(px + 0.5, py, w - 1, rowH + 3, [0, 0, 5, 5]);
          ctx.fill();
        });
      }
    }
  }, base);
}

export function rockTexture(base = 0x6e6a66): Texture {
  return make(`rock-${base}`, (ctx, r) => {
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, SIZE, SIZE);
    // strata
    for (let y = 0; y < SIZE; y += 6 + r() * 8) {
      ctx.fillStyle = hex(vary(base, 0.28, r), 0.7);
      ctx.fillRect(0, y, SIZE, 2 + r() * 5);
    }
    noise(ctx, r, base, 700, 1.6, 0.5);
    ctx.strokeStyle = 'rgba(15,12,10,0.45)';
    for (let i = 0; i < 14; i++) {
      const x = r() * SIZE, y = r() * SIZE;
      ctx.lineWidth = 0.8;
      wrap(x, y, 20, (px, py) => {
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.lineTo(px + (r() - 0.5) * 14, py + 4 + r() * 10);
        ctx.lineTo(px + (r() - 0.5) * 18, py + 12 + r() * 10);
        ctx.stroke();
      });
    }
  }, base);
}

export function dirtTexture(base = 0x6b4a33): Texture {
  return make(`dirt-${base}`, (ctx, r) => {
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, SIZE, SIZE);
    noise(ctx, r, base, 1100, 1.5, 0.6);
    for (let i = 0; i < 40; i++) {
      const x = r() * SIZE, y = r() * SIZE;
      ctx.fillStyle = hex(vary(0x8f8576, 0.2, r), 0.8);
      wrap(x, y, 4, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, 1.5 + r() * 2, 1 + r() * 1.5, 0, 0, Math.PI * 2); ctx.fill(); });
    }
  }, base);
}
