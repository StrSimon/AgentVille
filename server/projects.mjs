// ── Project = git repository, not the current sub-folder ──
// A session in NewSurvivor/app or rebe/storefront/docs/plans belongs to the
// repository it works in. Falls back to the folder name outside of git.
import fs from 'node:fs';
import path from 'node:path';

const cache = new Map();

/** Name of the repository containing `cwd` (or the folder name). */
export function projectFromCwd(cwd) {
  if (!cwd) return '';
  if (cache.has(cwd)) return cache.get(cwd);
  let dir = path.resolve(cwd);
  let name = path.basename(dir);
  for (let i = 0; i < 25; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) { name = path.basename(dir); break; }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cache.set(cwd, name);
  return name;
}
