// The village weather mirrors how close you are to your limits:
// fresh quota → sunshine, getting tight → clouds, rain, and a storm right before the end.
import type { Stats } from '../types';
import { windowLabel } from './format';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm';

export interface Mood {
  /** 0 = carefree … 1 = the end is near */
  level: number;
  weather: Weather;
  reason: string;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function weatherFor(level: number): Weather {
  return level < 0.25 ? 'clear' : level < 0.55 ? 'cloudy' : level < 0.85 ? 'rain' : 'storm';
}

export function computeMood(stats: Stats | null): Mood {
  if (!stats) return { level: 0, weather: 'clear', reason: 'No data yet' };

  // 1) Plan limits: the tightest window of any tool decides.
  let worst: { pct: number; label: string } | null = null;
  for (const [source, limits] of Object.entries(stats.limits || {})) {
    for (const w of limits?.windows || []) {
      if (!worst || w.usedPercent > worst.pct) {
        worst = { pct: w.usedPercent, label: `${source === 'claude' ? 'Claude' : 'Codex'} ${windowLabel(w.windowMinutes)}` };
      }
    }
  }
  if (worst) {
    // calm below 40 %, rain from ~71 %, storm from ~89 %
    const level = clamp((worst.pct - 40) / 57);
    return { level, weather: weatherFor(level), reason: `${worst.label} ${Math.round(worst.pct)}% used` };
  }

  // 2) No limits known: compare today's spend with a usual day.
  const total = (d: object) => Object.values(d).reduce((s, v) => s + (typeof v === 'object' && v ? (v as { cost?: number }).cost || 0 : 0), 0);
  const past = stats.days.slice(0, -1).map(total).filter(c => c > 0);
  const usual = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;
  const today = total(stats.today);
  if (!usual || !today) return { level: 0, weather: 'clear', reason: 'Quiet day' };
  const ratio = today / usual;
  const level = clamp((ratio - 1) / 2.5);
  return { level, weather: weatherFor(level), reason: `Today ${ratio.toFixed(1)}× your usual day` };
}
