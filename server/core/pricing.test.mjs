import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, costOf, modelLabel, tokensOf, DEFAULT_PRICES } from './pricing.mjs';
import { parseClaudeLine, parseCodexLine, addUsage } from './usage.mjs';

describe('priceFor', () => {
  it('should pick the longest matching prefix', () => {
    assert.equal(priceFor('claude-opus-5-5'), DEFAULT_PRICES['claude-opus-5-5']);
    assert.equal(priceFor('claude-opus-5'), DEFAULT_PRICES['claude-opus-5']);
    assert.equal(priceFor('claude-sonnet-4-5-20250929'), DEFAULT_PRICES['claude-sonnet-4']);
  });

  it('should strip provider prefixes and [1m] suffixes', () => {
    assert.equal(priceFor('anthropic.claude-haiku-4-5'), DEFAULT_PRICES['claude-haiku-4-5']);
    assert.equal(priceFor('claude-opus-5-5[1m]'), DEFAULT_PRICES['claude-opus-5-5']);
  });

  it('should fall back per source for unknown models', () => {
    assert.equal(priceFor('mystery', 'codex'), DEFAULT_PRICES['gpt-5.5']);
    assert.equal(priceFor('mystery', 'claude'), DEFAULT_PRICES['claude-sonnet-5-5']);
  });

  it('should honour a custom price table', () => {
    const table = { 'my-model': { input: 1, output: 1, cacheWrite: 1, cacheRead: 1 } };
    assert.equal(costOf({ input: 1_000_000 }, 'my-model', 'claude', table), 1);
  });
});

describe('costOf', () => {
  it('should price Opus 5.5 input, output and cache', () => {
    const usage = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000, cacheWrite1h: 1_000_000 };
    // 4 + 20 + 0.2 + 5 + 8
    assert.equal(costOf(usage, 'claude-opus-5-5', 'claude'), 37.2);
  });

  it('should price GPT-5.5 cached input at the cached rate', () => {
    assert.equal(costOf({ input: 1_000_000, cacheRead: 1_000_000, output: 0 }, 'gpt-5.5', 'codex'), 5.5);
  });

  it('tokensOf should sum every bucket', () => {
    assert.equal(tokensOf({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4, cacheWrite1h: 5 }), 15);
  });
});

describe('modelLabel', () => {
  const cases = [
    ['claude-opus-5-5', 'Opus 5.5'],
    ['claude-sonnet-4-5-20250929', 'Sonnet 4.5'],
    ['claude-haiku-4-5', 'Haiku 4.5'],
    ['claude-fable-5-1', 'Fable 5.1'],
    ['claude-opus-5', 'Opus 5'],
    ['gpt-5.6-sol', 'GPT-5.6 Sol'],
    ['gpt-5.5', 'GPT-5.5'],
  ];
  for (const [id, label] of cases) it(`${id} → ${label}`, () => assert.equal(modelLabel(id), label));
});

describe('parseClaudeLine', () => {
  const line = (id, usage) => ({ type: 'assistant', message: { id, model: 'claude-opus-5-5', usage } });

  it('should normalize usage and split 1h cache writes', () => {
    const rec = parseClaudeLine(line('m1', {
      input_tokens: 2, output_tokens: 375, cache_read_input_tokens: 100,
      cache_creation_input_tokens: 50, cache_creation: { ephemeral_1h_input_tokens: 30 },
    }), new Set());
    assert.deepEqual(rec.usage, { input: 2, output: 375, cacheRead: 100, cacheWrite: 20, cacheWrite1h: 30 });
  });

  it('should count a message id only once', () => {
    const seen = new Set();
    assert.ok(parseClaudeLine(line('m2', { input_tokens: 1, output_tokens: 1 }), seen));
    assert.equal(parseClaudeLine(line('m2', { input_tokens: 1, output_tokens: 1 }), seen), null);
  });

  it('should ignore user lines and synthetic messages', () => {
    assert.equal(parseClaudeLine({ type: 'user' }, new Set()), null);
    assert.equal(parseClaudeLine({ type: 'assistant', message: { model: '<synthetic>', usage: {} } }, new Set()), null);
  });
});

describe('parseCodexLine', () => {
  const tc = (input, cached, output) => ({
    type: 'event_msg',
    payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } } },
  });

  it('should emit deltas of cumulative totals with the current model', () => {
    const state = {};
    assert.equal(parseCodexLine({ type: 'turn_context', payload: { model: 'gpt-5.6-sol' } }, state), null);
    const a = parseCodexLine(tc(1000, 400, 50), state);
    assert.equal(a.model, 'gpt-5.6-sol');
    assert.deepEqual(a.usage, { input: 600, output: 50, cacheRead: 400, cacheWrite: 0, cacheWrite1h: 0 });
    const b = parseCodexLine(tc(1500, 400, 80), state);
    assert.deepEqual(b.usage, { input: 500, output: 30, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 });
  });

  it('should skip repeated totals', () => {
    const state = {};
    parseCodexLine(tc(10, 0, 1), state);
    assert.equal(parseCodexLine(tc(10, 0, 1), state), null);
  });

  it('addUsage should accumulate', () => {
    const a = addUsage({}, { input: 1, output: 2 });
    addUsage(a, { input: 1, cacheRead: 3 });
    assert.deepEqual(a, { input: 2, output: 2, cacheRead: 3, cacheWrite: 0, cacheWrite1h: 0 });
  });
});
