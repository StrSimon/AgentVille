#!/usr/bin/env node
// Turn generated art (art/source/*.png) into compact game assets:
// trim transparent borders, resize, encode WebP with alpha, write a manifest.
// Usage: node art/build-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'art', 'source');
const OUT = path.join(ROOT, 'public', 'art');
const SPRITES = path.join(OUT, 'sprites');
fs.mkdirSync(SPRITES, { recursive: true });

const PROP = /^(tree-|bush|rock)/;
const manifest = {};

for (const file of fs.readdirSync(SRC).filter(f => f.endsWith('.png'))) {
  const name = file.replace(/\.png$/, '');
  const input = path.join(SRC, file);
  if (name === 'key-art') {
    await sharp(input).resize({ width: 1600 }).webp({ quality: 82 }).toFile(path.join(OUT, 'key-art.webp'));
    continue;
  }
  if (name.startsWith('ground-')) {
    // seamless ground textures: keep them square and opaque
    const out = await sharp(input).resize(512, 512).webp({ quality: 86 }).toFile(path.join(SPRITES, `${name}.webp`));
    manifest[name] = { width: out.width, height: out.height };
    console.log(`${name.padEnd(14)} ${out.width}×${out.height}  ${(out.size / 1024).toFixed(0)} KB`);
    continue;
  }
  const maxWidth = PROP.test(name) ? 280 : name === 'mountains' ? 900 : 720;
  const trimmed = await sharp(input).trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
  const out = await sharp(trimmed.data)
    .resize({ width: Math.min(maxWidth, trimmed.info.width), withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 90, effort: 5 })
    .toFile(path.join(SPRITES, `${name}.webp`));
  manifest[name] = { width: out.width, height: out.height };
  console.log(`${name.padEnd(14)} ${out.width}×${out.height}  ${(out.size / 1024).toFixed(0)} KB`);
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${Object.keys(manifest).length} sprites → public/art`);
