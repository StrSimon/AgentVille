import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useVillage } from '../state/store';
import type { Agent } from '../types';
import { ago, count, money } from '../lib/format';
import { ACTIVITY_META } from './activity-meta';
import { useApp } from './app-context';
import { SourceBadge } from './widgets';

type Sort = 'xp' | 'cost' | 'recent';

export function Residents() {
  const { setOverlay, select, focus } = useApp();
  const agents = useVillage(s => s.agents);
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'all' | 'claude' | 'codex'>('all');
  const [sort, setSort] = useState<Sort>('xp');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = Object.values(agents).filter(a =>
      (source === 'all' || a.source === source) &&
      (!term || `${a.name} ${a.project} ${a.agentType}`.toLowerCase().includes(term)));
    const key: Record<Sort, (a: Agent) => number> = { xp: a => a.xp, cost: a => a.cost, recent: a => a.lastSeen };
    return rows.sort((a, b) => Number(b.online) - Number(a.online) || key[sort](b) - key[sort](a));
  }, [agents, q, source, sort]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-night/55 p-4 backdrop-blur-[2px]" onClick={() => setOverlay('none')}>
      <section className="panel animate-rise flex max-h-[calc(100vh-2rem)] w-full max-w-[860px] flex-col rounded-3xl p-6"
        role="dialog" aria-modal="true" aria-labelledby="res-title" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Village register</p>
            <h2 id="res-title" className="font-display text-3xl font-semibold tracking-tight">Residents</h2>
          </div>
          <button type="button" onClick={() => setOverlay('none')} aria-label="Close" className="grid size-9 place-items-center rounded-xl text-muted ring-1 ring-line hover:text-parchment"><X size={16} /></button>
        </header>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl bg-black/30 px-3 py-2 ring-1 ring-line focus-within:ring-ember/60">
            <Search size={14} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, project, role…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted/70" aria-label="Search residents" />
          </label>
          {(['all', 'claude', 'codex'] as const).map(s => (
            <button key={s} type="button" onClick={() => setSource(s)} aria-pressed={source === s}
              className={`rounded-xl px-3 py-2 text-[12px] font-semibold capitalize ring-1 ${source === s ? 'bg-white/10 ring-white/20' : 'text-muted ring-line hover:text-parchment'}`}>{s}</button>
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort residents"
            className="rounded-xl bg-black/30 px-3 py-2 text-[12px] ring-1 ring-line outline-none">
            <option value="xp">Most experienced</option>
            <option value="cost">Highest cost</option>
            <option value="recent">Recently seen</option>
          </select>
        </div>
        <ul className="scroll-thin mt-4 -mr-2 flex-1 space-y-1.5 overflow-y-auto pr-2">
          {list.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => { select(a.id); focus(a.id); setOverlay('none'); }}
                className="flex w-full items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2.5 text-left ring-1 ring-line transition hover:bg-white/[0.05]">
                <span className={`size-2 shrink-0 rounded-full ${a.online ? 'bg-ok' : 'bg-white/20'}`} aria-label={a.online ? 'online' : 'offline'} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-[15px] font-semibold">{a.name}</span>
                    <SourceBadge source={a.source} />
                    {a.kind === 'sub' && <span className="text-[10px] text-muted">{a.agentType || 'sub-agent'}</span>}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    Lv {a.level} {a.title} · {a.project || '—'} · {a.online ? ACTIVITY_META[a.activity].label : `seen ${ago(a.lastSeen)}`}
                  </span>
                </span>
                <span className="text-right text-[11px] tabular-nums text-muted">
                  <span className="block font-semibold text-parchment">{money(a.cost)}</span>
                  {count(a.toolCalls)} tools
                </span>
              </button>
            </li>
          ))}
          {!list.length && <li className="py-8 text-center text-[13px] text-muted">No residents match.</li>}
        </ul>
      </section>
    </div>
  );
}
