/** $1,234 · $12.40 · $0.031 — precision adapts to magnitude. */
export function money(v: number): string {
  if (!Number.isFinite(v)) return '$0';
  if (v >= 1000) return `$${Math.round(v).toLocaleString('en-US')}`;
  if (v >= 100) return `$${v.toFixed(0)}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v === 0) return '$0';
  return `$${v.toFixed(v < 0.01 ? 3 : 2)}`;
}

/** 1.2k · 3.4M · 1.1B tokens */
export function tokens(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(Math.round(v));
}

export function count(v: number): string {
  return v >= 10_000 ? tokens(v) : v.toLocaleString('en-US');
}

/** "just now", "4m ago", "3h ago", "2d ago" */
export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Countdown/elapsed: 42s · 3m 05s · 2h 14m · 3d 4h */
export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

/** Label for a limit window: 300 → "5-hour", 10080 → "Weekly". */
export function windowLabel(minutes: number | null): string {
  if (!minutes) return 'Limit';
  if (minutes === 10080) return 'Weekly';
  if (minutes % 1440 === 0) return `${minutes / 1440}-day`;
  if (minutes % 60 === 0) return `${minutes / 60}-hour`;
  return `${minutes}-min`;
}

export function sourceName(source: string): string {
  return source === 'claude' ? 'Claude Code' : source === 'codex' ? 'Codex' : 'Custom';
}

export function planName(plan: string | null | undefined): string {
  if (!plan) return '';
  const names: Record<string, string> = { prolite: 'Pro Lite', pro: 'Pro', plus: 'Plus', max: 'Max', team: 'Team', enterprise: 'Enterprise', free: 'Free' };
  return names[plan] || plan.charAt(0).toUpperCase() + plan.slice(1);
}
