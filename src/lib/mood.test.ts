import type { Stats } from '../types';
import { computeMood } from './mood';

function stats(over: Partial<Stats> = {}): Stats {
  return {
    bySource: {}, days: [], projects: [], models: [], today: {},
    burn: { hours: [], last24: { cost: 0, tokens: 0, bySource: {} }, perHour: 0, projected24h: 0 },
    limits: {}, ...over,
  } as Stats;
}

const win = (usedPercent: number, windowMinutes = 300) => ({ usedPercent, windowMinutes, resetsAt: null });

describe('computeMood', () => {
  it('should be clear and sunny with a fresh quota', () => {
    const m = computeMood(stats({ limits: { claude: { plan: 'max', windows: [win(12)], credits: null, reached: null } } }));
    expect(m.weather).toBe('clear');
    expect(m.level).toBe(0);
  });

  it('should follow the most constrained limit across tools and windows', () => {
    const m = computeMood(stats({
      limits: {
        claude: { plan: 'max', windows: [win(30), win(88, 10080)], credits: null, reached: null },
        codex: { plan: 'pro', windows: [win(50)], credits: null, reached: null },
      },
    }));
    expect(m.weather).toBe('rain');
    expect(m.reason).toMatch(/Claude Weekly 88%/);
  });

  it('should storm right before a limit is reached', () => {
    expect(computeMood(stats({ limits: { codex: { plan: 'pro', windows: [win(97)], credits: null, reached: null } } })).weather).toBe('storm');
  });

  it('should fall back to today’s spend versus the usual day when no limits are known', () => {
    const days = Array.from({ length: 10 }, (_, i) => ({ day: `d${i}`, claude: { cost: 10, tokens: 0, toolCalls: 0 } }));
    const calm = computeMood(stats({ days, today: { claude: { cost: 8, tokens: 0, toolCalls: 0 } } }));
    expect(calm.weather).toBe('clear');
    const heavy = computeMood(stats({ days, today: { claude: { cost: 32, tokens: 0, toolCalls: 0 } } }));
    expect(['rain', 'storm']).toContain(heavy.weather);
    expect(heavy.reason).toMatch(/3\.2× your usual day/);
  });

  it('should stay clear without any data', () => {
    expect(computeMood(null).weather).toBe('clear');
  });
});
