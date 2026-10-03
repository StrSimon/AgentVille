import { createVillage } from '../../server/core/village.mjs';
import { emptyData, createProfile, dayKey, hourKey } from '../../server/core/profiles.mjs';
import type { ServerMessage } from '../types';
import type { Controller } from './controller';
import { DEMO_RESIDENTS, DEMO_SESSIONS, type DemoSession, type Step } from './demo-script';
import { store } from './store';

const HOUR = 3_600_000;

/** Seed residents and 30 days of history so charts look lived-in. */
function seedData() {
  const data = emptyData();
  const now = Date.now();
  for (const r of DEMO_RESIDENTS) {
    const p = createProfile(data, r.id, {
      name: r.name, source: r.source, kind: 'kind' in r ? r.kind : 'main', clan: r.clan,
      agentType: 'agentType' in r ? r.agentType : null, now: now - 20 * 86_400_000,
    });
    p.toolCalls = r.toolCalls;
    p.cost = r.cost;
    p.tokens = Math.round(r.cost * 260_000);
    p.sessions = Math.round(r.toolCalls / 90);
    p.lastSeen = now - Math.random() * 3 * 86_400_000;
    p.usage = { [r.source === 'codex' ? 'gpt-5.5' : 'claude-opus-5-5']: { cost: r.cost, input: p.tokens * 0.1, output: p.tokens * 0.05, cacheRead: p.tokens * 0.85 } };
  }
  for (let d = 29; d >= 1; d--) {
    const weekday = new Date(now - d * 86_400_000).getDay();
    const scale = weekday === 0 || weekday === 6 ? 0.35 : 1;
    data.stats.daily[dayKey(now - d * 86_400_000)] = {
      claude: { cost: (14 + Math.random() * 22) * scale, tokens: 5e6 * scale, toolCalls: Math.round(900 * scale) },
      codex: { cost: (6 + Math.random() * 14) * scale, tokens: 3e6 * scale, toolCalls: Math.round(500 * scale) },
    };
  }
  for (let h = 23; h >= 1; h--) {
    const hourOfDay = new Date(now - h * HOUR).getHours();
    const work = hourOfDay >= 8 && hourOfDay <= 22 ? 1 : 0.1;
    data.stats.hourly[hourKey(now - h * HOUR)] = {
      claude: { cost: (0.6 + Math.random() * 1.8) * work, tokens: 4e5 * work, toolCalls: 60 },
      codex: { cost: (0.2 + Math.random() * 0.9) * work, tokens: 2e5 * work, toolCalls: 30 },
    };
  }
  data.stats.projects = {
    storefront: { claude: { cost: 212, tokens: 8e7, toolCalls: 5200 } },
    'payments-api': { codex: { cost: 88, tokens: 4e7, toolCalls: 2900 } },
    infra: { codex: { cost: 21, tokens: 9e6, toolCalls: 700 }, claude: { cost: 9, tokens: 3e6, toolCalls: 200 } },
    handbook: { claude: { cost: 41, tokens: 1.2e7, toolCalls: 1100 } },
    'mobile-app': { claude: { cost: 64, tokens: 2.1e7, toolCalls: 1800 } },
  };
  data.stats.models = {
    'claude-opus-5-5': { source: 'claude', cost: 268, tokens: 9e7 },
    'claude-sonnet-5-5': { source: 'claude', cost: 58, tokens: 3.4e7 },
    'gpt-5.6-sol': { source: 'codex', cost: 71, tokens: 3e7 },
    'gpt-5.5': { source: 'codex', cost: 38, tokens: 1.6e7 },
  };
  return data;
}

/** Synthetic transcript lines so the demo exercises the real token/cost pipeline. */
function usageLine(session: DemoSession, tokens: number, state: { n: number; total: number }) {
  state.n++;
  if (session.source === 'claude') {
    return {
      type: 'assistant',
      message: {
        id: `${session.id}-${state.n}`,
        model: session.model,
        usage: { input_tokens: Math.round(tokens * 0.05), output_tokens: Math.round(tokens * 0.04), cache_read_input_tokens: Math.round(tokens * 0.9) },
      },
    };
  }
  state.total += tokens;
  const used = Math.min(96, 38 + state.n * 0.6);
  return {
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: { total_token_usage: { input_tokens: state.total, cached_input_tokens: Math.round(state.total * 0.7), output_tokens: Math.round(state.total * 0.06) } },
      rate_limits: {
        plan_type: 'pro',
        primary: { used_percent: used, window_minutes: 300, resets_at: Math.round(Date.now() / 1000) + 2 * 3600 + 900 },
        secondary: { used_percent: 22 + state.n * 0.1, window_minutes: 10080, resets_at: Math.round(Date.now() / 1000) + 4 * 86400 },
        credits: null,
      },
    },
  };
}

export function createDemoController(): Controller {
  store.reset();
  const pending = new Map<string, unknown[]>();
  const village = createVillage({
    data: seedData(),
    emit: (msg: ServerMessage) => store.dispatch(msg),
    hasViewers: () => true,
    readTranscript: (path: string) => pending.get(path)?.splice(0) ?? [],
  });
  village.setLimits('claude', {
    plan: 'max',
    windows: [
      { usedPercent: 47, windowMinutes: 300, resetsAt: Date.now() + 2.6 * HOUR },
      { usedPercent: 31, windowMinutes: 10080, resetsAt: Date.now() + 3.2 * 86_400_000 },
    ],
    credits: null,
    reached: null,
  });
  store.dispatch(village.snapshot() as ServerMessage);

  let running = true;
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  async function runSession(session: DemoSession, offset: number) {
    const path = `/demo/${session.id}.jsonl`;
    const usage = { n: 0, total: 0 };
    pending.set(path, []);
    await sleep(offset);
    let round = 0;
    while (running) {
      const sessionId = `${session.id}-${round}`;
      const base = { source: session.source, session_id: sessionId, project: session.project, transcript_path: path, model: session.model };
      await village.handleHook({ ...base, event: 'SessionStart' });
      for (let loop = 0; loop < 3 && running; loop++) {
        for (const step of session.script() as Step[]) {
          if (!running) return;
          if (step.tokens) pending.get(path)!.push(usageLine(session, step.tokens, usage));
          await village.handleHook({
            ...base,
            event: step.event,
            tool_name: step.tool,
            tool_input: step.input,
            agent_id: step.agent?.id ? `${step.agent.id}-${round}-${loop}` : undefined,
            agent_type: step.agent?.type,
            input_bytes: step.event === 'PostToolUse' ? 1200 : undefined,
            output_bytes: step.event === 'PostToolUse' ? 5400 : undefined,
          });
          await sleep(step.wait * (0.7 + Math.random() * 0.6));
        }
      }
      await village.handleHook({ ...base, event: 'SessionEnd' });
      await sleep(8000);
      round++;
    }
  }

  DEMO_SESSIONS.forEach((s, i) => { void runSession(s, i * 2500); });
  const ticker = setInterval(() => village.tick(), 5000);

  return {
    mode: 'demo',
    respond: async (id, answer) => village.respond(id, answer.release ? null : answer),
    sendOrder: async (id, text) => village.sendOrder(id, text),
    setLeash: async (id, on) => village.setLeash(id, on),
    saveSettings: async (patch) => { village.updateSettings(patch); },
    setupStatus: async () => null,
    setup: async () => null,
    stop: () => { running = false; clearInterval(ticker); },
  };
}
