import { ago, count, duration, money, planName, tokens, windowLabel } from './format';

describe('format', () => {
  it('should format money with magnitude-aware precision', () => {
    expect(money(0)).toBe('$0');
    expect(money(0.004)).toBe('$0.004');
    expect(money(0.42)).toBe('$0.42');
    expect(money(12.4)).toBe('$12.40');
    expect(money(240.6)).toBe('$241');
    expect(money(12345)).toBe('$12,345');
  });

  it('should abbreviate token counts', () => {
    expect(tokens(950)).toBe('950');
    expect(tokens(1500)).toBe('1.5k');
    expect(tokens(3_400_000)).toBe('3.4M');
    expect(tokens(2_100_000_000)).toBe('2.1B');
    expect(count(9999)).toBe('9,999');
  });

  it('should describe elapsed time', () => {
    const now = 1_000_000_000;
    expect(ago(now - 10_000, now)).toBe('just now');
    expect(ago(now - 4 * 60_000, now)).toBe('4m ago');
    expect(ago(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(duration(42_000)).toBe('42s');
    expect(duration(185_000)).toBe('3m 05s');
    expect(duration(2 * 3_600_000 + 14 * 60_000)).toBe('2h 14m');
  });

  it('should name limit windows and plans', () => {
    expect(windowLabel(300)).toBe('5-hour');
    expect(windowLabel(10080)).toBe('Weekly');
    expect(windowLabel(1440)).toBe('1-day');
    expect(planName('prolite')).toBe('Pro Lite');
    expect(planName('max')).toBe('Max');
  });
});
