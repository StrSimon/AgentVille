import { describe, it, expect } from 'vitest';
import { getClanColor } from './types';

describe('getClanColor', () => {
  it('should return a color string', () => {
    const color = getClanColor('my-project');
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('should be deterministic — same clan gets same color', () => {
    expect(getClanColor('agentville')).toBe(getClanColor('agentville'));
  });

  it('should return different colors for different clans', () => {
    const colors = new Set([
      getClanColor('project-a'),
      getClanColor('project-b'),
      getClanColor('project-c'),
      getClanColor('project-d'),
      getClanColor('project-e'),
    ]);
    // At least 3 of 5 should be different (some hash collisions are ok)
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it('should handle empty string', () => {
    const color = getClanColor('');
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('should handle long clan names', () => {
    const color = getClanColor('a-very-long-project-name-that-goes-on-and-on');
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
