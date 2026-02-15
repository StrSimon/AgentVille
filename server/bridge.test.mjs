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
    // agentName is the dwarf name, agentRole is the raw name
    const spawnEvent = events.find(e => e.type === 'agent:spawn' && e.agentId === 'sse-test-agent');
    const workEvent = events.find(e => e.type === 'agent:work' && e.agentId === 'sse-test-agent');
    assert.ok(spawnEvent, 'Should receive spawn event via SSE');
    assert.ok(workEvent, 'Should receive work event via SSE');
  });
});

// ── Leaderboard API ─────────────────────────────────────

describe('GET /api/leaderboard', () => {
  it('should return a leaderboard array', async () => {
    const { status, data } = await get('/api/leaderboard');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.leaderboard));
  });

  it('should include agents that have sent heartbeats', async () => {
    // test-coder was created earlier in the test suite
    const { data } = await get('/api/leaderboard');
    const entry = data.leaderboard.find(e => e.agentId === 'test-coder');
    assert.ok(entry, 'test-coder should be in leaderboard');
    assert.equal(typeof entry.xp, 'number');
    assert.equal(typeof entry.level, 'number');
    assert.equal(typeof entry.title, 'string');
    assert.equal(typeof entry.name, 'string');
  });

  it('should be sorted by XP descending', async () => {
    const { data } = await get('/api/leaderboard');
    for (let i = 1; i < data.leaderboard.length; i++) {
      assert.ok(
        data.leaderboard[i - 1].xp >= data.leaderboard[i].xp,
        'Leaderboard should be sorted by XP descending',
      );
    }
  });
});

// ── Heartbeat with bytes ────────────────────────────────

describe('Heartbeat byte tracking', () => {
  it('should track inputBytes and outputBytes', async () => {
    await post('/api/heartbeat', {
      agent: 'Byte Tracker',
      activity: 'coding',
      inputBytes: 5000,
      outputBytes: 3000,
    });

    const { data } = await get('/api/status');
    const agent = data.agents['byte-tracker'];
    assert.ok(agent, 'byte-tracker should exist');
    assert.ok(agent.totalInputBytes >= 5000);
    assert.ok(agent.totalOutputBytes >= 3000);
  });

  it('should accumulate bytes on subsequent heartbeats', async () => {
    await post('/api/heartbeat', {
      agent: 'Byte Tracker',
      activity: 'idle',
      inputBytes: 2000,
      outputBytes: 1000,
    });

    const { data } = await get('/api/status');
    const agent = data.agents['byte-tracker'];
    assert.ok(agent.totalInputBytes >= 7000);
    assert.ok(agent.totalOutputBytes >= 4000);
  });
});

// ── Heartbeat with parentAgent ──────────────────────────

describe('Heartbeat sub-agent registration', () => {
  it('should register parent-child relationship', async () => {
    // Create parent first
    await post('/api/heartbeat', { agent: 'Parent Agent', activity: 'planning' });
    // Create child with parentAgent
    await post('/api/heartbeat', {
      agent: 'Child Agent',
      activity: 'coding',
      parentAgent: 'Parent Agent',
    });

    const { data } = await get('/api/status');
    const child = data.agents['child-agent'];
    assert.ok(child, 'child-agent should exist');
    assert.equal(child.parentId, 'parent-agent');
  });
});

// ── Heartbeat with project field ────────────────────────

describe('Heartbeat project field', () => {
  it('should track project on agent', async () => {
    await post('/api/heartbeat', {
      agent: 'Project Worker',
      activity: 'coding',
      project: 'agentville',
    });

    const { data } = await get('/api/status');
    const agent = data.agents['project-worker'];
    assert.ok(agent);
    assert.equal(agent.project, 'agentville');
  });
});

// ── Event API edge cases ────────────────────────────────

