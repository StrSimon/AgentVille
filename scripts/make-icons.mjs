#!/usr/bin/env node
// Renders the AgentVille app + tray icons from SVG with resvg.
//   build/icon.png                 1024×1024 app icon (electron-builder derives .icns/.ico)
//   build/tray/trayTemplate.png    16px macOS menu-bar template (black on transparent)
//   build/tray/trayTemplate@2x.png 32px
//   build/tray/tray.png            32px coloured tray icon for Windows/Linux
// Run: npm run icons

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build');

const AMBER = '#f59e0b';
const AMBER_LIGHT = '#fcd34d';
const AMBER_DARK = '#b45309';

// ── isometric helpers ────────────────────────────────────
// World (u, v, h) → screen. u runs down-right, v down-left, h up.
const iso = (ox, oy, s) => (u, v, h = 0) => [ox + (u - v) * 0.866 * s, oy + (u + v) * 0.5 * s - h * s];
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="${fill}" ${extra}/>`;

/** An isometric cottage with a gabled roof and glowing windows. */
function house(P, { w, d, H, R, wall, wallDark, roof, roofDark }) {
  const o = 0.12; // roof overhang
  const back = poly([P(-o, -o, H), P(w + o, -o, H), P(w + o, d / 2, H + R), P(-o, d / 2, H + R)], roofDark);
  const left = poly([P(0, d, 0), P(w, d, 0), P(w, d, H), P(0, d, H)], wall);
  const right = poly([P(w, 0, 0), P(w, d, 0), P(w, d, H), P(w, d / 2, H + R), P(w, 0, H)], wallDark);
  const front = poly([P(-o, d / 2, H + R), P(w + o, d / 2, H + R), P(w + o, d + o, H - o), P(-o, d + o, H - o)], roof);
  const win1 = poly([P(w * 0.22, d, H * 0.28), P(w * 0.46, d, H * 0.28), P(w * 0.46, d, H * 0.7), P(w * 0.22, d, H * 0.7)], AMBER_LIGHT, 'filter="url(#glow)"');
  const win2 = poly([P(w * 0.6, d, H * 0.28), P(w * 0.82, d, H * 0.28), P(w * 0.82, d, H * 0.7), P(w * 0.6, d, H * 0.7)], AMBER_LIGHT, 'filter="url(#glow)"');
  const door = poly([P(w, d * 0.36, 0), P(w, d * 0.64, 0), P(w, d * 0.64, H * 0.62), P(w, d * 0.36, H * 0.62)], AMBER, 'filter="url(#glow)"');
  return back + left + right + front + win1 + win2 + door;
}

/** One pickaxe, drawn upright in local coordinates (handle along +y). */
function pickaxe({ head, handle, outline }) {
  const stroke = outline ? `stroke="${outline.color}" stroke-width="${outline.width}" stroke-linejoin="round"` : '';
  return `
    <rect x="-24" y="-190" width="48" height="430" rx="24" fill="${handle}" ${stroke}/>
    <path d="M-215,-110 Q0,-345 215,-110 Q0,-205 -215,-110 Z" fill="${head}" ${stroke}/>
    <rect x="-38" y="-212" width="76" height="62" rx="16" fill="${head}" ${stroke}/>`;
}

/** Crossed pickaxes; the second gets a dark outline so the crossing stays readable. */
function crossedPickaxes({ head, handle, outline }) {
  return `
    <g transform="rotate(-42)">${pickaxe({ head, handle })}</g>
    <g transform="scale(-1,1) rotate(-42)">${pickaxe({ head: outline.color, handle: outline.color, outline })}</g>
    <g transform="scale(-1,1) rotate(-42)">${pickaxe({ head, handle })}</g>`;
}

function appIconSvg() {
  const S = 1024;
  const IS = 255; // island scale
  const OY = 640; // island top corner
  const k = IS / 300;
  const P = iso(512, OY, IS);
  // Floating island: top face + two cliff sides.
  const top = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)].map(([x, y]) => [x, y]);
  const islandTop = poly(top, 'url(#grass)');
  const islandLeft = poly([P(0, 1), P(1, 1), P(1, 1, -0.32), P(0, 1, -0.32)], '#1b2a4e');
  const islandRight = poly([P(1, 0), P(1, 1), P(1, 1, -0.32), P(1, 0, -0.32)], '#131c3a');

  const H1 = iso(512 - 105 * k, OY + 70 * k, IS);
  const H2 = iso(512 + 95 * k, OY + 50 * k, IS);
  const cottageA = house((u, v, h) => H1(u * 0.36, v * 0.3, h * 0.42), { w: 1, d: 1, H: 0.62, R: 0.5, wall: '#c7b8e8', wallDark: '#8b7cc0', roof: '#7c3aed', roofDark: '#4c1d95' });
  const cottageB = house((u, v, h) => H2(u * 0.28, v * 0.26, h * 0.36), { w: 1, d: 1, H: 0.6, R: 0.55, wall: '#bfb2e3', wallDark: '#8273b8', roof: '#6d28d9', roofDark: '#3b1a7a' });

  const stars = [[210, 210, 5], [300, 150, 3.5], [790, 190, 4.5], [860, 300, 3], [170, 360, 3], [700, 120, 3], [880, 440, 3.5]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e0e7ff" opacity="0.8"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#0e1530"/>
      <stop offset="0.55" stop-color="#1e1b4b"/>
      <stop offset="1" stop-color="#3730a3"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.4" r="0.45">
      <stop offset="0" stop-color="#fbbf24" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${AMBER}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f6f62"/>
      <stop offset="1" stop-color="#1d4a4a"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.45"/>
    </filter>
    <clipPath id="squircle"><rect x="0" y="0" width="${S}" height="${S}" rx="225"/></clipPath>
  </defs>
  <g clip-path="url(#squircle)">
    <rect width="${S}" height="${S}" fill="url(#bg)"/>
    ${stars}
    <circle cx="512" cy="400" r="460" fill="url(#halo)"/>
    <g filter="url(#shadow)">${islandLeft}${islandRight}${islandTop}${cottageA}${cottageB}</g>
    <g transform="translate(512 372) scale(0.84)" filter="url(#shadow)">
      ${crossedPickaxes({ head: AMBER, handle: AMBER_DARK, outline: { color: '#1e1b4b', width: 26 } })}
    </g>
    <rect width="${S}" height="${S}" fill="url(#shine)"/>
  </g>
  <rect x="3" y="3" width="${S - 6}" height="${S - 6}" rx="222" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="6"/>
</svg>`;
}

