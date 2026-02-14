import { describe, it, expect, beforeEach } from 'vitest';
import { getDwarfName, releaseDwarfName } from './dwarfNames';

describe('getDwarfName (client)', () => {
  it('should return a non-empty string', () => {
    expect(getDwarfName('client-test-1').length).toBeGreaterThan(0);
  });

  it('should be deterministic for the same agentId', () => {
    const a = getDwarfName('stable-client-id');
    const b = getDwarfName('stable-client-id');
    expect(a).toBe(b);
  });

  it('should start with an uppercase letter', () => {
    const name = getDwarfName('case-test-client');
    expect(name[0]).toMatch(/[A-Z]/);
  });

  it('should generate different names for different agents', () => {
    const names = new Set<string>();
    for (let i = 0; i < 20; i++) {
      names.add(getDwarfName(`client-unique-${i}`));
    }
    expect(names.size).toBeGreaterThanOrEqual(15);
  });

  it('should never produce duplicates for concurrent agents', () => {
    const names = new Set<string>();
    for (let i = 0; i < 40; i++) {
      names.add(getDwarfName(`client-concurrent-${i}`));
    }
    expect(names.size).toBe(40);
  });

  it('should produce names between 4 and 14 characters', () => {
    for (let i = 0; i < 20; i++) {
      const name = getDwarfName(`client-length-${i}`);
      expect(name.length).toBeGreaterThanOrEqual(4);
      expect(name.length).toBeLessThanOrEqual(14);
    }
  });
});

describe('releaseDwarfName', () => {
  it('should allow reuse after release', () => {
    const name1 = getDwarfName('client-release');
    releaseDwarfName('client-release');
    const name2 = getDwarfName('client-release');
    expect(name1).toBe(name2);
  });

  it('should not crash when releasing unknown agent', () => {
    releaseDwarfName('client-never-existed');
  });
});
