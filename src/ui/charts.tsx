import { useState } from 'react';
import { money } from '../lib/format';
import { SOURCE_HEX } from './widgets';

export interface Column {
  key: string;
  label: string;
  /** short axis label (shown only every n-th column) */
  tick?: string;
  values: Partial<Record<'claude' | 'codex' | 'custom', number>>;
}

const ORDER = ['claude', 'codex', 'custom'] as const;
const NAMES = { claude: 'Claude Code', codex: 'Codex', custom: 'Custom' };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= m * exp) return m * exp;
  return 10 * exp;
}

export function Legend({ sources }: { sources: readonly string[] }) {
  return (
    <ul className="flex gap-3 text-[11px] text-parchment/80">
      {sources.map(s => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SOURCE_HEX[s] }} />
          {NAMES[s as keyof typeof NAMES] || s}
        </li>
      ))}
    </ul>
  );
}

/** Stacked cost columns by source (Claude at the base, then Codex, then custom). */
export function StackedColumns({ columns, height = 150, caption, tickEvery = 6, highlightLast = false }: {
  columns: Column[]; height?: number; caption: string; tickEvery?: number; highlightLast?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = columns.map(c => ORDER.reduce((s, k) => s + (c.values[k] || 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const W = 640, padL = 44, padB = 20, plotH = height - padB, plotW = W - padL - 4;
  const slot = plotW / Math.max(1, columns.length);
  const bw = Math.min(24, slot - 2);
  const y = (v: number) => plotH - (v / max) * (plotH - 6);
  const present = ORDER.filter(k => columns.some(c => (c.values[k] || 0) > 0));

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={padL} x2={W - 4} y1={y(max * f)} y2={y(max * f)} stroke="rgb(255 255 255 / 0.07)" strokeWidth={1} />
            <text x={padL - 8} y={y(max * f) + 3} textAnchor="end" fontSize={10} fill="#8d95a8">{money(max * f)}</text>
          </g>
        ))}
        {columns.map((c, i) => {
          const x = padL + i * slot + (slot - bw) / 2;
          let base = 0;
          const segs = ORDER.filter(k => (c.values[k] || 0) > 0);
          return (
            <g key={c.key} onMouseEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.55}>
              <rect x={padL + i * slot} y={0} width={slot} height={plotH} fill="transparent" />
              {segs.map((k, si) => {
                const v = c.values[k] || 0;
                const top = y(base + v), bottom = y(base);
                base += v;
                const gap = si > 0 ? 2 : 0;
                const h = Math.max(0, bottom - top - gap);
                const last = si === segs.length - 1;
                const r = last ? Math.min(4, h, bw / 2) : 0;
                return (
                  <path
                    key={k}
                    fill={SOURCE_HEX[k]}
                    d={`M${x},${top + r + 0} v${h - r} h${bw} v${-(h - r)} ${r ? `a${r},${r} 0 0 0 ${-r},${-r} h${-(bw - 2 * r)} a${r},${r} 0 0 0 ${-r},${r}` : `h${-bw}`} z`}
                    transform={`translate(0 ${0})`}
                  />
                );
              })}
              {highlightLast && i === columns.length - 1 && totals[i] > 0 && (
                <text x={x + bw / 2} y={y(totals[i]) - 6} textAnchor="middle" fontSize={10} fill="#ece6d6">{money(totals[i])}</text>
              )}
              {c.tick && i % tickEvery === 0 && (
                <text x={x + bw / 2} y={height - 5} textAnchor="middle" fontSize={10} fill="#8d95a8">{c.tick}</text>
              )}
            </g>
          );
        })}
        <line x1={padL} x2={W - 4} y1={plotH} y2={plotH} stroke="rgb(255 255 255 / 0.14)" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div
          className="panel pointer-events-none absolute top-0 z-10 min-w-36 rounded-xl px-3 py-2 text-[11px]"
          style={{ left: `clamp(0px, calc(${((padL + hover * slot) / W) * 100}% - 70px), calc(100% - 150px))` }}
        >
          <div className="mb-1 font-semibold">{columns[hover].label}</div>
          {present.map(k => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-parchment/80"><span className="size-2 rounded-sm" style={{ background: SOURCE_HEX[k] }} />{NAMES[k]}</span>
              <span className="tabular-nums">{money(columns[hover].values[k] || 0)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold"><span>Total</span><span className="tabular-nums">{money(totals[hover])}</span></div>
        </div>
      )}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead><tr><th>Period</th>{present.map(k => <th key={k}>{NAMES[k]}</th>)}<th>Total</th></tr></thead>
        <tbody>
          {columns.map((c, i) => (
            <tr key={c.key}><td>{c.label}</td>{present.map(k => <td key={k}>{money(c.values[k] || 0)}</td>)}<td>{money(totals[i])}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