/** Tray glyph: just the crossed pickaxes, bold enough for 16px. */
function traySvg(color) {
  // A transparent-coloured outline would not cut, so a mask separates the crossing.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-300 -300 600 600">
  <defs>
    <mask id="cut" maskUnits="userSpaceOnUse" x="-300" y="-300" width="600" height="600">
      <rect x="-300" y="-300" width="600" height="600" fill="#fff"/>
      <g transform="scale(-1,1) rotate(-42)">${pickaxe({ head: '#000', handle: '#000', outline: { color: '#000', width: 44 } })}</g>
    </mask>
  </defs>
  <g transform="scale(1.12)">
    <g mask="url(#cut)"><g transform="rotate(-42)">${pickaxe({ head: color, handle: color })}</g></g>
    <g transform="scale(-1,1) rotate(-42)">${pickaxe({ head: color, handle: color })}</g>
  </g>
</svg>`;
}

function render(svg, size, file) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' }).render().asPng();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log(`  ✔ ${path.relative(ROOT, file)} (${size}px)`);
}

render(appIconSvg(), 1024, path.join(OUT, 'icon.png'));
render(traySvg('#000'), 16, path.join(OUT, 'tray', 'trayTemplate.png'));
render(traySvg('#000'), 32, path.join(OUT, 'tray', 'trayTemplate@2x.png'));
render(traySvg(AMBER), 32, path.join(OUT, 'tray', 'tray.png'));
// Small previews to judge legibility (not packaged; delete afterwards).
if (process.argv.includes('--preview')) {
  for (const s of [16, 32, 64, 128]) render(appIconSvg(), s, path.join(OUT, 'preview', `icon-${s}.png`));
}
