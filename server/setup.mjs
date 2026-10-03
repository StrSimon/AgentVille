// ── One-click integration with Claude Code and Codex ─────
// Installs a stable launcher in ~/.agentville/hook and registers it as a
// global hook in ~/.claude/settings.json and ~/.codex/hooks.json.
// Existing user hooks are preserved; only AgentVille entries are touched.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PACKAGE_DIR, paths, writeJSON } from './store.mjs';

const HOOK_SRC = path.join(PACKAGE_DIR, 'hook', 'agentville-hook.mjs');
const MARK = 'agentville';

// event → timeout (s). Long timeouts let the village hold approvals; the bridge bounds the wait.
const CLAUDE_EVENTS = {
  SessionStart: 10, SessionEnd: 5, UserPromptSubmit: 10, PreToolUse: 3600, PostToolUse: 10,
  PostToolUseFailure: 10, PermissionRequest: 3600, Notification: 10, SubagentStart: 10,
  SubagentStop: 10, Stop: 3600, PreCompact: 10,
};
const CODEX_EVENTS = {
  SessionStart: 10, SessionEnd: 5, UserPromptSubmit: 10, PreToolUse: 3600, PostToolUse: 10,
  PermissionRequest: 3600, SubagentStart: 10, SubagentStop: 10, Stop: 3600, PreCompact: 10,
  PostCompact: 10, Interrupt: 10,
};

function claudeDir() { return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'); }
function codexDir() { return process.env.CODEX_HOME || path.join(os.homedir(), '.codex'); }

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const isOurs = (h) => typeof h?.command === 'string' && h.command.toLowerCase().includes(MARK);

/** Remove every AgentVille handler from a hooks object (keeps everything else). */
export function stripHooks(hooks = {}) {
  const out = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) { out[event] = groups; continue; }
    const kept = groups
      .map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !isOurs(h)) }))
      .filter(g => g.hooks.length > 0);
    if (kept.length) out[event] = kept;
  }
  return out;
}

/** Add AgentVille handlers for the given events. */
export function addHooks(hooks, command, events) {
  const out = stripHooks(hooks);
  for (const [event, timeout] of Object.entries(events)) {
    out[event] = [...(out[event] || []), { hooks: [{ type: 'command', command, timeout }] }];
  }
  return out;
}

function isElectron() {
  return !!process.versions.electron;
}

/** Write the hook script + a launcher that finds a Node runtime. Returns the launcher path. */
export function installLauncher(home = paths().home) {
  const dir = path.join(home, 'hook');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(HOOK_SRC, path.join(dir, 'agentville-hook.mjs'));
  const runtime = process.execPath;
  if (process.platform === 'win32') {
    const file = path.join(dir, 'run.cmd');
    const electron = isElectron() ? 'set ELECTRON_RUN_AS_NODE=1\r\n' : '';
    fs.writeFileSync(file, [
      '@echo off',
      `if exist "${runtime}" (`,
      `  ${electron}"${runtime}" "%~dp0agentville-hook.mjs" %*`,
      '  exit /b 0',
      ')',
      'where node >nul 2>nul && node "%~dp0agentville-hook.mjs" %*',
      'exit /b 0',
      '',
    ].join('\r\n'));
    return file;
  }
  const file = path.join(dir, 'run.sh');
  const primary = isElectron()
    ? `if command -v node >/dev/null 2>&1; then exec node "$DIR/agentville-hook.mjs" "$@"; fi\nif [ -x "${runtime}" ]; then ELECTRON_RUN_AS_NODE=1 exec "${runtime}" "$DIR/agentville-hook.mjs" "$@"; fi`
    : `if [ -x "${runtime}" ]; then exec "${runtime}" "$DIR/agentville-hook.mjs" "$@"; fi\nif command -v node >/dev/null 2>&1; then exec node "$DIR/agentville-hook.mjs" "$@"; fi`;
  fs.writeFileSync(file, `#!/bin/sh\n# AgentVille hook launcher — generated, safe to delete via \`agentville uninstall\`.\nDIR="$(cd "$(dirname "$0")" && pwd)"\n${primary}\nexit 0\n`, { mode: 0o755 });
  fs.chmodSync(file, 0o755);
  return file;
}

function commandFor(launcher, source) {
  return `"${launcher}" ${source}`;
}

