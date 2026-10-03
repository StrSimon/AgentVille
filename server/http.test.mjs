// Integration tests: real HTTP server + real hook process, isolated temp home dirs.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'agentville-test-'));
process.env.AGENTVILLE_HOME = path.join(TMP, 'home');
process.env.CLAUDE_CONFIG_DIR = path.join(TMP, 'claude');
process.env.CODEX_HOME = path.join(TMP, 'codex');

const { startServer } = await import('./http.mjs');
const setup = await import('./setup.mjs');

const PORT = 4299;
const BASE = `http://127.0.0.1:${PORT}`;
let app;

const post = (p, body, headers = {}) => fetch(BASE + p, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});

function runHook(source, payload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'hook', 'agentville-hook.mjs'), source], {
      env: { ...process.env, AGENTVILLE_PORT: String(PORT) },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
    child.stdin.end(JSON.stringify(payload));
  });
}

async function nextEvent(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await (await fetch(`${BASE}/api/state`)).json();
    const hit = predicate(state);
    if (hit) return hit;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('condition not met');
}

before(async () => {
  fs.mkdirSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true });
  fs.mkdirSync(process.env.CODEX_HOME, { recursive: true });
  app = await startServer({ port: PORT, quiet: true, hasViewers: () => true });
});

after(async () => {
  await app?.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('bridge API', () => {
  it('should report health', async () => {
    const j = await (await fetch(`${BASE}/api/health`)).json();
    assert.equal(j.name, 'agentville');
  });

  it('should accept hook events and expose the dwarf in state', async () => {
    const res = await post('/api/hook', { source: 'claude', event: 'PreToolUse', session_id: 'h1', project: 'demo', tool_name: 'Edit', tool_input: { file_path: '/x/App.tsx' } });
    assert.equal(res.status, 200);
    const state = await (await fetch(`${BASE}/api/state`)).json();
    const dwarf = state.agents.find(a => a.online);
    assert.equal(dwarf.detail, 'App.tsx');
    assert.equal(dwarf.source, 'claude');
  });

  it('should stream a snapshot over SSE', async () => {
    const ctrl = new AbortController();
    const res = await fetch(`${BASE}/events`, { signal: ctrl.signal });
    const reader = res.body.getReader();
    const { value } = await reader.read();
    assert.match(new TextDecoder().decode(value), /"type":"snapshot"/);
    ctrl.abort();
  });

  it('should reject control calls without the token', async () => {
    const res = await post('/api/settings', { approvalWaitSec: 10 });
    assert.equal(res.status, 401);
  });

  it('should reject foreign origins and non-JSON posts', async () => {
    assert.equal((await post('/api/hook', {}, { origin: 'https://evil.example' })).status, 403);
    const text = await fetch(`${BASE}/api/hook`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
    assert.equal(text.status, 415);
  });

  it('should reject unknown Host headers (DNS rebinding)', async () => {
    const res = await new Promise((resolve) => {
      import('node:http').then(({ request }) => {
        const r = request({ host: '127.0.0.1', port: PORT, path: '/api/state', headers: { host: 'evil.example:4299' } }, resolve);
        r.end();
      });
    });
    assert.equal(res.statusCode, 403);
  });

  it('should inject the token into the dashboard html', async () => {
    const distDir = path.join(TMP, 'dist');
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><head></head><body></body></html>');
    const other = await startServer({ port: PORT + 1, quiet: true, staticDir: distDir });
    const html = await (await fetch(`http://127.0.0.1:${PORT + 1}/`)).text();
    await other.close();
    assert.match(html, new RegExp(`agentville-token" content="${app.token}"`));
  });
});

describe('projects', () => {
  it('should group sessions by git repository, not sub-folder', async () => {
    const repo = path.join(TMP, 'MyRepo');
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'app', 'src'), { recursive: true });
    await post('/api/hook', { source: 'claude', event: 'SessionStart', session_id: 'proj1', cwd: path.join(repo, 'app', 'src'), project: 'src' });
    const state = await (await fetch(`${BASE}/api/state`)).json();
    assert.ok(state.agents.some(a => a.online && a.project === 'MyRepo'));
  });
});

describe('hook process end-to-end', () => {
  it('should forward a Codex shell command', async () => {
    const r = await runHook('codex', { hook_event_name: 'PreToolUse', session_id: 'cx1', cwd: '/w/api', tool_name: 'Bash', tool_input: { command: 'npm test' }, model: 'gpt-5.5' });
    assert.equal(r.code, 0);
    assert.equal(r.out, '');
    const dwarf = await nextEvent(s => s.agents.find(a => a.source === 'codex' && a.online));
    assert.equal(dwarf.activity, 'testing');
    assert.equal(dwarf.project, 'api');
  });

  it('should approve a permission request through the village', async () => {
    const pending = runHook('claude', { hook_event_name: 'PermissionRequest', session_id: 'p1', cwd: '/w/shop', tool_name: 'Bash', tool_input: { command: 'git push' } });
    const req = await nextEvent(s => s.requests.find(r => r.kind === 'permission'));
    const res = await post(`/api/requests/${req.id}`, { decision: 'allow' }, { 'x-agentville-token': app.token });
    assert.equal((await res.json()).ok, true);
    const r = await pending;
    assert.deepEqual(JSON.parse(r.out), { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } });
  });

  it('should deliver an order via PostToolUse additionalContext', async () => {
    await runHook('claude', { hook_event_name: 'PreToolUse', session_id: 'o1', cwd: '/w/shop', tool_name: 'Read', tool_input: { file_path: '/a.ts' } });
    const dwarf = await nextEvent(s => s.agents.find(a => a.online && a.detail === 'a.ts'));
    await post(`/api/agents/${dwarf.id}/orders`, { text: 'Use tabs' }, { 'x-agentville-token': app.token });
    const r = await runHook('claude', { hook_event_name: 'PostToolUse', session_id: 'o1', cwd: '/w/shop', tool_name: 'Read', tool_input: {}, tool_response: 'x' });
    assert.match(JSON.parse(r.out).hookSpecificOutput.additionalContext, /Use tabs/);
  });

  it('should exit silently when the bridge is down', async () => {
    const child = spawn(process.execPath, [path.join(ROOT, 'hook', 'agentville-hook.mjs'), 'claude'], { env: { ...process.env, AGENTVILLE_PORT: '4398' } });
    child.stdin.end(JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'z', tool_name: 'Read' }));
    const code = await new Promise(r => child.on('close', r));
    assert.equal(code, 0);
  });

  it('should tolerate garbage on stdin', async () => {
    const child = spawn(process.execPath, [path.join(ROOT, 'hook', 'agentville-hook.mjs'), 'claude']);
    child.stdin.end('not json');
    assert.equal(await new Promise(r => child.on('close', r)), 0);
  });
});

