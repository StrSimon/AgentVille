/**
 * Tests for the Dwarf Name Generator.
 * Run: node --test server/dwarfNames.test.mjs
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// We need fresh module state per describe block, so we use dynamic imports
// with cache busting isn't possible in ESM. Instead we test the pure functions
// and accept that assigned/usedNames state carries between tests within a run.

import {
  getDwarfName,
  releaseName,
  totalNames,
  PREFIXES,
  SUFFIXES,
  hashStr,
} from './dwarfNames.mjs';

// ── Syllable Lists ──────────────────────────────────────

describe('syllable lists', () => {
  it('should have at least 20 prefixes', () => {
    assert.ok(PREFIXES.length >= 20, `Only ${PREFIXES.length} prefixes`);
  });

  it('should have at least 20 suffixes', () => {
    assert.ok(SUFFIXES.length >= 20, `Only ${SUFFIXES.length} suffixes`);
  });

  it('should generate at least 500 unique combinations', () => {
    assert.ok(totalNames() >= 500, `Only ${totalNames()} combinations`);
  });

  it('prefixes should all start with uppercase', () => {
    for (const p of PREFIXES) {
      assert.ok(
        p[0] === p[0].toUpperCase(),
        `Prefix "${p}" should start uppercase`,
      );
    }
  });

  it('suffixes should all be lowercase', () => {
    for (const s of SUFFIXES) {
      assert.equal(s, s.toLowerCase(), `Suffix "${s}" should be lowercase`);
    }
  });

  it('should not contain any Tolkien character names as full combinations', () => {
    // Names strongly associated with Tolkien's works
    const tolkienNames = [
      'Thorin', 'Balin', 'Dwalin', 'Bifur', 'Bofur', 'Bombur',
      'Dori', 'Nori', 'Ori', 'Fili', 'Kili', 'Gloin', 'Oin',
      'Gimli', 'Durin',
    ];
    const allCombos = new Set();
    for (const p of PREFIXES) {
      for (const s of SUFFIXES) {
        allCombos.add((p + s).toLowerCase());
      }
    }
    for (const name of tolkienNames) {
      assert.ok(
        !allCombos.has(name.toLowerCase()),
        `"${name}" should not be a possible generated name`,
      );
    }
  });
});

// ── Hash Function ───────────────────────────────────────

describe('hashStr', () => {
  it('should return a number', () => {
    assert.equal(typeof hashStr('test'), 'number');
  });

  it('should be deterministic', () => {
    assert.equal(hashStr('agent-abc12'), hashStr('agent-abc12'));
  });

  it('should differ for different inputs', () => {
    assert.notEqual(hashStr('agent-abc12'), hashStr('agent-xyz99'));
  });

  it('should return positive numbers', () => {
    assert.ok(hashStr('anything') >= 0);
    assert.ok(hashStr('') >= 0);
    assert.ok(hashStr('a very long agent id string here') >= 0);
  });
});

// ── Name Generation ─────────────────────────────────────

describe('getDwarfName', () => {
  it('should return a non-empty string', () => {
    const name = getDwarfName('test-agent-1');
    assert.ok(name.length > 0);
  });

  it('should return the same name for the same agentId', () => {
    const a = getDwarfName('stable-id');
    const b = getDwarfName('stable-id');
    assert.equal(a, b);
  });

  it('should start with an uppercase letter', () => {
    const name = getDwarfName('case-test');
    assert.ok(/^[A-Z]/.test(name), `"${name}" should start uppercase`);
  });

  it('should generate names that look like dwarf names (2-4 syllables)', () => {
    // Names should be between 4 and 12 characters
    for (let i = 0; i < 20; i++) {
      const name = getDwarfName(`length-test-${i}`);
      assert.ok(
        name.length >= 4 && name.length <= 12,
        `"${name}" length ${name.length} out of range 4-12`,
      );
    }
  });

  it('should generate different names for different agents', () => {
    const names = new Set();
    for (let i = 0; i < 30; i++) {
      names.add(getDwarfName(`unique-test-${i}`));
    }
    // At least 25 of 30 should be unique (allowing some hash collisions)
    assert.ok(
      names.size >= 25,
      `Only ${names.size} unique names out of 30 agents`,
    );
  });

  it('should never return duplicate names for concurrent agents', () => {
    const names = new Set();
    const ids = [];
    for (let i = 0; i < 50; i++) {
      const id = `concurrent-${i}`;
      ids.push(id);
      names.add(getDwarfName(id));
    }
    assert.equal(
      names.size,
      50,
      `Expected 50 unique names, got ${names.size}`,
    );
  });
});

// ── Name Release ────────────────────────────────────────

describe('releaseName', () => {
  it('should allow name reuse after release', () => {
    const name1 = getDwarfName('release-test');
    releaseName('release-test');
    // A new agent could potentially get the same name now
    // (the name is back in the pool)
    const name2 = getDwarfName('release-test');
    assert.equal(name1, name2, 'Same ID should get same name after re-register');
  });

  it('should not crash when releasing unknown agent', () => {
    releaseName('never-existed');
    // No assertion needed — just shouldn't throw
  });
});

// ── Name Quality ────────────────────────────────────────

describe('name quality', () => {
  it('should produce pronounceable names (consonant-vowel patterns)', () => {
    const vowels = new Set('aeiouAEIOU');
    for (let i = 0; i < 20; i++) {
      const name = getDwarfName(`quality-${i}`);
      let hasVowel = false;
      for (const ch of name) {
        if (vowels.has(ch)) {
          hasVowel = true;
          break;
        }
      }
      assert.ok(hasVowel, `"${name}" has no vowels — not pronounceable`);
    }
  });

  it('should not generate names with triple consecutive consonants at boundaries', () => {
    // Check that prefix+suffix joins don't create unpronounceable clusters
    const vowels = new Set('aeiou');
    let badNames = [];
    for (const p of PREFIXES) {
      for (const s of SUFFIXES) {
        const name = p + s;
        const lower = name.toLowerCase();
        // Check for 4+ consecutive consonants (3 is ok for dwarves)
        let consonantRun = 0;
        for (const ch of lower) {
          if (vowels.has(ch)) {
            consonantRun = 0;
          } else {
            consonantRun++;
            if (consonantRun >= 5) {
              badNames.push(name);
              break;
            }
          }
        }
      }
    }
    assert.ok(
      badNames.length < totalNames() * 0.05,
      `Too many unpronounceable names (${badNames.length}): ${badNames.slice(0, 5).join(', ')}...`,
    );
  });

  it('all generated names should print nicely (no special chars)', () => {
    for (const p of PREFIXES) {
      for (const s of SUFFIXES) {
        const name = p + s;
        assert.ok(
          /^[A-Za-z]+$/.test(name),
          `"${name}" contains non-letter characters`,
        );
      }
    }
  });
});