/** Enable `[features] hooks = true` in Codex config.toml if it isn't already. */
export function ensureCodexHooksFeature(file = path.join(codexDir(), 'config.toml')) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { /* new file */ }
  const lines = text.split('\n');
  const idx = lines.findIndex(l => l.trim() === '[features]');
  if (idx >= 0) {
    for (let i = idx + 1; i < lines.length && !lines[i].trim().startsWith('['); i++) {
      if (/^\s*hooks\s*=/.test(lines[i])) {
        if (/=\s*true/.test(lines[i])) return false;
        lines[i] = 'hooks = true';
        fs.writeFileSync(file, lines.join('\n'));
        return true;
      }
    }
    lines.splice(idx + 1, 0, 'hooks = true');
    fs.writeFileSync(file, lines.join('\n'));
    return true;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}\n[features]\nhooks = true\n`);
  return true;
}

function targetInfo(name) {
  if (name === 'claude') {
    const dir = claudeDir();
    return { name, dir, file: path.join(dir, 'settings.json'), events: CLAUDE_EVENTS };
  }
  const dir = codexDir();
  return { name, dir, file: path.join(dir, 'hooks.json'), events: CODEX_EVENTS };
}

function installedIn(file) {
  const json = readJSON(file);
  return !!json?.hooks && Object.values(json.hooks).some(gs => Array.isArray(gs) && gs.some(g => (g.hooks || []).some(isOurs)));
}

function currentIn(file, launcher) {
  const json = readJSON(file);
  return JSON.stringify(json?.hooks || {}).includes(launcher.replace(/\\/g, '\\\\'));
}

/** Which tools are present and connected. */
export function integrationStatus() {
  const launcher = path.join(paths().home, 'hook', process.platform === 'win32' ? 'run.cmd' : 'run.sh');
  return {
    claude: { detected: fs.existsSync(claudeDir()), installed: installedIn(targetInfo('claude').file), current: currentIn(targetInfo('claude').file, launcher) },
    codex: { detected: fs.existsSync(codexDir()), installed: installedIn(targetInfo('codex').file), current: currentIn(targetInfo('codex').file, launcher) },
  };
}

/**
 * Connect Claude Code and/or Codex. Defaults to every detected tool.
 * @returns {{ installed: string[], notes: string[] }}
 */
export function installIntegrations({ targets } = {}) {
  const status = integrationStatus();
  const list = (targets?.length ? targets : ['claude', 'codex'].filter(t => status[t].detected))
    .filter(t => t === 'claude' || t === 'codex');
  const launcher = installLauncher();
  const notes = [];
  for (const name of list) {
    const t = targetInfo(name);
    const json = readJSON(t.file) || {};
    json.hooks = addHooks(json.hooks, commandFor(launcher, name), t.events);
    if (name === 'claude') tapStatusLine(json, launcher);
    writeJSON(t.file, json);
    if (name === 'codex') {
      if (ensureCodexHooksFeature()) notes.push('Enabled hooks in ~/.codex/config.toml');
      notes.push('Codex asks once to trust the new hooks — choose "Trust all and continue" on next start.');
    }
  }
  removeLegacyHook();
  return { installed: list, notes };
}

export function uninstallIntegrations({ targets } = {}) {
  const list = targets?.length ? targets : ['claude', 'codex'];
  for (const name of list) {
    const t = targetInfo(name);
    const json = readJSON(t.file);
    if (!json) continue;
    if (json.hooks) {
      json.hooks = stripHooks(json.hooks);
      if (!Object.keys(json.hooks).length) delete json.hooks;
    }
    if (name === 'claude') untapStatusLine(json);
    writeJSON(t.file, json);
  }
  removeLegacyHook();
  return { removed: list };
}

// The Claude Code status line is the only official source of plan limits
// (5h / weekly). AgentVille wraps the user's status line: limits go to the
// village, the original command still renders exactly as before.
function statusLineFile() { return path.join(paths().home, 'statusline.json'); }

export function tapStatusLine(settings, launcher) {
  const current = settings.statusLine;
  if (current && typeof current.command === 'string' && current.command.toLowerCase().includes(MARK)) {
    settings.statusLine = { ...current, command: `"${launcher}" statusline` };
    return;
  }
  writeJSON(statusLineFile(), { original: current || null });
  settings.statusLine = { ...(current || {}), type: 'command', command: `"${launcher}" statusline` };
}

export function untapStatusLine(settings) {
  if (!settings.statusLine?.command?.toLowerCase().includes(MARK)) return;
  const saved = readJSON(statusLineFile());
  if (saved?.original) settings.statusLine = saved.original;
  else delete settings.statusLine;
}

/** Pre-2.0 installs copied a bash hook into ~/.claude/hooks. */
function removeLegacyHook() {
  const legacy = path.join(claudeDir(), 'hooks', 'agentville-hook.sh');
  try { fs.unlinkSync(legacy); } catch { /* not there */ }
}

/** Refresh the hook script (e.g. after an update) without touching configs. */
export function refreshLauncher() {
  const s = integrationStatus();
  if (s.claude.installed || s.codex.installed) installLauncher();
}
