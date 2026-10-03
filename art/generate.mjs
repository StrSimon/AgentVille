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

const jobs = fs.readFileSync(jobsFile, 'utf8').split('\n')
  .map(l => l.trim()).filter(Boolean)
  .map(l => ({ name: l.split('|')[0], desc: l.slice(l.indexOf('|') + 1) }))
  .filter(j => !only || only.includes(j.name))
  .filter(j => !fs.existsSync(path.join(DIR, `${j.name}.png`)));

function run({ name, desc }) {
  const prompt = `Use the imagegen skill with the built-in image_gen tool. ${name.startsWith('ground-') ? '' : 'Request a transparent background. '}Create ONE image and copy the final result into the current directory as ${name}.png. Prompt: ${STYLE}, ${name.startsWith('ground-') ? `create a ${desc}. ${TEXTURE}` : `create a single isolated game asset sprite: ${desc}. ${name.startsWith('dwarf-') ? FIGURE : CAMERA}`}`;
  return new Promise((resolve) => {
    const log = fs.openSync(path.join(DIR, `log-${name}.txt`), 'w');
    const child = spawn('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', DIR, `--image=${path.join(DIR, 'key-art.png')}`, prompt], { stdio: ['ignore', log, log] });
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