describe('setup', () => {
  it('should install hooks for both tools and keep user hooks', () => {
    const claudeSettings = path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json');
    fs.writeFileSync(claudeSettings, JSON.stringify({
      model: 'opus',
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'my-own-hook' }] }],
        Stop: [{ hooks: [{ type: 'command', command: '/Users/x/.claude/hooks/agentville-hook.sh' }] }],
      },
    }));
    const result = setup.installIntegrations({});
    assert.deepEqual(result.installed.sort(), ['claude', 'codex']);

    const claude = JSON.parse(fs.readFileSync(claudeSettings, 'utf8'));
    assert.equal(claude.model, 'opus');
    assert.equal(claude.hooks.PreToolUse.length, 2);
    assert.equal(claude.hooks.PreToolUse[0].hooks[0].command, 'my-own-hook');
    assert.equal(claude.hooks.Stop.length, 1, 'legacy AgentVille hook replaced, not duplicated');
    assert.match(claude.hooks.Stop[0].hooks[0].command, /run\.(sh|cmd)" claude$/);
    assert.equal(claude.hooks.PermissionRequest[0].hooks[0].timeout, 3600);

    const codex = JSON.parse(fs.readFileSync(path.join(process.env.CODEX_HOME, 'hooks.json'), 'utf8'));
    assert.match(codex.hooks.PreToolUse[0].hooks[0].command, /" codex$/);
    assert.ok(codex.hooks.Interrupt);
    assert.match(fs.readFileSync(path.join(process.env.CODEX_HOME, 'config.toml'), 'utf8'), /\[features\]\nhooks = true/);

    const st = setup.integrationStatus();
    assert.ok(st.claude.installed && st.codex.installed);
  });

  it('should be idempotent', () => {
    setup.installIntegrations({});
    const claude = JSON.parse(fs.readFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json'), 'utf8'));
    assert.equal(claude.hooks.Stop.length, 1);
  });

  it('the installed launcher should run the hook', async () => {
    if (process.platform === 'win32') return;
    const launcher = path.join(process.env.AGENTVILLE_HOME, 'hook', 'run.sh');
    const child = spawn(launcher, ['claude'], { env: { ...process.env, AGENTVILLE_PORT: String(PORT) } });
    child.stdin.end(JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'launch1', cwd: '/w/launch' }));
    assert.equal(await new Promise(r => child.on('close', r)), 0);
    await nextEvent(s => s.agents.find(a => a.project === 'launch' && a.online));
  });

  it('should tap the status line, keep the original output and report Claude limits', async () => {
    if (process.platform === 'win32') return;
    const settingsFile = path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json');
    const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    s.statusLine = { type: 'command', command: 'echo my-status', padding: 1 };
    fs.writeFileSync(settingsFile, JSON.stringify(s));
    setup.installIntegrations({ targets: ['claude'] });
    const tapped = JSON.parse(fs.readFileSync(settingsFile, 'utf8')).statusLine;
    assert.match(tapped.command, /run\.sh" statusline$/);
    assert.equal(tapped.padding, 1);

    const launcher = path.join(process.env.AGENTVILLE_HOME, 'hook', 'run.sh');
    const child = spawn(launcher, ['statusline'], { env: { ...process.env, AGENTVILLE_PORT: String(PORT) } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stdin.end(JSON.stringify({ rate_limits: { five_hour: { used_percentage: 23.5, resets_at: 1738425600 }, seven_day: { used_percentage: 41.2, resets_at: 1738857600 } } }));
    await new Promise(r => child.on('close', r));
    assert.equal(out.trim(), 'my-status');
    const limits = await nextEvent(st => st.stats.limits.claude);
    assert.deepEqual(limits.windows.map(w => [w.windowMinutes, w.usedPercent]), [[300, 23.5], [10080, 41.2]]);

    setup.installIntegrations({ targets: ['claude'] });
    const saved = JSON.parse(fs.readFileSync(path.join(process.env.AGENTVILLE_HOME, 'statusline.json'), 'utf8'));
    assert.equal(saved.original.command, 'echo my-status', 'reinstall must not overwrite the saved original');
  });

  it('should uninstall only AgentVille hooks', () => {
    setup.uninstallIntegrations({});
    const claude = JSON.parse(fs.readFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json'), 'utf8'));
    assert.deepEqual(Object.keys(claude.hooks), ['PreToolUse']);
    assert.deepEqual(claude.statusLine, { type: 'command', command: 'echo my-status', padding: 1 });
    const codex = JSON.parse(fs.readFileSync(path.join(process.env.CODEX_HOME, 'hooks.json'), 'utf8'));
    assert.equal(codex.hooks, undefined);
  });

  it('should only add the codex feature flag once', () => {
    const f = path.join(TMP, 'cfg.toml');
    fs.writeFileSync(f, 'model = "gpt-5.5"\n\n[features]\nhooks = false\n');
    assert.equal(setup.ensureCodexHooksFeature(f), true);
    assert.equal(setup.ensureCodexHooksFeature(f), false);
    assert.equal(fs.readFileSync(f, 'utf8'), 'model = "gpt-5.5"\n\n[features]\nhooks = true\n');
  });
});
