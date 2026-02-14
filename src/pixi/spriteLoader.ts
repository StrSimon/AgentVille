import { Texture } from 'pixi.js';

/** All sprite names that need loading */
const SPRITE_NAMES = [
  // Buildings
  'building-forge', 'building-library', 'building-arena',
  'building-guild', 'building-tower', 'building-campfire',
  // Dwarves
  'dwarf-idle', 'dwarf-working', 'dwarf-reading', 'dwarf-thinking',
  // Environment
  'ground-tile', 'path-segment',
  'rock-small', 'rock-crystal', 'rock-rune',
  'tree-pine', 'tree-dead',
  'lantern-post', 'lantern-hanging',
  // Props
  'prop-barrel', 'prop-crates', 'prop-minecart',
  'prop-mushroom', 'prop-well', 'prop-weapon-rack',
];

/** Skip all processing for these */
const SKIP_PROCESSING = new Set(['ground-tile']);

/**
 * Is this pixel "background-like"?
 * Catches white, light gray, checkerboard gray, near-white with JPEG artifacts.
 */
function isBgPixel(r: number, g: number, b: number, a: number): boolean {
  // Already transparent — not background
  if (a < 10) return false;
  // Achromatic (gray/white) and bright
  const achro = Math.abs(r - g) < 25 && Math.abs(g - b) < 25;
  if (achro && r > 160) return true;
  // Checkerboard pattern colors (light pink/gray transparency indicators)
  if (r > 180 && g > 180 && b > 180) return true;
  return false;
}

/**
 * Flood-fill background removal from image edges.
 * Only removes background-colored pixels that are CONNECTED to the border.
 * Preserves internal light pixels (dwarf eyes, skin, book pages).
 */
function removeBackground(img: HTMLImageElement): Texture {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // Track which pixels to clear
  const toClear = new Uint8Array(w * h);
  const queue: number[] = [];

  // Seed from all edge pixels
  for (let x = 0; x < w; x++) {
    queue.push(x); // top row
    queue.push((h - 1) * w + x); // bottom row
  }
  for (let y = 1; y < h - 1; y++) {
    queue.push(y * w); // left column
    queue.push(y * w + (w - 1)); // right column
  }

  // BFS flood fill
  while (queue.length > 0) {
    const idx = queue.pop()!;
    if (toClear[idx]) continue;

    const pi = idx * 4;
    const r = d[pi], g = d[pi + 1], b = d[pi + 2], a = d[pi + 3];

    if (!isBgPixel(r, g, b, a)) continue;

    toClear[idx] = 1;

    const x = idx % w;
    const y = (idx - x) / w;

    if (x > 0) queue.push(idx - 1);
    if (x < w - 1) queue.push(idx + 1);
    if (y > 0) queue.push(idx - w);
    if (y < h - 1) queue.push(idx + w);
  }

  // Clear background pixels
  for (let i = 0; i < toClear.length; i++) {
    if (toClear[i]) {
      d[i * 4 + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return Texture.from({ resource: canvas, alphaMode: 'premultiply-alpha-on-upload' });
}

/**
 * Load all sprites and process backgrounds.
 * Returns a Map<spriteName, Texture>.
 */
export async function loadAllSprites(): Promise<Map<string, Texture>> {
  const textures = new Map<string, Texture>();

  const entries = await Promise.all(
    SPRITE_NAMES.map(async (name) => {
      const url = `/sprites/${name}.png`;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
      });
      return { name, img };
    }),
  );

  for (const { name, img } of entries) {
    if (SKIP_PROCESSING.has(name)) {
      textures.set(name, Texture.from({ resource: img }));
    } else {
      textures.set(name, removeBackground(img));
    }
  }

  return textures;
}

/**
 * React hook that loads sprites once and returns { ready, textures }.
 */
import { useState, useEffect } from 'react';

export function useSpriteAssets() {
  const [state, setState] = useState<{
    ready: boolean;
    textures: Map<string, Texture>;
  }>({ ready: false, textures: new Map() });

  useEffect(() => {
    let cancelled = false;
    loadAllSprites().then(textures => {
      if (!cancelled) setState({ ready: true, textures });
    });
    return () => { cancelled = true; };
  }, []);

  return state;
}
