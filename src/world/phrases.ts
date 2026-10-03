import type { Activity } from '../types';

const LINES: Record<Activity, string[]> = {
  coding: ['Hammering {f}', 'Forging {f}', 'Chiseling {f}', 'Shaping {f}', 'Tempering {f}'],
  writing: ['Inking {f}', 'Penning {f}', 'Scribing {f}', 'Illuminating {f}'],
  researching: ['Studying {f}', 'Reading runes in {f}', 'Digging into {f}', 'Deciphering {f}'],
  browsing: ['Gazing at {f}', 'Scrying {f}', 'Reading the stars: {f}'],
  testing: ['Into the arena!', 'Testing the blade!', 'Blow after blow!', 'Steel meets steel!'],
  debugging: ['Brewing a fix…', 'What broke now?', 'Tasting the potion…', 'Hunting the gremlin'],
  planning: ['Drawing the map…', 'Pondering the plan…', 'Plotting {f}', 'Consulting the guild'],
  delegating: ['Sending a runner: {f}', 'Recruiting help!', 'Dispatching {f}'],
  reviewing: ['Watching {f}', 'Inspecting the work', 'Eyes on {f}'],
  committing: ['Sealing the scroll', 'Sending a raven!', 'Off it goes: {f}'],
  installing: ['Mining {f}', 'Hauling ore: {f}', 'Deeper we dig!'],
  deploying: ['Through the gate!', 'Launching {f}', 'To the sky!'],
  remembering: ['Drinking from the well…', 'Sorting memories…', 'Where was I…'],
  waiting: ['Need ye, chief!', 'Awaiting orders!'],
  idle: ['Warming my beard…', 'Sharpening the axe…', 'Puffing my pipe…'],
};

const BORED = [
  'Done! What now, chief?',
  '*yawns* …still here.',
  'Tapping my boots…',
  'Counting pebbles: 41, 42…',
  'Hello? Anyone?',
  'Ready for the next job!',
  'My beard grows longer…',
  'Shall I polish the axe again?',
];

const NEEDS = ['Oi! Need yer go-ahead!', 'Permission, chief?', 'May I?', 'Waitin’ on ye!'];

const STORIES = [
  'Remember that refactor…', 'I once compiled 500 files…', 'The linter spared no one…',
  'That bug took three days…', 'Three deploys before breakfast!', 'I dream of zero warnings…',
];

function short(detail: string): string {
  let f = detail.trim();
  if (f.includes('/') && !f.includes(' ')) f = f.split('/').pop() || f;
  return f.length > 26 ? `${f.slice(0, 25)}…` : f;
}

function pick<T>(xs: T[], seed: number): T {
  return xs[Math.abs(seed) % xs.length];
}

/** Dwarvish speech for an activity. */
export function speak(activity: Activity, detail: string, seed: number): string {
  const line = pick(LINES[activity] || LINES.coding, seed);
  const f = detail ? short(detail) : '';
  if (!f) return line.replace(/[: ]*\{f\}/, '').replace(/\s+$/, '') || line;
  return line.includes('{f}') ? line.replace('{f}', f) : line;
}

export const bored = (seed: number): string => pick(BORED, seed);
export const needs = (seed: number): string => pick(NEEDS, seed);
export const story = (seed: number): string => pick(STORIES, seed);

/** m:ss or h:mm for waiting timers. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
