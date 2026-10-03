import { useMemo } from 'react';
import { AlertTriangle, Flame, Timer, X } from 'lucide-react';
import { useVillage } from '../state/store';
import type { PlanLimits, Stats } from '../types';
import { ago, duration, money, planName, sourceName, tokens, windowLabel } from '../lib/format';
import { useApp } from './app-context';
import { Legend, StackedColumns, type Column } from './charts';
import { Meter, SOURCE_HEX } from './widgets';
import { useNow } from './use-now';

const SOURCES = ['claude', 'codex', 'custom'] as const;

function LimitCard({ source, limits, now }: { source: 'claude' | 'codex'; limits?: PlanLimits; now: number }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-sm" style={{ background: SOURCE_HEX[source] }} />
        <h3 className="font-display text-[16px] font-semibold">{sourceName(source)}</h3>
        {limits?.plan && <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold text-parchment/80">{planName(limits.plan)}</span>}
        {limits?.updatedAt && <span className="ml-auto text-[10px] text-muted">as of {ago(limits.updatedAt, now)}</span>}
      </div>
      {!limits || (!limits.windows.length && !limits.spend) ? (
        <p className="mt-3 text-[12px] text-muted">
          {source === 'claude'
            ? 'Limits appear once a Claude Code session refreshes its status line (Pro/Max plans).'
            : 'Limits appear after the next Codex turn.'}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {limits.windows.map(w => {
            const level = w.usedPercent >= 90 ? 'Critical' : w.usedPercent >= 70 ? 'High' : 'OK';
            return (
              <div key={w.windowMinutes ?? 0}>
                <div className="mb-1 flex items-baseline justify-between text-[12px]">
                  <span className="font-medium">{windowLabel(w.windowMinutes)} window</span>
                  <span className="tabular-nums">
                    <span className="font-display text-[17px] font-semibold">{Math.round(w.usedPercent)}%</span>
                    <span className="text-muted"> used · {100 - Math.round(w.usedPercent)}% left</span>
                  </span>
                </div>
                <Meter value={w.usedPercent} />
                <div className="mt-1 flex justify-between text-[10.5px] text-muted">
                  <span className="flex items-center gap-1">{level !== 'OK' && <AlertTriangle size={11} className={level === 'Critical' ? 'text-alert' : 'text-ember'} />}{level}</span>
                  {w.resetsAt && <span className="flex items-center gap-1"><Timer size={11} /> resets in {duration(w.resetsAt - now)}</span>}
                </div>
              </div>
            );
          })}
          {limits.spend && (
            <div className="text-[12px]">
              Spend limit: <span className="font-semibold">{Math.round(limits.spend.usedPercent)}%</span>
              {limits.spend.limitUsd != null && <span className="text-muted"> · {money(limits.spend.usedUsd || 0)} of {money(limits.spend.limitUsd)} {limits.spend.period}</span>}
            </div>
          )}
          {limits.credits && !limits.credits.unlimited && limits.credits.balance != null && (
            <div className="text-[12px] text-muted">Credits balance: <span className="font-semibold text-parchment">{limits.credits.balance.toLocaleString('en-US')}</span></div>
          )}
        </div>
      )}
    </div>
  );
}

