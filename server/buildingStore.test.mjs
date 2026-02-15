/**
 * Unit tests for the buildingStore pure functions.
 * Uses native Node.js test runner (node --test).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, getNextLevel, calculateXP } from './buildingStore.mjs';

// ── getLevel ─────────────────────────────────────────────

describe('getLevel()', () => {
  it('should return level 1 for 0 XP', () => {
    const lvl = getLevel(0, 'forge');
    assert.equal(lvl.level, 1);
    assert.equal(lvl.title, 'Outpost');
  });

  it('should return level 2 at exactly 100 XP', () => {
    const lvl = getLevel(100, 'forge');
    assert.equal(lvl.level, 2);
    assert.equal(lvl.title, 'Workshop');
  });

  it('should return level 1 at 99 XP', () => {
    const lvl = getLevel(99, 'forge');
    assert.equal(lvl.level, 1);
  });

  it('should return level 10 at 300000 XP', () => {
    const lvl = getLevel(300000, 'forge');
    assert.equal(lvl.level, 10);
    assert.equal(lvl.title, 'Eternal Nexus');
  });

  it('should return level 10 above max XP threshold', () => {
    const lvl = getLevel(999999, 'forge');
    assert.equal(lvl.level, 10);
  });

  it('should use campfire titles for campfire building', () => {
    const lvl = getLevel(0, 'campfire');
    assert.equal(lvl.title, 'Campsite');
  });

  it('should return correct campfire level at 500 XP', () => {
    const lvl = getLevel(500, 'campfire');
    assert.equal(lvl.level, 3);
    assert.equal(lvl.title, 'Meeting Place');
  });

  it('should return max campfire level at 300000 XP', () => {
    const lvl = getLevel(300000, 'campfire');
    assert.equal(lvl.level, 10);
    assert.equal(lvl.title, 'Heart of Village');
  });

  it('should handle mid-level XP correctly (level 5 at 4000)', () => {
    const lvl = getLevel(4000, 'forge');
    assert.equal(lvl.level, 5);
    assert.equal(lvl.title, 'Citadel');
  });

  it('should handle XP just below a threshold (3999)', () => {
    const lvl = getLevel(3999, 'forge');
    assert.equal(lvl.level, 4);
    assert.equal(lvl.title, 'Stronghold');
  });
});

// ── getNextLevel ─────────────────────────────────────────

describe('getNextLevel()', () => {
  it('should return level 2 as next for 0 XP', () => {
    const next = getNextLevel(0, 'forge');
    assert.equal(next.level, 2);
    assert.equal(next.minXP, 100);
  });

  it('should return level 3 as next for 100 XP', () => {
    const next = getNextLevel(100, 'forge');
    assert.equal(next.level, 3);
    assert.equal(next.minXP, 500);
  });

  it('should return null at max level', () => {
    const next = getNextLevel(300000, 'forge');
    assert.equal(next, null);
  });

  it('should return null above max XP', () => {
    const next = getNextLevel(999999, 'forge');
    assert.equal(next, null);
  });

  it('should work for campfire buildings', () => {
    const next = getNextLevel(0, 'campfire');
    assert.equal(next.level, 2);
    assert.equal(next.title, 'Gathering');
  });

  it('should return correct next for mid-level XP', () => {
    const next = getNextLevel(1500, 'forge');
    assert.equal(next.level, 5);
    assert.equal(next.minXP, 4000);
  });
});

// ── calculateXP ──────────────────────────────────────────

describe('calculateXP()', () => {
  it('should return 0 for empty profile', () => {
    const xp = calculateXP({});
    assert.equal(xp, 0);
  });

  it('should count tool calls as 1 XP each', () => {
    const xp = calculateXP({ toolCalls: 42 });
    assert.equal(xp, 42);
  });

  it('should calculate bytes bonus as floor(total/10000)', () => {
    const xp = calculateXP({ totalInputBytes: 15000, totalOutputBytes: 5000 });
    assert.equal(xp, 2); // floor(20000/10000) = 2
  });

  it('should not give bytes bonus below 10000 total', () => {
    const xp = calculateXP({ totalInputBytes: 5000, totalOutputBytes: 4999 });
    assert.equal(xp, 0); // floor(9999/10000) = 0
  });

  it('should count visits as 1 XP each', () => {
    const xp = calculateXP({ totalVisits: 10 });
    assert.equal(xp, 10);
  });

  it('should sum all XP sources', () => {
    const xp = calculateXP({
      toolCalls: 50,
      totalInputBytes: 30000,
      totalOutputBytes: 20000,
      totalVisits: 15,
    });
    // 50 + floor(50000/10000) + 15 = 50 + 5 + 15 = 70
    assert.equal(xp, 70);
  });

  it('should handle missing fields gracefully', () => {
    const xp = calculateXP({ toolCalls: 5 });
    assert.equal(xp, 5);
  });
});