describe('POST /api/event edge cases', () => {
  it('should reject invalid JSON', async () => {
    const res = await fetch(`${BASE}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    });
    assert.equal(res.status, 400);
  });

  it('should handle work event for nonexistent agent gracefully', async () => {
    const { status } = await post('/api/event', {
      type: 'agent:work',
      agentId: 'ghost-agent',
      activity: 'coding',
    });
    assert.equal(status, 200);
  });

  it('should handle despawn for nonexistent agent gracefully', async () => {
    const { status } = await post('/api/event', {
      type: 'agent:despawn',
      agentId: 'ghost-agent-2',
    });
    assert.equal(status, 200);
  });
});

// ── CORS ─────────────────────────────────────────────────

describe('CORS', () => {
  it('should handle OPTIONS preflight', async () => {
    const res = await fetch(`${BASE}/api/heartbeat`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });

  it('should set CORS headers on regular responses', async () => {
    const res = await fetch(`${BASE}/api/status`);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });

  it('should handle OPTIONS on any path', async () => {
    const res = await fetch(`${BASE}/api/event`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
  });
});

// ── Busy lifecycle ──────────────────────────────────────

describe('Heartbeat busy state', () => {
  it('should track busy flag from PreToolUse', async () => {
    await post('/api/heartbeat', {
      agent: 'Lifecycle Agent',
      activity: 'coding',
      busy: true,
    });

    const { data } = await get('/api/status');
    const agent = data.agents['lifecycle-agent'];
    assert.ok(agent, 'lifecycle-agent should exist');
    assert.equal(agent.busy, true);
  });

  it('should clear busy flag from PostToolUse', async () => {
    await post('/api/heartbeat', {
      agent: 'Lifecycle Agent',
      inputBytes: 100,
      outputBytes: 200,
      busy: false,
    });

    const { data } = await get('/api/status');
    const agent = data.agents['lifecycle-agent'];
    assert.equal(agent.busy, false);
  });

  it('should default to busy=false when not provided', async () => {
    await post('/api/heartbeat', {
      agent: 'No Busy Flag',
      activity: 'coding',
    });

    const { data } = await get('/api/status');
    const agent = data.agents['no-busy-flag'];
    assert.equal(agent.busy, false);
  });
});

// ── Heartbeat without activity (PostToolUse) ────────────

describe('Heartbeat without activity (PostToolUse)', () => {
  it('should keep existing activity when no activity field provided', async () => {
    // First set agent to coding
    await post('/api/heartbeat', {
      agent: 'Sticky-Agent',
      activity: 'coding',
      detail: 'file.ts',
      busy: true,
    });

    // PostToolUse: send bytes only, no activity field
    await post('/api/heartbeat', {
      agent: 'Sticky-Agent',
      inputBytes: 500,
      outputBytes: 300,
      busy: false,
    });

    const { data } = await get('/api/status');
    const agent = data.agents['sticky-agent'];
    assert.equal(agent.activity, 'coding'); // Should still be coding!
    assert.equal(agent.busy, false);
  });

  it('should still change activity when explicitly provided', async () => {
    await post('/api/heartbeat', {
      agent: 'Sticky-Agent2',
      activity: 'coding',
      busy: true,
    });

    await post('/api/heartbeat', {
      agent: 'Sticky-Agent2',
      activity: 'researching',
      detail: 'types.ts',
      busy: true,
    });

    const { data } = await get('/api/status');
    assert.equal(data.agents['sticky-agent2'].activity, 'researching');
  });
});

// ── Building XP via SSE ──────────────────────────────────

describe('Building XP tracking', () => {
  it('should send building:state events to new SSE clients', async () => {
    // Ensure at least one agent has worked so a building has XP
    await post('/api/heartbeat', { agent: 'Building Test Agent', activity: 'coding', busy: true });

    const events = [];
    const controller = new AbortController();
    const res = await fetch(`${BASE}/events`, { signal: controller.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    // Read initial state events
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

    await new Promise(r => setTimeout(r, 500));
    controller.abort();
    await reading.catch(() => {});

    const buildingEvents = events.filter(e => e.type === 'building:state');
    assert.ok(buildingEvents.length > 0, 'Should receive building:state events on SSE connect');

    // Each building:state event should have expected fields
    for (const evt of buildingEvents) {
      assert.ok(evt.buildingId, 'building:state should have buildingId');
      assert.equal(typeof evt.level, 'number');
      assert.equal(typeof evt.title, 'string');
      assert.equal(typeof evt.xp, 'number');
    }
  });

  it('should send building:xp events when agent works', async () => {
    const events = [];
    const controller = new AbortController();
    const res = await fetch(`${BASE}/events`, { signal: controller.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

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

    await new Promise(r => setTimeout(r, 200));

    // Send a heartbeat with a tool use — triggers building:xp
    await post('/api/heartbeat', {
      agent: 'Building XP Agent',
      activity: 'coding',
      busy: true,
    });

    await new Promise(r => setTimeout(r, 300));
    controller.abort();
    await reading.catch(() => {});

    const xpEvents = events.filter(e => e.type === 'building:xp');
    assert.ok(xpEvents.length > 0, 'Should receive building:xp events from agent activity');

    const xpEvent = xpEvents[0];
    assert.ok(xpEvent.buildingId, 'building:xp should have buildingId');
    assert.equal(typeof xpEvent.level, 'number');
    assert.equal(typeof xpEvent.xp, 'number');
  });
});

// ── 404 ──────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('should return 404 for unknown paths', async () => {
    const res = await fetch(`${BASE}/unknown`);
    assert.equal(res.status, 404);
  });

  it('should return 404 for wrong method on known path', async () => {
    const res = await fetch(`${BASE}/api/heartbeat`, { method: 'GET' });
    assert.equal(res.status, 404);
  });
});