function SourceSplit({ stats }: { stats: Stats }) {
  const entries = (['claude', 'codex', 'custom'] as const).filter(s => stats.bySource[s] && (stats.bySource[s].cost || stats.bySource[s].toolCalls));
  const total = entries.reduce((s, k) => s + stats.bySource[k].cost, 0);
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
      <h3 className="eyebrow">All-time · who does the work</h3>
      <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Cost share by tool">
        {entries.map(s => <span key={s} style={{ width: `${(stats.bySource[s].cost / Math.max(total, 1e-9)) * 100}%`, background: SOURCE_HEX[s] }} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {entries.map(s => {
          const v = stats.bySource[s];
          return (
            <div key={s}>
              <span className="flex items-center gap-1.5 text-[11px] text-parchment/80"><span className="size-2 rounded-sm" style={{ background: SOURCE_HEX[s] }} />{sourceName(s)}</span>
              <span className="block font-display text-2xl font-semibold tabular-nums">{money(v.cost)}</span>
              <span className="text-[11px] text-muted">{tokens(v.tokens)} tokens · {v.toolCalls.toLocaleString('en-US')} tools · {v.dwarves} dwarves</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: Array<{ key: string; label: string; source?: string; cost: number; tokens: number }> }) {
  const max = Math.max(1e-9, ...rows.map(r => r.cost));
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
      <h3 className="eyebrow mb-2">{title}</h3>
      <table className="w-full text-[12px]">
        <thead className="sr-only"><tr><th>Name</th><th>Tokens</th><th>Cost</th></tr></thead>
        <tbody>
          {rows.slice(0, 7).map(r => (
            <tr key={r.key} className="border-t border-line first:border-0">
              <td className="py-1.5">
                <span className="flex items-center gap-1.5">
                  {r.source && <span className="size-2 rounded-sm" style={{ background: SOURCE_HEX[r.source] }} />}
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="mt-1 block h-1 rounded-full bg-white/8"><span className="block h-full rounded-full bg-ember/60" style={{ width: `${(r.cost / max) * 100}%` }} /></span>
              </td>
              <td className="py-1.5 text-right text-muted tabular-nums">{tokens(r.tokens)}</td>
              <td className="py-1.5 pl-3 text-right font-semibold tabular-nums">{money(r.cost)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td className="py-2 text-muted">Nothing yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function ControlCenter() {
  const { setOverlay } = useApp();
  const stats = useVillage(s => s.stats);
  const now = useNow(15_000);

  const hourly: Column[] = useMemo(() => (stats?.burn.hours || []).map(h => {
    const d = new Date(h.hour);
    return { key: String(h.hour), label: `${d.getHours()}:00 – ${d.getHours() + 1}:00`, tick: `${d.getHours()}h`, values: h.bySource };
  }), [stats]);
  const daily: Column[] = useMemo(() => (stats?.days || []).map(d => ({
    key: d.day,
    label: new Date(`${d.day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    tick: new Date(`${d.day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    values: { claude: d.claude?.cost || 0, codex: d.codex?.cost || 0, custom: d.custom?.cost || 0 },
  })), [stats]);
  if (!stats) return null;

  const burn = stats.burn;
  const projectRows = stats.projects.map(p => {
    const vals = (['claude', 'codex', 'custom'] as const).map(s => p[s]).filter(Boolean);
    const main = ([...SOURCES]).sort((a, b) => (p[b]?.cost || 0) - (p[a]?.cost || 0))[0];
    return { key: p.name, label: p.name, source: main, cost: vals.reduce((s, v) => s + (v?.cost || 0), 0), tokens: vals.reduce((s, v) => s + (v?.tokens || 0), 0) };
  });

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-night/55 p-4 backdrop-blur-[2px]" onClick={() => setOverlay('none')}>
      <section
        className="panel animate-rise scroll-thin relative max-h-[calc(100vh-2rem)] w-full max-w-[1120px] overflow-y-auto rounded-3xl p-6"
        role="dialog" aria-modal="true" aria-labelledby="cc-title" onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Mission control</p>
            <h2 id="cc-title" className="font-display text-3xl font-semibold tracking-tight">Spend, burn & limits</h2>
            <p className="mt-1 text-[12px] text-muted">Costs are API list prices (“API value”). On subscriptions you pay a flat fee — the limits below are what actually caps you.</p>
          </div>
          <button type="button" onClick={() => setOverlay('none')} aria-label="Close" className="grid size-9 place-items-center rounded-xl text-muted ring-1 ring-line hover:text-parchment"><X size={16} /></button>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="eyebrow flex items-center gap-1.5"><Flame size={12} className="text-ember" /> Burn · last 24h</p>
                <p className="font-display text-[40px] leading-none font-semibold tabular-nums">{money(burn.last24.cost)}</p>
                <p className="mt-1 text-[11px] text-muted">{tokens(burn.last24.tokens)} tokens</p>
              </div>
              <div>
                <p className="eyebrow">Pace now</p>
                <p className="font-display text-2xl font-semibold tabular-nums">{money(burn.perHour)}<span className="text-sm text-muted">/h</span></p>
              </div>
              <div>
                <p className="eyebrow">At this pace</p>
                <p className="font-display text-2xl font-semibold tabular-nums">{money(burn.projected24h)}<span className="text-sm text-muted">/day</span></p>
              </div>
              <div className="ml-auto"><Legend sources={['claude', 'codex']} /></div>
            </div>
            <div className="mt-3"><StackedColumns columns={hourly} caption="Cost per hour over the last 24 hours" tickEvery={4} height={230} /></div>
          </div>
          <div className="grid gap-4">
            <LimitCard source="claude" limits={stats.limits.claude} now={now} />
            <LimitCard source="codex" limits={stats.limits.codex} now={now} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.35fr]">
          <SourceSplit stats={stats} />
          <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <h3 className="eyebrow">Last 30 days</h3>
              <Legend sources={['claude', 'codex']} />
            </div>
            <div className="mt-2"><StackedColumns columns={daily} caption="Cost per day over the last 30 days" tickEvery={7} highlightLast /></div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Table title="Models" rows={stats.models.map(m => ({ key: m.model, label: m.label, source: m.source, cost: m.cost, tokens: m.tokens }))} />
          <Table title="Projects" rows={projectRows} />
        </div>
      </section>
    </div>
  );
}
