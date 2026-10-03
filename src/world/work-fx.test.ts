import { describe, expect, it } from 'vitest';
import type { Particles } from './particles';
import { activityColor, emitWork, WORK_ICON } from './work-fx';
import { ACTIVITIES } from '../types';

function recorder() {
  const calls: Array<{ kind: string; count: number; tint?: number }> = [];
  const particles = { emit: (kind: string, _x: number, _y: number, count = 1, tint?: number) => { calls.push({ kind, count, tint }); } };
  return { calls, particles: particles as unknown as Particles };
}

describe('work effects', () => {
  it('should burst sparks when a coding strike lands', () => {
    const { calls, particles } = recorder();
    emitWork(particles, 'coding', 0, 0, 0.016, true);
    expect(calls.map(c => c.kind)).toEqual(['sparks', 'mote']);
    expect(calls[1].tint).toBe(activityColor('coding'));
  });

  it('should stay quiet between strikes for swinging activities', () => {
    const { calls, particles } = recorder();
    emitWork(particles, 'coding', 0, 0, 1, false);
    expect(calls).toEqual([]);
  });

  it('should stream activity-colored motes for desk work', () => {
    const { calls, particles } = recorder();
    for (let i = 0; i < 20; i++) emitWork(particles, 'researching', 0, 0, 1, false);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(c => c.kind === 'mote' && c.tint === activityColor('researching'))).toBe(true);
  });

  it('should have an icon and color for every activity', () => {
    for (const a of ACTIVITIES) {
      expect(WORK_ICON[a]).toBeTruthy();
      expect(Number.isNaN(activityColor(a))).toBe(false);
    }
  });
});
