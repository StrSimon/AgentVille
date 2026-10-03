#!/usr/bin/env node
// Turn generated art (art/source/*.png) into compact game assets in public/art:
// - sprites: trim transparent borders, resize, WebP with alpha
// - sheet-*: split a 3-pose character sheet into stand / walk / sit sprites
// - portrait-*: opaque portraits for the dwarf panel
// - ground-*: seamless square textures
// - buildings: an extra "-glow" mask of their lit windows and fires for the night
// Usage: node art/build-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'art', 'source');
const OUT = path.join(ROOT, 'public', 'art');
const SPRITES = path.join(OUT, 'sprites');
const PORTRAITS = path.join(OUT, 'portraits');
fs.mkdirSync(SPRITES, { recursive: true });
fs.mkdirSync(PORTRAITS, { recursive: true });

const PROP = /^(tree-|bush|rock|bench)/;
const BUILDINGS = new Set(['townhall', 'forge', 'arena', 'library', 'scriptorium', 'guild', 'apothecary', 'observatory', 'tower', 'post', 'mine', 'gate', 'well', 'tavern', 'campfire']);
const manifest = {};
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function sprite(input, name, maxWidth) {
  const trimmed = await sharp(input).trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
  const out = await sharp(trimmed.data)
    .resize({ width: Math.min(maxWidth, trimmed.info.width), withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 90, effort: 5 })
    .toFile(path.join(SPRITES, `${name}.webp`));
  manifest[name] = { width: out.width, height: out.height };
  console.log(`${name.padEnd(26)} ${out.width}×${out.height}  ${kb(out.size)}`);
  return trimmed;
}

/** Bright, warm pixels (windows, fires, lanterns) become an additive night-light mask. */
async function glowMask(trimmed, name, maxWidth) {
  const { data, info } = await sharp(trimmed.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const warm = r > 215 && g > 160 && b < 140 && r - b > 100;
    const glow = a > 200 && (warm || (r > 140 && b > 170 && g < 140 && b - g > 60)); // amber light or violet magic
    const k = glow ? Math.min(255, ((r + g) / 2 - 110) * 2) : 0;
    if (k > 0) lit++;
    out[i] = r; out[i + 1] = g; out[i + 2] = Math.min(255, b + 20); out[i + 3] = Math.max(0, k);
  }
  if (lit < 40) return;
  const res = await sharp(out, { raw: info })
    .blur(1.2)
    .resize({ width: Math.min(maxWidth, info.width), withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 80 })
    .toFile(path.join(SPRITES, `${name}-glow.webp`));
  manifest[`${name}-glow`] = { width: res.width, height: res.height };
}

/** Split a sheet at the empty columns between figures. */
async function splitSheet(input, base) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cols = new Array(info.width).fill(0);
  for (let x = 0; x < info.width; x++) {
    for (let y = 0; y < info.height; y += 2) if (data[(y * info.width + x) * 4 + 3] > 24) { cols[x]++; }
  }
  const runs = [];
  let start = -1;
  cols.forEach((c, x) => {
    if (c > 0 && start < 0) start = x;
    if ((c === 0 || x === cols.length - 1) && start >= 0) { runs.push([start, x]); start = -1; }
  });
  let figures = runs.filter(([a, b]) => b - a > 40);
  // figures touching each other: split the widest block at its thinnest column
  while (figures.length < 3 && figures.length > 0) {
    figures.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    const [a, b] = figures.shift();
    let cut = a + Math.floor((b - a) / 2), min = Infinity;
    for (let x = a + Math.floor((b - a) * 0.3); x < a + Math.floor((b - a) * 0.7); x++) if (cols[x] < min) { min = cols[x]; cut = x; }
    figures.push([a, cut], [cut + 1, b]);
  }
  figures = figures.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0])).slice(0, 3).sort((p, q) => p[0] - q[0]);
  if (figures.length < 3) { console.log(`! ${base}: found ${figures.length} figures, expected 3`); return; }
  for (const [i, pose] of ['stand', 'walk', 'sit'].entries()) {
    const [a, b] = figures[i];
    const crop = await sharp(input).extract({ left: Math.max(0, a - 4), top: 0, width: Math.min(info.width - a + 4, b - a + 8), height: info.height }).toBuffer();
    await sprite(crop, `${base}-${pose}`, 240);
  }
}

for (const file of fs.readdirSync(SRC).filter(f => f.endsWith('.png'))) {
  const name = file.replace(/\.png$/, '');
  const input = path.join(SRC, file);
  if (name === 'key-art') {
    await sharp(input).resize({ width: 1600 }).webp({ quality: 82 }).toFile(path.join(OUT, 'key-art.webp'));
  } else if (name.startsWith('ground-')) {
    const out = await sharp(input).resize(512, 512).webp({ quality: 86 }).toFile(path.join(SPRITES, `${name}.webp`));
    manifest[name] = { width: out.width, height: out.height };
  } else if (name.startsWith('sheet-')) {
    await splitSheet(input, name.replace(/^sheet-/, 'dwarf-'));
  } else if (name.startsWith('portrait-')) {
    const out = await sharp(input).resize({ width: 384 }).webp({ quality: 84 }).toFile(path.join(PORTRAITS, `${name}.webp`));
    console.log(`${name.padEnd(26)} portrait ${kb(out.size)}`);
  } else {
    const maxWidth = PROP.test(name) ? 280 : name === 'mountains' ? 900 : name.startsWith('dwarf-') ? 240 : 640;
    const trimmed = await sprite(input, name, maxWidth);
    if (BUILDINGS.has(name.replace(/-t[23]$/, ''))) await glowMask(trimmed, name, maxWidth);
  }
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${Object.keys(manifest).length} sprites → public/art`);
