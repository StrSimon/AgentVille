/**
 * Tests for the Agent Store (XP, levels, profiles, recording).
 * Run: node --test server/agentStore.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getLevel,
  getNextLevel,
  calculateXP,
  getProfile,
  getStoredName,
  recordToolUse,
  recordBytes,
  recordActivity,
  recordSession,
  recordSubAgentSpawn,
  getEnrichedProfile,
  getAllProfiles,
} from './agentStore.mjs';

// ── Level System ────────────────────────────────────────

describe('getLevel', () => {
  it('should return Apprentice for 0 XP', () => {
    const lvl = getLevel(0);
    assert.equal(lvl.level, 1);
    assert.equal(lvl.title, 'Apprentice');
  });

  it('should return Journeyman at exactly 50 XP', () => {
    const lvl = getLevel(50);
    assert.equal(lvl.level, 2);
    assert.equal(lvl.title, 'Journeyman');
  });

  it('should return Craftsman at 200 XP', () => {
    assert.equal(getLevel(200).level, 3);
  });

  it('should return Smith at 500 XP', () => {
    assert.equal(getLevel(500).level, 4);
  });

  it('should return Master at 1200 XP', () => {
    assert.equal(getLevel(1200).level, 5);
  });

  it('should return Grand Master at 3000 XP', () => {
    assert.equal(getLevel(3000).level, 6);
  });

  it('should return Rune Master at 7000 XP', () => {
    assert.equal(getLevel(7000).level, 7);
  });

  it('should return Legendary at 15000 XP', () => {
    assert.equal(getLevel(15000).level, 8);
  });

  it('should return Mythical at 30000 XP', () => {
    assert.equal(getLevel(30000).level, 9);
  });

  it('should return Divine at exactly 60000 XP', () => {
    const lvl = getLevel(60000);
    assert.equal(lvl.level, 10);
    assert.equal(lvl.title, 'Divine');
  });

  it('should still return Divine for XP far beyond max', () => {
    const lvl = getLevel(999999);
    assert.equal(lvl.level, 10);
    assert.equal(lvl.title, 'Divine');
  });

  it('should return Apprentice for 49 XP (just below Journeyman)', () => {
    assert.equal(getLevel(49).level, 1);
  });

  it('should return the correct level for values between thresholds', () => {
    assert.equal(getLevel(100).level, 2); // between 50 and 200
    assert.equal(getLevel(400).level, 3); // between 200 and 500
    assert.equal(getLevel(1000).level, 4); // between 500 and 1200
  });
});

describe('getNextLevel', () => {
  it('should return Journeyman as next level for 0 XP', () => {
    const next = getNextLevel(0);
    assert.equal(next.level, 2);
    assert.equal(next.title, 'Journeyman');
    assert.equal(next.minXP, 50);
  });

  it('should return Craftsman as next level for 50 XP', () => {
    const next = getNextLevel(50);
    assert.equal(next.level, 3);
    assert.equal(next.minXP, 200);
  });

  it('should return null when already at max level', () => {
    assert.equal(getNextLevel(60000), null);
  });

  it('should return null for XP far beyond max', () => {
    assert.equal(getNextLevel(999999), null);
  });

  it('should return correct next level at boundary -1', () => {
    const next = getNextLevel(49);
    assert.equal(next.level, 2);
    assert.equal(next.minXP, 50);
  });
});

// ── XP Calculation ──────────────────────────────────────

describe('calculateXP', () => {
  it('should return toolCalls when no bytes', () => {
    assert.equal(calculateXP({ toolCalls: 10, totalInputBytes: 0, totalOutputBytes: 0, totalBytes: 0 }), 10);
  });

  it('should add 1 XP per 5000 bytes', () => {
    assert.equal(calculateXP({ toolCalls: 0, totalInputBytes: 5000, totalOutputBytes: 0, totalBytes: 0 }), 1);
  });

  it('should floor the bytes bonus', () => {
    assert.equal(calculateXP({ toolCalls: 0, totalInputBytes: 4999, totalOutputBytes: 0, totalBytes: 0 }), 0);
  });

  it('should sum all byte sources', () => {
    const xp = calculateXP({ toolCalls: 5, totalInputBytes: 3000, totalOutputBytes: 2000, totalBytes: 5000 });
    // bytes = 3000 + 2000 + 5000 = 10000 → floor(10000/5000) = 2
    assert.equal(xp, 5 + 2);
  });

  it('should handle missing byte fields gracefully', () => {
    assert.equal(calculateXP({ toolCalls: 3 }), 3);
  });

  it('should handle zero toolCalls with large bytes', () => {
    assert.equal(calculateXP({ toolCalls: 0, totalInputBytes: 25000, totalOutputBytes: 0, totalBytes: 0 }), 5);
  });
});

// ── Profile Management ──────────────────────────────────

describe('getProfile', () => {
  it('should create a new profile with correct defaults', () => {
    const p = getProfile('test-new-agent', 'Grimbar');
    assert.equal(p.name, 'Grimbar');
    assert.equal(p.toolCalls, 0);
    assert.equal(p.totalInputBytes, 0);
    assert.equal(p.totalOutputBytes, 0);
    assert.equal(p.sessions, 0);
    assert.equal(p.subAgentsSpawned, 0);
    assert.equal(p.parentId, null);
    assert.equal(p.clan, null);
    assert.ok(Array.isArray(p.recentActivity));
    assert.ok(p.firstSeen > 0);
    assert.ok(p.lastSeen > 0);
  });

  it('should return the same profile on second call', () => {
    const p1 = getProfile('test-same-agent', 'Dunrik');
    p1.toolCalls = 42;
    const p2 = getProfile('test-same-agent', 'Dunrik');
    assert.equal(p2.toolCalls, 42);
  });

  it('should set parentId on creation', () => {
    const p = getProfile('test-child-agent', 'Brunhild', 'test-parent');
    assert.equal(p.parentId, 'test-parent');
  });

  it('should set parentId on existing profile if not already set', () => {
    getProfile('test-orphan', 'Orphan');
    const p = getProfile('test-orphan', 'Orphan', 'new-parent');
    assert.equal(p.parentId, 'new-parent');
  });

  it('should not overwrite existing parentId', () => {
    getProfile('test-has-parent', 'HasParent', 'original-parent');
    const p = getProfile('test-has-parent', 'HasParent', 'different-parent');
    assert.equal(p.parentId, 'original-parent');
  });

  it('should set clan on creation', () => {
    const p = getProfile('test-clan-agent', 'ClanAgent', null, 'my-project');
    assert.equal(p.clan, 'my-project');
  });

  it('should update clan if changed', () => {
    getProfile('test-clan-change', 'ClanChange', null, 'old-clan');
    const p = getProfile('test-clan-change', 'ClanChange', null, 'new-clan');
    assert.equal(p.clan, 'new-clan');
  });

  it('should update name if changed', () => {
    getProfile('test-rename', 'OldName');
    const p = getProfile('test-rename', 'NewName');
    assert.equal(p.name, 'NewName');
  });
});

describe('getStoredName', () => {
  it('should return name for known agent', () => {
    getProfile('test-stored-name', 'Thorgrim');
    assert.equal(getStoredName('test-stored-name'), 'Thorgrim');
  });

  it('should return null for unknown agent', () => {
    assert.equal(getStoredName('totally-unknown-agent'), null);
  });
});

// ── Recording Functions ─────────────────────────────────

describe('recordToolUse', () => {
  it('should increment toolCalls', () => {
    const p = getProfile('test-tool-use', 'ToolUser');
    assert.equal(p.toolCalls, 0);
    recordToolUse('test-tool-use');
    assert.equal(p.toolCalls, 1);
    recordToolUse('test-tool-use');
    assert.equal(p.toolCalls, 2);
  });

  it('should update lastSeen', () => {
    const p = getProfile('test-tool-time', 'ToolTimer');
    const before = p.lastSeen;
    recordToolUse('test-tool-time');
    assert.ok(p.lastSeen >= before);
  });

  it('should be a no-op for unknown agents', () => {
    // Should not throw
    recordToolUse('nonexistent-agent-xyz');
  });
});

describe('recordBytes', () => {
  it('should add input and output bytes', () => {
    const p = getProfile('test-bytes', 'ByteCounter');
    recordBytes('test-bytes', 1000, 2000);
    assert.equal(p.totalInputBytes, 1000);
    assert.equal(p.totalOutputBytes, 2000);
  });

  it('should accumulate across multiple calls', () => {
    const p = getProfile('test-bytes-accum', 'Accumulator');
    recordBytes('test-bytes-accum', 500, 500);
    recordBytes('test-bytes-accum', 300, 700);
    assert.equal(p.totalInputBytes, 800);
    assert.equal(p.totalOutputBytes, 1200);
  });

  it('should be a no-op for unknown agents', () => {
    recordBytes('nonexistent-agent-bytes', 100, 200);
  });
});

describe('recordActivity', () => {
  it('should append activity to recentActivity', () => {
    const p = getProfile('test-activity', 'Activist');
    recordActivity('test-activity', 'coding', 'App.tsx');
    assert.equal(p.recentActivity.length, 1);
    assert.equal(p.recentActivity[0].activity, 'coding');
    assert.equal(p.recentActivity[0].detail, 'App.tsx');
    assert.ok(p.recentActivity[0].timestamp > 0);
  });

  it('should cap at 20 entries', () => {
    const p = getProfile('test-activity-cap', 'Capper');
    for (let i = 0; i < 25; i++) {
      recordActivity('test-activity-cap', 'coding', `file-${i}.ts`);
    }
    assert.equal(p.recentActivity.length, 20);
    // Should keep the most recent entries
    assert.equal(p.recentActivity[19].detail, 'file-24.ts');
    assert.equal(p.recentActivity[0].detail, 'file-5.ts');
  });

  it('should initialize recentActivity if missing', () => {
    const p = getProfile('test-activity-init', 'Initter');
    delete p.recentActivity;
    recordActivity('test-activity-init', 'testing', 'test.mjs');
    assert.ok(Array.isArray(p.recentActivity));
    assert.equal(p.recentActivity.length, 1);
  });

  it('should be a no-op for unknown agents', () => {
    recordActivity('nonexistent-activity', 'coding', 'nope');
  });
});

describe('recordSession', () => {
  it('should increment sessions count', () => {
    const p = getProfile('test-session', 'SessionCounter');
    assert.equal(p.sessions, 0);
    recordSession('test-session');
    assert.equal(p.sessions, 1);
    recordSession('test-session');
    assert.equal(p.sessions, 2);
  });

  it('should be a no-op for unknown agents', () => {
    recordSession('nonexistent-session');
  });
});

describe('recordSubAgentSpawn', () => {
  it('should increment subAgentsSpawned', () => {
    const p = getProfile('test-spawner', 'Spawner');
    assert.equal(p.subAgentsSpawned, 0);
    recordSubAgentSpawn('test-spawner');
    assert.equal(p.subAgentsSpawned, 1);
    recordSubAgentSpawn('test-spawner');
    assert.equal(p.subAgentsSpawned, 2);
  });

  it('should be a no-op for unknown agents', () => {
    recordSubAgentSpawn('nonexistent-spawner');
  });
});

// ── Enriched Profiles ───────────────────────────────────

describe('getEnrichedProfile', () => {
  it('should return null for unknown agent', () => {
    assert.equal(getEnrichedProfile('nonexistent-enriched'), null);
  });

  it('should compute XP and level correctly', () => {
    const p = getProfile('test-enriched', 'Enriched');
    p.toolCalls = 100;
    p.totalInputBytes = 10000;
    p.totalOutputBytes = 5000;

    const enriched = getEnrichedProfile('test-enriched');
    // XP = 100 + floor(15000/5000) = 103
    assert.equal(enriched.xp, 103);
    assert.equal(enriched.level, 2); // Journeyman (50-199)
    assert.equal(enriched.title, 'Journeyman');
    assert.equal(enriched.nextLevelXP, 200);
    assert.equal(enriched.nextTitle, 'Craftsman');
  });

  it('should return null nextLevelXP at max level', () => {
    const p = getProfile('test-max-level', 'MaxLevel');
    p.toolCalls = 60000;

    const enriched = getEnrichedProfile('test-max-level');
    assert.equal(enriched.level, 10);
    assert.equal(enriched.title, 'Divine');
    assert.equal(enriched.nextLevelXP, null);
    assert.equal(enriched.nextTitle, null);
  });

  it('should include recentActivity as array', () => {
    getProfile('test-enriched-activity', 'WithActivity');
    recordActivity('test-enriched-activity', 'coding', 'test.ts');
    const enriched = getEnrichedProfile('test-enriched-activity');
    assert.ok(Array.isArray(enriched.recentActivity));
    assert.equal(enriched.recentActivity.length, 1);
  });

  it('should handle legacy totalBytes field', () => {
    const p = getProfile('test-legacy-bytes', 'Legacy');
    p.totalBytes = 10000;
    p.totalInputBytes = 0;
    p.totalOutputBytes = 0;

    const enriched = getEnrichedProfile('test-legacy-bytes');
    // Legacy split: ceil(10000/2) = 5000 for input, floor(10000/2) = 5000 for output
    assert.equal(enriched.totalInputBytes, 5000);
    assert.equal(enriched.totalOutputBytes, 5000);
  });

  it('should include clan field', () => {
    getProfile('test-enriched-clan', 'Clanner', null, 'my-project');
    const enriched = getEnrichedProfile('test-enriched-clan');
    assert.equal(enriched.clan, 'my-project');
  });
});

describe('getAllProfiles', () => {
  it('should return an array', () => {
    const profiles = getAllProfiles();
    assert.ok(Array.isArray(profiles));
  });

  it('should include agentId, name, xp, level, title for each profile', () => {
    getProfile('test-all-profiles', 'ListedAgent');
    const profiles = getAllProfiles();
    const found = profiles.find(p => p.agentId === 'test-all-profiles');
    assert.ok(found);
    assert.equal(found.name, 'ListedAgent');
    assert.equal(typeof found.xp, 'number');
    assert.equal(typeof found.level, 'number');
    assert.equal(typeof found.title, 'string');
    assert.equal(typeof found.toolCalls, 'number');
    assert.equal(typeof found.sessions, 'number');
  });

  it('should include computed fields', () => {
    const p = getProfile('test-all-computed', 'Computed');
    p.toolCalls = 250;
    const profiles = getAllProfiles();
    const found = profiles.find(p => p.agentId === 'test-all-computed');
    assert.equal(found.xp, 250);
    assert.equal(found.level, 3); // Craftsman at 200+
    assert.equal(found.nextLevelXP, 500);
  });

  it('should default subAgentsSpawned and parentId', () => {
    getProfile('test-all-defaults', 'Defaults');
    const profiles = getAllProfiles();
    const found = profiles.find(p => p.agentId === 'test-all-defaults');
    assert.equal(found.subAgentsSpawned, 0);
    assert.equal(found.parentId, null);
  });
});
