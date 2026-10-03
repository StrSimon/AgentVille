import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dwarfName, totalNames, PREFIXES, SUFFIXES, hashStr } from './names.mjs';

describe('dwarf names', () => {
  it('should offer at least 500 combinations', () => {
    assert.ok(totalNames() >= 500);
    assert.equal(totalNames(), PREFIXES.length * SUFFIXES.length);
  });

  it('should be deterministic for the same id', () => {
    assert.equal(dwarfName('claude-abc'), dwarfName('claude-abc'));
  });

  it('should skip names that are already taken', () => {
    const first = dwarfName('x');
    const second = dwarfName('x', new Set([first]));
    assert.notEqual(first, second);
  });

  it('should still return a name when every combination is taken', () => {
    const taken = new Set();
    for (const p of PREFIXES) for (const s of SUFFIXES) taken.add(p + s);
    const name = dwarfName('overflow', taken);
    assert.ok(!taken.has(name));
    assert.ok(name.length > 3);
  });

  it('should hash to unsigned 32-bit integers', () => {
    const h = hashStr('hello');
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
  });

  it('should not produce Tolkien dwarf names', () => {
    const tolkien = ['Thorin', 'Balin', 'Dwalin', 'Gimli', 'Durin', 'Gloin', 'Oin', 'Fili', 'Kili'];
    for (const p of PREFIXES) for (const s of SUFFIXES) assert.ok(!tolkien.includes(p + s), p + s);
  });
});
