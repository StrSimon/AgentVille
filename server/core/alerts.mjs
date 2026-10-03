// ── Warnings: limits getting tight, unusual burn rate ────
// Each warning fires once per limit window (or once per 2 h for burn spikes).

import { burnDTO } from './profiles.mjs';

const THRESHOLDS = [80, 95];
const BURN_COOLDOWN = 2 * 3_600_000;
const KEEP = 8 * 86_400_000;

function windowName(minutes) {
  if (minutes === 10080) return 'weekly';
  if (minutes && minutes % 60 === 0) return `${minutes / 60}-hour`;
  return minutes ? `${minutes}-min` : '';
}

function untilText(ms) {
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000), m = Math.round((ms % 3_600_000) / 60_000);
  return h >= 24 ? ` — resets in ${Math.round(h / 24)}d` : ` — resets in ${h ? `${h}h ` : ''}${m}m`;
}

/**
 * @param {{ data: any, now: () => number, fx: (kind: string, payload: object) => void }} ctx
 */
export function createAlerts(ctx) {
  const state = () => (ctx.data.alerts ||= {});

  function prune() {
    const s = state();
    for (const [k, at] of Object.entries(s)) if (ctx.now() - at > KEEP) delete s[k];
  }

  /** Call whenever plan limits for a tool arrive. */
  function onLimits(source, limits) {
    const s = state();
    const tool = source === 'claude' ? 'Claude' : source === 'codex' ? 'Codex' : source;
    for (const w of limits?.windows || []) {
      for (const th of THRESHOLDS) {
        const key = `${source}:${w.windowMinutes}:${th}:${w.resetsAt ?? ''}`;
        if (w.usedPercent < th || s[key]) continue;
        // only the highest crossed threshold speaks
        if (th === 80 && w.usedPercent >= 95) { s[key] = ctx.now(); continue; }
        s[key] = ctx.now();
        const reset = w.resetsAt ? untilText(w.resetsAt - ctx.now()) : '';
        ctx.fx('warning', {
          severity: th >= 95 ? 'critical' : 'high',
          text: `${tool} ${windowName(w.windowMinutes)} limit at ${Math.round(w.usedPercent)}%${reset}`,
        });
      }
    }
    prune();
  }

  /** Periodic check: is the current hourly pace far above the last 24 h average? */
  function checkBurn() {
    const s = state();
    if (s.burn && ctx.now() - s.burn < BURN_COOLDOWN) return;
    const burn = burnDTO(ctx.data, ctx.now());
    const avg = burn.last24.cost / 24;
    if (burn.perHour < Math.max(3, avg * 3)) return;
    s.burn = ctx.now();
    const factor = avg > 0 ? ` — ${(burn.perHour / avg).toFixed(1)}× your 24 h average` : '';
    ctx.fx('warning', { severity: 'high', text: `Burning $${burn.perHour.toFixed(2)}/h right now${factor}` });
  }

  return { onLimits, checkBurn };
}
