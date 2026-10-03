// ── Model pricing (USD per 1M tokens) ────────────────────
// API list prices as of 2026-10. Subscription users (Claude Max, ChatGPT Plus/Pro)
// don't pay per token — the dashboard labels these numbers "API value".
// Users can override or extend the table via ~/.agentville/prices.json.
// Matching is by longest prefix of the model id, so dated suffixes still match.

export const DEFAULT_PRICES = {
  // Anthropic — cacheWrite = 5-minute cache write
  'claude-fable-5-1':  { input: 10,  output: 50, cacheWrite: 12.5,  cacheRead: 0.25 },
  'claude-fable-5':    { input: 10,  output: 50, cacheWrite: 12.5,  cacheRead: 1.0 },
  'claude-mythos':     { input: 10,  output: 50, cacheWrite: 12.5,  cacheRead: 1.0 },
  'claude-opus-5-5':   { input: 4,   output: 20, cacheWrite: 5,     cacheRead: 0.2 },
  'claude-opus-5':     { input: 5,   output: 25, cacheWrite: 6.25,  cacheRead: 0.5 },
  'claude-opus-4-8':   { input: 5,   output: 25, cacheWrite: 6.25,  cacheRead: 0.5 },
  'claude-opus-4-7':   { input: 5,   output: 25, cacheWrite: 6.25,  cacheRead: 0.5 },
  'claude-opus-4-6':   { input: 5,   output: 25, cacheWrite: 6.25,  cacheRead: 0.5 },
  'claude-opus-4-5':   { input: 5,   output: 25, cacheWrite: 6.25,  cacheRead: 0.5 },
  'claude-opus-4':     { input: 15,  output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-5-5': { input: 2,   output: 10, cacheWrite: 2.5,   cacheRead: 0.2 },
  'claude-sonnet-5':   { input: 2,   output: 10, cacheWrite: 2.5,   cacheRead: 0.2 },
  'claude-sonnet-4':   { input: 3,   output: 15, cacheWrite: 3.75,  cacheRead: 0.3 },
  'claude-haiku-4-5':  { input: 1,   output: 5,  cacheWrite: 1.25,  cacheRead: 0.1 },
  'claude-3-5-haiku':  { input: 0.8, output: 4,  cacheWrite: 1,     cacheRead: 0.08 },
  // OpenAI — cacheRead = cached input
  'gpt-6-astra':       { input: 10,   output: 50,  cacheWrite: 12.5,  cacheRead: 1.0 },
  'gpt-6.1-sol':       { input: 2,    output: 10,  cacheWrite: 2.5,   cacheRead: 0.1 },
  'gpt-6-luna':        { input: 0.1,  output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  'gpt-5.6-sol':       { input: 4,    output: 20,  cacheWrite: 5,     cacheRead: 0.4 },
  'gpt-5.6-terra':     { input: 2,    output: 12,  cacheWrite: 2.5,   cacheRead: 0.2 },
  'gpt-5.6-luna':      { input: 0.2,  output: 1.2, cacheWrite: 0.25,  cacheRead: 0.02 },
  'gpt-5.5':           { input: 5,    output: 30,  cacheWrite: 0,     cacheRead: 0.5 },
  'gpt-5.4':           { input: 2.5,  output: 15,  cacheWrite: 0,     cacheRead: 0.25 },
  'gpt-5.3-codex':     { input: 1.75, output: 14,  cacheWrite: 0,     cacheRead: 0.175 },
  'gpt-5':             { input: 1.25, output: 10,  cacheWrite: 0,     cacheRead: 0.125 },
  'codex-mini':        { input: 1.5,  output: 6,   cacheWrite: 0,     cacheRead: 0.375 },
};

/** Fallbacks when a model id is unknown — keeps estimates in a sane range. */
const SOURCE_FALLBACK = {
  claude: DEFAULT_PRICES['claude-sonnet-5-5'],
  codex: DEFAULT_PRICES['gpt-5.5'],
};

/** Find the price entry for a model id (longest matching prefix wins). */
export function priceFor(model, source, table = DEFAULT_PRICES) {
  const id = String(model || '').toLowerCase().replace(/^(anthropic|openai)[./]/, '').replace(/\[1m\]$/, '');
  let best = null;
  for (const key of Object.keys(table)) {
    if (id.startsWith(key) && (!best || key.length > best.length)) best = key;
  }
  if (best) return table[best];
  return SOURCE_FALLBACK[source] || SOURCE_FALLBACK.claude;
}

/**
 * Cost in USD for a normalized usage record.
 * `input` excludes cached tokens; cache reads/writes are counted separately.
 * 1-hour cache writes cost 2× input (Anthropic), 5-minute writes use `cacheWrite`.
 */
export function costOf(usage, model, source, table) {
  const p = priceFor(model, source, table);
  return (
    (usage.input || 0) * p.input +
    (usage.output || 0) * p.output +
    (usage.cacheWrite || 0) * (p.cacheWrite || p.input) +
    (usage.cacheWrite1h || 0) * p.input * 2 +
    (usage.cacheRead || 0) * p.cacheRead
  ) / 1_000_000;
}

/** Total tokens of a normalized usage record. */
export function tokensOf(u) {
  return (u.input || 0) + (u.output || 0) + (u.cacheRead || 0) + (u.cacheWrite || 0) + (u.cacheWrite1h || 0);
}

/** Friendly model label: "claude-opus-5-5" → "Opus 5.5", "gpt-5.6-sol" → "GPT-5.6 Sol". */
export function modelLabel(model) {
  const m = String(model || '').toLowerCase();
  const claude = /^claude-(?:3-5-)?(fable|mythos|opus|sonnet|haiku)-?(\d+)?(?:-(\d+))?/.exec(m);
  if (claude) {
    const family = claude[1][0].toUpperCase() + claude[1].slice(1);
    const ver = claude[2] ? (claude[3] && claude[3].length <= 2 ? `${claude[2]}.${claude[3]}` : claude[2]) : '';
    return ver ? `${family} ${ver}` : family;
  }
  const gpt = /^gpt-([\d.]+)(?:-(\w+))?/.exec(m);
  if (gpt) {
    const variant = gpt[2] ? ' ' + gpt[2][0].toUpperCase() + gpt[2].slice(1) : '';
    return `GPT-${gpt[1]}${variant}`;
  }
  return model || 'unknown';
}
