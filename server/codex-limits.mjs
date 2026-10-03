// ── Latest Codex plan limits from ~/.codex/sessions ──────
// Reads the tail of the newest rollout files and returns the last rate_limits
// snapshot, so the dashboard shows limits even before a session reports in.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCodexLimits } from './core/usage.mjs';

function newestFiles(root, max = 5) {
  const out = [];
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    // Session dirs are YYYY/MM/DD — walk newest first and stop early.
    entries.sort((a, b) => b.name.localeCompare(a.name));
    for (const e of entries) {
      if (out.length >= max) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory() && depth < 3) walk(full, depth + 1);
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
    }
  };
  walk(root, 0);
  return out
    .map(f => ({ f, m: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.m - a.m)
    .map(x => x.f);
}

/** @returns {{ limits: object, at: number } | null} */
export function latestCodexLimits(root = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions')) {
  for (const file of newestFiles(root)) {
    try {
      const size = fs.statSync(file).size;
      const len = Math.min(size, 512 * 1024);
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      fs.closeSync(fd);
      const lines = buf.toString('utf8').split('\n').reverse();
      for (const line of lines) {
        if (!line.includes('"rate_limits":{')) continue;
        try {
          const entry = JSON.parse(line);
          const limits = parseCodexLimits(entry);
          if (limits) return { limits, at: Date.parse(entry.timestamp) || fs.statSync(file).mtimeMs };
        } catch { /* partial first line */ }
      }
    } catch { /* unreadable file */ }
  }
  return null;
}
