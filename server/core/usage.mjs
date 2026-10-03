// ── Transcript usage parsing ─────────────────────────────
// Claude Code and Codex both write a JSONL transcript per session.
// These pure helpers turn single transcript lines into normalized
// usage records: { input, output, cacheRead, cacheWrite, cacheWrite1h }.

/**
 * Claude Code: assistant lines carry `message.usage`. The same message id can
 * appear on several lines (one per content block), so callers pass a `seen` set.
 * @returns {{ model: string, usage: object } | null}
 */
export function parseClaudeLine(entry, seen) {
  if (!entry || entry.type !== 'assistant') return null;
  const msg = entry.message;
  const u = msg?.usage;
  if (!u || !msg.model || msg.model === '<synthetic>') return null;
  const key = msg.id || entry.requestId || entry.uuid;
  if (key) {
    if (seen.has(key)) return null;
    seen.add(key);
  }
  const cw1h = u.cache_creation?.ephemeral_1h_input_tokens || 0;
  const cwTotal = u.cache_creation_input_tokens || 0;
  return {
    model: msg.model,
    at: Date.parse(entry.timestamp) || null,
    usage: {
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
      cacheWrite: Math.max(0, cwTotal - cw1h),
      cacheWrite1h: cw1h,
    },
  };
}

/**
 * Codex: `turn_context` lines carry the model, `token_count` events carry
 * cumulative `total_token_usage`. OpenAI counts cached tokens inside input_tokens.
 * `state` = { model, total } is kept per transcript between calls.
 * @returns {{ model: string, usage: object } | null}
 */
export function parseCodexLine(entry, state) {
  if (!entry) return null;
  const payload = entry.payload;
  if (entry.type === 'turn_context' && payload?.model) {
    state.model = payload.model;
    return null;
  }
  if (entry.type === 'session_meta' && payload?.model && !state.model) {
    state.model = payload.model;
    return null;
  }
  if (entry.type !== 'event_msg' || payload?.type !== 'token_count') return null;
  const total = payload.info?.total_token_usage;
  if (!total) return null;
  const prev = state.total || { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, cache_write_input_tokens: 0 };
  const d = (k) => Math.max(0, (total[k] || 0) - (prev[k] || 0));
  state.total = total;
  const cached = d('cached_input_tokens');
  const usage = {
    input: Math.max(0, d('input_tokens') - cached),
    output: d('output_tokens'),
    cacheRead: cached,
    cacheWrite: d('cache_write_input_tokens'),
    cacheWrite1h: 0,
  };
  if (!usage.input && !usage.output && !usage.cacheRead && !usage.cacheWrite) return null;
  return { model: state.model || 'gpt-5.5', at: Date.parse(entry.timestamp) || null, usage };
}

/** Add usage b into a (mutates a). */
export function addUsage(a, b) {
  a.input = (a.input || 0) + (b.input || 0);
  a.output = (a.output || 0) + (b.output || 0);
  a.cacheRead = (a.cacheRead || 0) + (b.cacheRead || 0);
  a.cacheWrite = (a.cacheWrite || 0) + (b.cacheWrite || 0);
  a.cacheWrite1h = (a.cacheWrite1h || 0) + (b.cacheWrite1h || 0);
  return a;
}

/**
 * Codex: `token_count` events also carry the account's plan limits.
 * @returns {{ plan: string|null, windows: Array<{ usedPercent: number, windowMinutes: number, resetsAt: number|null }>,
 *   credits: { balance: number|null, unlimited: boolean } | null, reached: string|null } | null}
 */
export function parseCodexLimits(entry) {
  const rl = entry?.type === 'event_msg' && entry.payload?.type === 'token_count' ? entry.payload.rate_limits : null;
  if (!rl) return null;
  const windows = [rl.primary, rl.secondary]
    .filter(w => w && typeof w.used_percent === 'number')
    .map(w => ({
      usedPercent: w.used_percent,
      windowMinutes: w.window_minutes || null,
      resetsAt: w.resets_at ? w.resets_at * 1000 : null,
    }));
  const credits = rl.credits
    ? { balance: rl.credits.balance != null ? Number(rl.credits.balance) : null, unlimited: !!rl.credits.unlimited }
    : null;
  return { plan: rl.plan_type || null, windows, credits, reached: rl.rate_limit_reached_type || null };
}

/**
 * Claude Code: the status line input carries `rate_limits` for Pro/Max plans.
 * @returns same shape as parseCodexLimits, or null when no limits are present.
 */
export function parseClaudeLimits(rateLimits) {
  if (!rateLimits || typeof rateLimits !== 'object') return null;
  const win = (w, minutes) => (w && typeof w.used_percentage === 'number'
    ? { usedPercent: w.used_percentage, windowMinutes: minutes, resetsAt: w.resets_at ? w.resets_at * 1000 : null }
    : null);
  const windows = [win(rateLimits.five_hour, 300), win(rateLimits.seven_day, 10080)].filter(Boolean);
  const s = rateLimits.spend_limit;
  const spend = s && typeof s.used_percentage === 'number'
    ? { usedPercent: s.used_percentage, usedUsd: s.used_usd ?? null, limitUsd: s.limit_usd ?? null, period: s.period || null, resetsAt: s.resets_at ? s.resets_at * 1000 : null }
    : null;
  if (!windows.length && !spend) return null;
  return { plan: null, windows, credits: null, spend, reached: null };
}
