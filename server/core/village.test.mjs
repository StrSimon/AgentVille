import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createVillage } from './village.mjs';

function setup({ viewers = true, settings, data, transcripts = {} } = {}) {
  let t = 1_750_000_000_000;
  const timers = [];
  const events = [];
  const village = createVillage({
    data,
    settings,
    now: () => t,
    emit: (m) => events.push(m),
    hasViewers: () => viewers,
    readTranscript: (path) => transcripts[path]?.splice(0) || [],
    setTimer: (fn, ms) => { const timer = { fn, at: t + ms, done: false }; timers.push(timer); return timer; },
    clearTimer: (timer) => { if (timer) timer.done = true; },
  });
  return {
    village,
    events,
    advance(ms) {
      t += ms;
      for (const timer of timers) if (!timer.done && timer.at <= t) { timer.done = true; timer.fn(); }
    },
    agents: () => village.snapshot().agents,
    online: () => village.snapshot().agents.filter(a => a.online),
    fxs: (kind) => events.filter(e => e.type === 'fx' && e.kind === kind),
  };
}

const hook = (event, extra = {}) => ({ source: 'claude', session_id: 's1', project: 'shop', event, ...extra });
const flush = () => new Promise(r => setImmediate(r));

describe('sessions & roster', () => {
  it('should spawn a dwarf on SessionStart and keep it for the session', async () => {
    const v = setup();
    await v.village.handleHook(hook('SessionStart'));
    await v.village.handleHook(hook('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: '/x/a.ts' } }));
    const online = v.online();
    assert.equal(online.length, 1);
    assert.equal(online[0].activity, 'coding');
    assert.equal(online[0].detail, 'a.ts');
    assert.equal(online[0].source, 'claude');
    assert.equal(online[0].project, 'shop');
    assert.equal(online[0].toolCalls, 1);
    assert.equal(v.fxs('spawn').length, 1);
  });

  it('should give parallel sessions different dwarves', async () => {
    const v = setup();
    await v.village.handleHook(hook('SessionStart'));
    await v.village.handleHook(hook('SessionStart', { session_id: 's2' }));
    assert.equal(v.online().length, 2);
  });

  it('should reuse the same resident after the session ended', async () => {
    const v = setup();
    await v.village.handleHook(hook('SessionStart'));
    const first = v.online()[0].id;
    await v.village.handleHook(hook('SessionEnd'));
    assert.equal(v.online().length, 0);
    await v.village.handleHook(hook('SessionStart', { session_id: 's9' }));
    assert.equal(v.online()[0].id, first);
  });

  it('should keep Claude and Codex dwarves apart and celebrate the fellowship', async () => {
    const v = setup();
    await v.village.handleHook(hook('UserPromptSubmit'));
    await v.village.handleHook(hook('UserPromptSubmit', { source: 'codex', session_id: 'c1' }));
    await v.village.handleHook(hook('PreToolUse', { source: 'codex', session_id: 'c1', tool_name: 'Bash', tool_input: { command: 'npm test' } }));
    const sources = v.online().map(a => a.source).sort();
    assert.deepEqual(sources, ['claude', 'codex']);
    assert.ok(v.fxs('achievement').some(e => /Fellowship/.test(e.text)));
  });

  it('should migrate legacy profiles as Claude residents', () => {
    const v = setup({ data: { agents: { 'agent-old': { name: 'Dolgmar', toolCalls: 10, totalBytes: 100, sessions: 1 } } } });
    const a = v.agents()[0];
    assert.equal(a.source, 'claude');
    assert.equal(a.kind, 'main');
    assert.equal(a.bytesIn + a.bytesOut, 100);
  });
});

describe('sub-agents', () => {
  it('should spawn a sub dwarf with the delegated task and attribute its tools', async () => {
    const v = setup();
    await v.village.handleHook(hook('PreToolUse', { tool_name: 'Agent', tool_input: { description: 'Scout the API' } }));
    await v.village.handleHook(hook('SubagentStart', { agent_id: 'a1', agent_type: 'Explore' }));
    await v.village.handleHook(hook('PreToolUse', { agent_id: 'a1', agent_type: 'Explore', tool_name: 'Grep', tool_input: { pattern: 'auth' } }));
    const sub = v.online().find(a => a.kind === 'sub');
    assert.ok(sub);
    assert.equal(sub.agentType, 'Explore');
    assert.equal(sub.activity, 'researching');
    const main = v.online().find(a => a.kind === 'main');
    assert.equal(sub.parentId, main.id);
    assert.equal(main.subAgentsSpawned, 1);
    await v.village.handleHook(hook('SubagentStop', { agent_id: 'a1', agent_type: 'Explore' }));
    assert.equal(v.online().filter(a => a.kind === 'sub').length, 0);
  });
});

describe('waiting & attention', () => {
  it('should show a finished dwarf as waiting for a reply', async () => {
    const v = setup();
    await v.village.handleHook(hook('UserPromptSubmit'));
    await v.village.handleHook(hook('Stop'));
    const a = v.online()[0];
    assert.equal(a.activity, 'waiting');
    assert.equal(a.attention.kind, 'done');
    await v.village.handleHook(hook('UserPromptSubmit'));
    assert.equal(v.online()[0].attention, null);
  });

  it('should flag permission prompts for the terminal when no dashboard is open', async () => {
    const v = setup({ viewers: false });
    const out = await v.village.handleHook(hook('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'rm -rf dist' } }));
    assert.equal(out, undefined);
    assert.equal(v.online()[0].attention.terminal, true);
  });
});

describe('remote control', () => {
  let v;
  beforeEach(() => { v = setup(); });

  it('should approve a permission request from the village', async () => {
    const pending = v.village.handleHook(hook('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'git push' } }));
    await flush();
    const [req] = v.village.snapshot().requests;
    assert.equal(req.kind, 'permission');
    assert.equal(req.command, 'git push');
    assert.equal(v.online()[0].attention.requestId, req.id);
    v.village.respond(req.id, { decision: 'allow' });
    const out = await pending;
    assert.deepEqual(out, { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } });
    assert.equal(v.village.snapshot().requests.length, 0);
  });

  it('should deny with a message', async () => {
    const pending = v.village.handleHook(hook('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }));
    await flush();
    v.village.respond(v.village.snapshot().requests[0].id, { decision: 'deny', message: 'nope' });
    const out = await pending;
    assert.equal(out.hookSpecificOutput.decision.behavior, 'deny');
    assert.equal(out.hookSpecificOutput.decision.message, 'nope');
  });

  it('should fall back to the terminal after the wait time', async () => {
    const pending = v.village.handleHook(hook('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'x' } }));
    await flush();
    v.advance(46_000);
    assert.equal(await pending, undefined);
    assert.equal(v.online()[0].attention.terminal, true);
  });

  it('should release to the terminal when asked', async () => {
    const pending = v.village.handleHook(hook('PermissionRequest', { tool_name: 'Bash', tool_input: {} }));
    await flush();
    v.village.respond(v.village.snapshot().requests[0].id, null);
    assert.equal(await pending, undefined);
  });

  it('should answer AskUserQuestion for Claude', async () => {
    const questions = [{ question: 'Which DB?', options: [{ label: 'Postgres' }, { label: 'SQLite' }] }];
    const pending = v.village.handleHook(hook('PreToolUse', { tool_name: 'AskUserQuestion', tool_input: { questions } }));
    await flush();
    const [req] = v.village.snapshot().requests;
    assert.equal(req.kind, 'question');
    v.village.respond(req.id, { answers: { 'Which DB?': 'SQLite' } });
    const out = await pending;
    assert.deepEqual(out.hookSpecificOutput.updatedInput, { questions, answers: { 'Which DB?': 'SQLite' } });
    assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  });

  it('should not hold Codex questions (not answerable via hooks)', async () => {
    const out = await v.village.handleHook(hook('PreToolUse', { source: 'codex', tool_name: 'request_user_input', tool_input: { questions: [{ question: 'Q?' }] } }));
    assert.equal(out, undefined);
    assert.equal(v.village.snapshot().requests.length, 0);
  });

  it('should deliver orders to a busy dwarf on the next PostToolUse', async () => {
    await v.village.handleHook(hook('PreToolUse', { tool_name: 'Read', tool_input: { file_path: '/a.ts' } }));
    const id = v.online()[0].id;
    assert.ok(v.village.sendOrder(id, 'Also update the README'));
    assert.equal(v.online()[0].orders, 1);
    const out = await v.village.handleHook(hook('PostToolUse', { tool_name: 'Read' }));
    assert.match(out.hookSpecificOutput.additionalContext, /Also update the README/);
    assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.equal(v.online()[0].orders, 0);
  });

  it('should continue a stopping dwarf with queued orders', async () => {
    await v.village.handleHook(hook('UserPromptSubmit'));
    v.village.sendOrder(v.online()[0].id, 'Now write tests');
    const out = await v.village.handleHook(hook('Stop'));
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /Now write tests/);
    assert.equal(v.online()[0].attention, null);
  });

  it('should keep a leashed dwarf waiting in the village until it gets orders', async () => {
    await v.village.handleHook(hook('UserPromptSubmit'));
    const id = v.online()[0].id;
    v.village.setLeash(id, true);
    const pending = v.village.handleHook(hook('Stop'));
    await flush();
    assert.equal(v.online()[0].attention.leashed, true);
    v.village.sendOrder(id, 'Deploy it');
    const out = await pending;
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /Deploy it/);
  });

  it('should not hold anything in terminal mode', async () => {
    v.village.updateSettings({ approvalMode: 'terminal' });
    const out = await v.village.handleHook(hook('PermissionRequest', { tool_name: 'Bash', tool_input: {} }));
    assert.equal(out, undefined);
  });

  it('should cancel pending requests when the session ends', async () => {
    const pending = v.village.handleHook(hook('PermissionRequest', { tool_name: 'Bash', tool_input: {} }));
    await flush();
    await v.village.handleHook(hook('SessionEnd'));
    assert.equal(await pending, undefined);
    assert.equal(v.village.snapshot().requests.length, 0);
  });
});

describe('usage & cost', () => {
  it('should read Claude transcripts and price them per model', async () => {
    const transcripts = { '/t/s1.jsonl': [
      { type: 'assistant', message: { id: 'm1', model: 'claude-opus-5-5', usage: { input_tokens: 1_000_000, output_tokens: 100_000 } } },
    ] };
    const v = setup({ transcripts });
    await v.village.handleHook(hook('UserPromptSubmit', { transcript_path: '/t/s1.jsonl' }));
    await v.village.handleHook(hook('Stop', { transcript_path: '/t/s1.jsonl' }));
    const a = v.online()[0];
    assert.equal(a.cost, 6); // 4 + 0.1 * 20
    assert.equal(a.tokens, 1_100_000);
    assert.equal(a.modelLabel, 'Opus 5.5');
    const stats = v.village.stats();
    assert.equal(stats.bySource.claude.cost, 6);
    assert.equal(stats.projects[0].name, 'shop');
    assert.equal(stats.models[0].label, 'Opus 5.5');
  });

  it('should read Codex rollouts', async () => {
    const transcripts = { '/c/r.jsonl': [
      { type: 'turn_context', payload: { model: 'gpt-5.5' } },
      { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 1_000_000, cached_input_tokens: 0, output_tokens: 0 } } } },
    ] };
    const v = setup({ transcripts });
    await v.village.handleHook(hook('Stop', { source: 'codex', session_id: 'c1', transcript_path: '/c/r.jsonl' }));
    assert.equal(v.online()[0].cost, 5);
    assert.equal(v.village.stats().bySource.codex.cost, 5);
  });
});

describe('housekeeping', () => {
  it('should send silent dwarves home after the timeout', async () => {
    const v = setup();
    await v.village.handleHook(hook('SessionStart'));
    v.advance(181 * 60_000);
    v.village.tick();
    assert.equal(v.online().length, 0);
    assert.equal(v.fxs('despawn').length, 1);
  });

  it('should support the simple heartbeat API', () => {
    const v = setup();
    v.village.handleHeartbeat({ agent: 'My Bot', activity: 'testing', detail: 'suite' });
    const a = v.online()[0];
    assert.equal(a.activity, 'testing');
    assert.equal(a.source, 'custom');
  });

  it('should level up buildings and emit building updates', async () => {
    const v = setup();
    for (let i = 0; i < 101; i++) {
      await v.village.handleHook(hook('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: `/f${i}.ts` } }));
    }
    const forge = v.village.snapshot().buildings.find(b => b.id === 'forge');
    assert.ok(forge.level >= 2);
    assert.ok(v.fxs('building-level').length >= 1);
  });
});

describe('burn rate & limits', () => {
  it('should report Codex plan limits from rollouts', async () => {
    const transcripts = { '/c/l.jsonl': [
      { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 100, output_tokens: 10 } },
        rate_limits: { plan_type: 'pro', primary: { used_percent: 42.5, window_minutes: 300, resets_at: 1_750_000_900 }, secondary: { used_percent: 12, window_minutes: 10080, resets_at: 1_750_500_000 }, credits: { balance: '100', unlimited: false } } } },
    ] };
    const v = setup({ transcripts });
    await v.village.handleHook(hook('Stop', { source: 'codex', session_id: 'c1', transcript_path: '/c/l.jsonl' }));
    const { limits } = v.village.stats();
    assert.equal(limits.codex.plan, 'pro');
    assert.deepEqual(limits.codex.windows.map(w => w.windowMinutes), [300, 10080]);
    assert.equal(limits.codex.windows[0].usedPercent, 42.5);
    assert.equal(limits.codex.windows[0].resetsAt, 1_750_000_900_000);
    assert.equal(limits.codex.credits.balance, 100);
    assert.ok(v.events.some(e => e.type === 'limits'));
  });

  it('should sum the last 24 hours and estimate the pace', async () => {
    const transcripts = { '/t/b.jsonl': [
      { type: 'assistant', message: { id: 'b1', model: 'claude-haiku-4-5', usage: { input_tokens: 1_000_000, output_tokens: 0 } } },
    ] };
    const v = setup({ transcripts });
    await v.village.handleHook(hook('Stop', { transcript_path: '/t/b.jsonl' }));
    const { burn } = v.village.stats();
    assert.equal(burn.hours.length, 24);
    assert.equal(burn.last24.cost, 1);
    assert.equal(burn.last24.bySource.claude.cost, 1);
    assert.ok(burn.perHour > 0);
    assert.equal(burn.projected24h, burn.perHour * 24);
  });
});

describe('backfill', () => {
  it('should book transcript usage at the time it happened', async () => {
    const twoHoursAgo = new Date(1_750_000_000_000 - 2 * 3_600_000).toISOString();
    const transcripts = { '/t/old.jsonl': [
      { type: 'assistant', timestamp: twoHoursAgo, message: { id: 'o1', model: 'claude-haiku-4-5', usage: { input_tokens: 1_000_000, output_tokens: 0 } } },
    ] };
    const v = setup({ transcripts });
    await v.village.handleHook(hook('Stop', { transcript_path: '/t/old.jsonl' }));
    const { burn } = v.village.stats();
    assert.equal(burn.last24.cost, 1);
    assert.equal(burn.hours[burn.hours.length - 1].cost, 0, 'current hour stays clean');
    assert.equal(burn.hours[burn.hours.length - 3].cost, 1);
  });
});
