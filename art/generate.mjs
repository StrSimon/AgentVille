#!/usr/bin/env node
// Generate AgentVille art with Codex's built-in image_gen (uses your ChatGPT plan, no API key).
// Usage: node art/generate.mjs art/jobs.txt [--only=name,name] [--parallel=4]
// Each line in the jobs file: name|description. Existing images are skipped.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'source');
const args = process.argv.slice(2);
const jobsFile = args.find(a => !a.startsWith('--'));
const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',');
const parallel = Number(args.find(a => a.startsWith('--parallel='))?.slice(11) || 4);

const STYLE = 'Using the attached key art as the exact style, palette and lighting reference (painterly stylized realism like premium mobile strategy game art, warm golden-hour sunlight from the upper left, soft shadows falling to the lower right)';
const CAMERA = 'Classic isometric 2:1 game camera: the footprint is a square seen corner-on with its front corner pointing straight down at the bottom center; the whole object visible, centered, filling most of the frame. Fully transparent background (PNG with alpha), only a small patch of ground directly under it, no cast shadow beyond the footprint, no other objects, no characters, no text. Square 1:1.';

const FIGURE = 'Seen from the same elevated isometric game camera (looking down about 30 degrees). The full figure is centered with the feet at the bottom center of the frame. Fully transparent background (PNG with alpha), no ground, no shadow, no other objects, no text. Square 1:1.';

const TEXTURE = 'Seamless tileable texture seen straight from above (orthographic top-down, no perspective), evenly lit, no vignette, edges wrap perfectly in both directions, same painterly palette as the reference, no objects, no text. Square 1:1, opaque.';

const SHEET = 'Character sheet: exactly THREE full-body poses of this SAME character side by side from left to right, evenly spaced, identical scale and outfit: (1) standing relaxed, (2) walking mid-stride, (3) sitting on the ground looking bored with chin resting on one hand. All seen from the same elevated isometric game camera (looking down about 30 degrees), facing the lower left. Fully transparent background (PNG with alpha), no ground, no shadows, no text, no labels. Landscape 3:2.';
const PORTRAIT = 'Bust portrait card art of this character, shoulders up, three-quarter view, warm golden-hour rim light, softly blurred dwarf village background, rich painterly detail, no text, no frame. Portrait 3:4, opaque.';
const UPGRADE = 'Show the SAME building type as in the first attached image, upgraded as described, keeping its function and color scheme recognizable.';

function promptFor({ name, desc, ref }) {
  if (name.startsWith('ground-')) return `create a ${desc}. ${TEXTURE}`;
  if (name.startsWith('sheet-')) return `create a game character sprite sheet of ${desc}. ${SHEET}`;
  if (name.startsWith('portrait-')) return `create a portrait of ${desc}. ${PORTRAIT}`;
  const kind = name.startsWith('dwarf-') ? FIGURE : CAMERA;
  return `create a single isolated game asset sprite: ${desc}. ${ref ? UPGRADE : ''} ${kind}`;
}

const jobs = fs.readFileSync(jobsFile, 'utf8').split('\n')
  .map(l => l.trim()).filter(Boolean)
  .map(l => { const [name, desc, ref] = l.split('|'); return { name, desc, ref }; })
  .filter(j => !only || only.includes(j.name))
  .filter(j => !fs.existsSync(path.join(DIR, `${j.name}.png`)));

function run(job) {
  const { name, ref } = job;
  const opaque = name.startsWith('ground-') || name.startsWith('portrait-');
  const refNote = ref ? 'The FIRST attached image is the subject reference; the second is the style reference. ' : '';
  const prompt = `Use the imagegen skill with the built-in image_gen tool. ${opaque ? '' : 'Request a transparent background. '}Create ONE image and copy the final result into the current directory as ${name}.png. ${refNote}Prompt: ${STYLE}, ${promptFor(job)}`;
  const images = [...(ref ? [path.join(DIR, ref)] : []), path.join(DIR, 'key-art.png')].map(f => `--image=${f}`);
  return new Promise((resolve) => {
    const log = fs.openSync(path.join(DIR, `log-${name}.txt`), 'w');
    const child = spawn('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', DIR, ...images, prompt], { stdio: ['ignore', log, log] });
    child.on('close', () => {
      const ok = fs.existsSync(path.join(DIR, `${name}.png`));
      console.log(`${ok ? 'done  ' : 'FAILED'} ${name}`);
      resolve(ok);
    });
  });
}

const queue = [...jobs];
console.log(`${queue.length} images to generate (${parallel} at a time)`);
await Promise.all(Array.from({ length: parallel }, async () => {
  while (queue.length) await run(queue.shift());
}));
