/**
 * Integration tests for the AgentVille Bridge server.
 * Uses native Node.js test runner (node --test).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIDGE_PATH = join(__dirname, 'bridge.mjs');
const PORT = 4243; // Use different port to not conflict with running bridge
const BASE = `http://localhost:${PORT}`;

let serverProcess;

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, data: await res.json() };
}

before(async () => {
  serverProcess = spawn('node', [BRIDGE_PATH], {
    env: { ...process.env, AGENTVILLE_PORT: String(PORT) },
    stdio: 'pipe',
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 5000);
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('AgentVille Bridge')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });
  });
});

after(() => {
  serverProcess?.kill();
});

// ── Heartbeat API ────────────────────────────────────────

describe('POST /api/heartbeat', () => {
  it('should create a new agent on first heartbeat', async () => {
    const { status, data } = await post('/api/heartbeat', {
      agent: 'Test Coder',
      activity: 'coding',
    });
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.agentId, 'test-coder');
  });

  it('should update existing agent on subsequent heartbeat', async () => {
    const { status, data } = await post('/api/heartbeat', {
      agent: 'Test Coder',
      activity: 'testing',
    });
    assert.equal(status, 200);
    assert.equal(data.ok, true);

    // Verify via status
    const { data: statusData } = await get('/api/status');
    assert.equal(statusData.agents['test-coder'].activity, 'testing');
  });

  it('should handle multiple agents', async () => {
    await post('/api/heartbeat', { agent: 'Planner', activity: 'planning' });
    await post('/api/heartbeat', { agent: 'Researcher', activity: 'researching' });

    const { data } = await get('/api/status');
    assert.ok(data.agents['planner']);
    assert.ok(data.agents['researcher']);
    assert.equal(data.agents['planner'].activity, 'planning');
  });

  it('should reject invalid JSON', async () => {
    const res = await fetch(`${BASE}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    assert.equal(res.status, 400);
  });
});

// ── Raw Event API ────────────────────────────────────────

describe('POST /api/event', () => {
  it('should accept spawn events', async () => {
    const { status, data } = await post('/api/event', {
      type: 'agent:spawn',
      agentId: 'raw-agent-1',
      agentName: 'Raw Agent',
    });
    assert.equal(status, 200);
    assert.equal(data.ok, true);

    const { data: statusData } = await get('/api/status');
    assert.ok(statusData.agents['raw-agent-1']);
  });

  it('should accept work events', async () => {
    const { status } = await post('/api/event', {
      type: 'agent:work',
      agentId: 'raw-agent-1',
      activity: 'coding',
    });
    assert.equal(status, 200);

    const { data } = await get('/api/status');
    assert.equal(data.agents['raw-agent-1'].activity, 'coding');
  });

  it('should accept despawn events', async () => {
    const { status } = await post('/api/event', {
      type: 'agent:despawn',
      agentId: 'raw-agent-1',
    });
    assert.equal(status, 200);

    const { data } = await get('/api/status');
    assert.equal(data.agents['raw-agent-1'], undefined);
  });
});

// ── Status API ───────────────────────────────────────────

describe('GET /api/status', () => {
  it('should return current agent state', async () => {
    const { status, data } = await get('/api/status');
    assert.equal(status, 200);
    assert.ok(data.agents);
    assert.ok(typeof data.dashboardClients === 'number');
  });
});

// ── SSE Stream ───────────────────────────────────────────

describe('GET /events (SSE)', () => {
  it('should receive events for new agent activity', async () => {
    const events = [];

    // Connect SSE
    const controller = new AbortController();
    const res = await fetch(`${BASE}/events`, { signal: controller.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    // Read events in background
    const reading = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            events.push(JSON.parse(line.slice(6)));
          }
        }
      }
    })();

    // Give SSE time to connect, then send heartbeat
    await new Promise(r => setTimeout(r, 200));
    await post('/api/heartbeat', { agent: 'SSE Test Agent', activity: 'reviewing' });
    await new Promise(r => setTimeout(r, 200));

    controller.abort();
    await reading.catch(() => {}); // ignore abort error

    // Should have received spawn + work events
    const spawnEvent = events.find(e => e.type === 'agent:spawn' && e.agentName === 'SSE Test Agent');
    const workEvent = events.find(e => e.type === 'agent:work' && e.agentId === 'sse-test-agent');
    assert.ok(spawnEvent, 'Should receive spawn event via SSE');
    assert.ok(workEvent, 'Should receive work event via SSE');
  });
});

// ── CORS ─────────────────────────────────────────────────

describe('CORS', () => {
  it('should handle OPTIONS preflight', async () => {
    const res = await fetch(`${BASE}/api/heartbeat`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });
});

// ── 404 ──────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('should return 404 for unknown paths', async () => {
    const res = await fetch(`${BASE}/unknown`);
    assert.equal(res.status, 404);
  });
});
