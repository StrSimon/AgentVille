import type { ReactNode } from 'react';
import type { BurnHour, Source } from '../types';

export const SOURCE_HEX: Record<string, string> = { claude: '#d4693f', codex: '#1fae7c', custom: '#5b8def' };

export function SourceBadge({ source, compact = false }: { source: Source | string; compact?: boolean }) {
  const label = source === 'claude' ? 'Claude' : source === 'codex' ? 'Codex' : 'Custom';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wide"
      style={{ color: SOURCE_HEX[source], background: `${SOURCE_HEX[source]}1f`, boxShadow: `inset 0 0 0 1px ${SOURCE_HEX[source]}40` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: SOURCE_HEX[source] }} />
      {!compact && label}
    </span>
  );
}

/** 24 stacked bars (Claude below, Codex on top). */
export function BurnSparkline({ hours, height = 22, width = 96 }: { hours: BurnHour[]; height?: number; width?: number }) {
  const max = Math.max(0.0001, ...hours.map(h => h.cost));
  const bw = width / Math.max(1, hours.length);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {hours.map((h, i) => {
        const c = ((h.bySource.claude || 0) / max) * height;
        const x = ((h.bySource.codex || 0) / max) * height;
        const o = (((h.cost - (h.bySource.claude || 0) - (h.bySource.codex || 0)) / max) * height);
        return (
          <g key={h.hour}>
            <rect x={i * bw + 0.5} y={height - c} width={bw - 1} height={c} fill={SOURCE_HEX.claude} rx={1} />
            <rect x={i * bw + 0.5} y={height - c - x} width={bw - 1} height={x} fill={SOURCE_HEX.codex} rx={1} />
            {o > 0 && <rect x={i * bw + 0.5} y={height - c - x - o} width={bw - 1} height={o} fill={SOURCE_HEX.custom} rx={1} />}
          </g>
        );
      })}
    </svg>
  );
}

/** Circular percentage gauge; turns amber then red as it fills. */
export function Ring({ value, size = 34, stroke = 4, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 90 ? '#fb4f6b' : v >= 70 ? '#f59e0b' : '#4ade80';
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.1)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <span className="absolute text-[9px] font-semibold tabular-nums">{children ?? `${Math.round(v)}`}</span>
    </span>
  );
}

export function Meter({ value, color }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const c = color || (v >= 90 ? '#fb4f6b' : v >= 70 ? '#f59e0b' : '#4ade80');
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8" role="meter" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: c }} />
    </div>
  );
}

export function IconButton({ label, onClick, active = false, children, badge }: {
  label: string; onClick: () => void; active?: boolean; children: ReactNode; badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`relative grid size-9 place-items-center rounded-xl border transition-colors ${active
        ? 'border-ember/50 bg-ember/15 text-ember-soft'
        : 'border-line bg-white/[0.03] text-parchment/70 hover:border-white/15 hover:text-parchment'}`}
    >
      {children}
      {!!badge && (
        <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-alert px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
