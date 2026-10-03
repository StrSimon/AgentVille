#!/usr/bin/env node
// AgentVille hook — shared by Claude Code and Codex.
// Usage (configured automatically by `agentville setup`):
//   node agentville-hook.mjs claude|codex
// Reads the hook payload from stdin, forwards a compact version to the local
// AgentVille bridge and prints whatever the village answers (approvals, orders).
// Never blocks or fails the agent: any error simply exits 0 without output.
//
// `node agentville-hook.mjs statusline` is a transparent Claude Code status line
// tap: it forwards plan limits (rate_limits) to the village and then runs the
// user's original status line command (saved in ~/.agentville/statusline.json).

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODE = process.argv[2];
const SOURCE = MODE === 'codex' ? 'codex' : 'claude';
const BRIDGE = process.env.AGENTVILLE_URL || `http://127.0.0.1:${process.env.AGENTVILLE_PORT || 4242}`;

// Events that may wait for a decision from the village (bounded by the bridge).
const HOLDING = new Set(['PermissionRequest', 'Stop', 'PreToolUse']);
const KEEP_KEYS = ['file_path', 'notebook_path', 'path', 'pattern', 'query', 'url', 'description',
  'subagent_type', 'skill', 'command', 'cmd', 'explanation', 'questions', 'prompt', 'message'];

function compactInput(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  for (const key of KEEP_KEYS) {
    let v = input[key];
    if (v === undefined) continue;
    if (key === 'questions') { out.questions = v; continue; }
    if (Array.isArray(v)) v = v.join(' ');
    if (typeof v !== 'string') continue;
    if (v.includes('*** Begin Patch')) {
      v = v.split('\n').filter(l => /^\*\*\* (Begin Patch|Add File|Update File|Delete File)/.test(l)).join('\n');
    }
    out[key] = v.length > 600 ? v.slice(0, 600) : v;
  }
  if (Array.isArray(input.plan)) out.plan = input.plan.slice(0, 1);
  // Codex apply_patch may carry the patch under an unknown key
  if (!out.command) {
    for (const v of Object.values(input)) {
      if (typeof v === 'string' && v.includes('*** Begin Patch')) {
        out.command = v.split('\n').filter(l => /^\*\*\* /.test(l)).join('\n');
        break;
      }
    }
  }
  return out;
}

function byteLength(v) {
  if (v === undefined || v === null) return 0;
  return Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v));
}

function projectName(cwd) {
  const parts = String(cwd || '').split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const raw = await readStdin();
  if (process.env.AGENTVILLE_DEBUG_ENV) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.AGENTVILLE_DEBUG_ENV, JSON.stringify({ env: process.env, input: JSON.parse(raw || '{}') }) + '\n');
  }
  if (!raw.trim()) return;
  const input = JSON.parse(raw);
  const event = input.hook_event_name;
  if (!event) return;

  const payload = {
    source: SOURCE,
    event,
    session_id: input.session_id,
    project: projectName(input.cwd),
    cwd: input.cwd,
    transcript_path: input.transcript_path || undefined,
    agent_transcript_path: input.agent_transcript_path || undefined,
    model: input.model || undefined,
    tool_name: input.tool_name,
    tool_input: compactInput(input.tool_input),
    agent_id: input.agent_id || undefined,
    agent_type: input.agent_type || undefined,
    event_source: input.source || undefined,
    notification_type: input.notification_type || undefined,
    message: typeof input.message === 'string' ? input.message.slice(0, 200) : undefined,
    error: typeof input.error === 'string' ? input.error.slice(0, 200) : undefined,
    stop_hook_active: !!input.stop_hook_active,
    // 'cli' / IDE = a human at the keyboard; 'sdk-*' = claude -p / Agent SDK automation
    entrypoint: process.env.CLAUDE_CODE_ENTRYPOINT || undefined,
  };
  if (event === 'PostToolUse' || event === 'PostToolUseFailure') {
    payload.input_bytes = byteLength(input.tool_input);
    payload.output_bytes = byteLength(input.tool_response ?? input.tool_output);
  }

  // Normal events must never slow the agent down; holding events are bounded by the bridge.
  const timeout = HOLDING.has(event) ? 3_600_000 : 1500;
  const res = await fetch(`${BRIDGE}/api/hook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) return;
  const answer = await res.json();
  if (answer && answer.output) {
    // Pipes are async on macOS — wait for the flush before exiting.
    await new Promise(resolve => process.stdout.write(JSON.stringify(answer.output), resolve));
  }
}

async function statusline() {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch { /* pass through anyway */ }
  const report = input.rate_limits || input.cost
    ? fetch(`${BRIDGE}/api/statusline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rate_limits: input.rate_limits, cost: input.cost, model: input.model, session_id: input.session_id }),
      signal: AbortSignal.timeout(1500),
    }).catch((err) => { if (process.env.AGENTVILLE_DEBUG) process.stderr.write(`statusline report failed: ${err}\n`); })
    : Promise.resolve();

  let original = '';
  try {
    const cfg = JSON.parse(readFileSync(fileURLToPath(new URL('../statusline.json', import.meta.url)), 'utf8'));
    original = cfg.original?.command || '';
  } catch { /* no original status line */ }

  const run = original
    ? new Promise((resolve) => {
      const child = spawn(original, { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
      child.on('close', resolve);
      child.on('error', resolve);
      // status line commands that don't read stdin close the pipe early — that's fine
      child.stdin.on('error', () => {});
      child.stdin.end(raw);
    })
    : Promise.resolve();
  await Promise.all([report, run]);
}

(MODE === 'statusline' ? statusline() : main()).catch(() => {}).finally(() => process.exit(0));
