import { useMemo } from 'react';
import { Coins, Cpu, GitBranch, Hammer, Users, X } from 'lucide-react';
import { useVillage } from '../state/store';
import type { Activity, Agent } from '../types';
import { ago, count, money, tokens } from '../lib/format';
import { ACTIVITY_META } from './activity-meta';
import { useApp } from './app-context';
import { OrderBox } from './OrderBox';
import { Meter, SourceBadge, SOURCE_HEX } from './widgets';
import { portraitUrl } from '../lib/variant';

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-line">
      <span className="eyebrow flex items-center gap-1.5">{icon}{label}</span>
      <span className="mt-0.5 block font-display text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ActivityMix({ counts }: { counts: Agent['activityCounts'] }) {
  const entries = (Object.entries(counts) as Array<[Activity, number]>).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!total) return null;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full" role="img" aria-label="Activity mix">
        {entries.map(([a, n]) => <span key={a} style={{ width: `${(n / total) * 100}%`, background: ACTIVITY_META[a].color }} />)}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {entries.slice(0, 6).map(([a, n]) => (
          <li key={a} className="flex items-center gap-1.5 text-[11px] text-parchment/80">
            <span className="size-2 rounded-sm" style={{ background: ACTIVITY_META[a].color }} />
            {ACTIVITY_META[a].label}
            <span className="ml-auto tabular-nums text-muted">{Math.round((n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgentPanel() {
  const { selectedId, select, focus } = useApp();
  const agents = useVillage(s => s.agents);
  const agent = selectedId ? agents[selectedId] : null;
  const children = useMemo(() => Object.values(agents).filter(a => a.parentId === selectedId), [agents, selectedId]);
  if (!agent) return null;

  const meta = ACTIVITY_META[agent.activity];
  const parent = agent.parentId ? agents[agent.parentId] : null;
  const span = (agent.nextLevelXP ?? agent.xp) - agent.levelXP;
  const progress = agent.nextLevelXP ? ((agent.xp - agent.levelXP) / Math.max(1, span)) * 100 : 100;

  return (
    <aside className="panel animate-rise absolute top-[84px] right-3 bottom-24 z-10 flex w-[350px] flex-col overflow-hidden rounded-2xl" aria-label={`${agent.name} details`}>
      <div className="relative h-36 w-full shrink-0 overflow-hidden">
        <img src={portraitUrl(agent)} alt="" className={`h-full w-full object-cover object-[50%_25%] ${agent.online ? '' : 'grayscale-[60%] opacity-70'}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--color-panel)]" />
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${SOURCE_HEX[agent.source]}, transparent)` }} />
      </div>
      <div className="scroll-thin -mt-10 flex-1 overflow-y-auto p-4 pt-0">
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-display text-[24px] leading-tight font-semibold">{agent.name}</h2>
              <SourceBadge source={agent.source} />
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              Level {agent.level} · <span className="text-ember-soft">{agent.title}</span>
              {agent.kind === 'sub' && <> · {agent.agentType || 'sub-agent'}</>}
            </p>
          </div>
          <button type="button" onClick={() => select(null)} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-muted ring-1 ring-line hover:text-parchment">
            <X size={15} />
          </button>
        </header>

        <div className="mt-3 rounded-xl px-3 py-2.5 ring-1" style={{ background: `${meta.color}14`, boxShadow: `inset 0 0 0 1px ${meta.color}33` }}>
          <span className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: meta.color }}>
            <span className={`size-2 rounded-full ${agent.online ? 'animate-pulse' : ''}`} style={{ background: agent.online ? meta.color : '#64748b' }} />
            {agent.online ? (agent.attention ? 'Waiting for you' : meta.label) : `Resting · seen ${ago(agent.lastSeen)}`}
            {agent.online && <span className="ml-auto text-[11px] font-normal text-muted">{meta.place}</span>}
          </span>
          {agent.online && agent.detail && <p className="mt-1 truncate font-mono text-[11px] text-parchment/75">{agent.detail}</p>}
          <p className="mt-1 text-[11px] text-muted">{agent.project || 'no project'}{agent.modelLabel ? ` · ${agent.modelLabel}` : ''}</p>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>{agent.xp.toLocaleString('en-US')} XP</span>
            <span>{agent.nextLevelXP ? `${agent.nextLevelXP.toLocaleString('en-US')} → ${agent.nextTitle}` : 'max level'}</span>
          </div>
          <Meter value={progress} color="#f59e0b" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat icon={<Coins size={11} />} label="API value" value={money(agent.cost)} />
          <Stat icon={<Cpu size={11} />} label="Tokens" value={tokens(agent.tokens)} />
          <Stat icon={<Hammer size={11} />} label="Tool calls" value={count(agent.toolCalls)} />
          <Stat icon={<Users size={11} />} label={agent.kind === 'sub' ? 'Sessions' : 'Sub-agents'} value={count(agent.kind === 'sub' ? agent.sessions : agent.subAgentsSpawned)} />
        </div>

        {agent.models.length > 0 && (
          <section className="mt-4">
            <h3 className="eyebrow mb-1.5">Models</h3>
            <ul className="space-y-1">
              {agent.models.slice(0, 4).map(m => (
                <li key={m.model} className="flex items-center justify-between text-[12px]">
                  <span>{m.label}</span>
                  <span className="tabular-nums text-muted">{tokens(m.tokens)} · <span className="text-parchment">{money(m.cost)}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4">
          <h3 className="eyebrow mb-1.5">Where the time goes</h3>
          <ActivityMix counts={agent.activityCounts} />
        </section>

        {(parent || children.length > 0) && (
          <section className="mt-4">
            <h3 className="eyebrow mb-1.5 flex items-center gap-1"><GitBranch size={11} /> Crew</h3>
            <div className="flex flex-wrap gap-1.5">
              {[...(parent ? [parent] : []), ...children].map(a => (
                <button key={a.id} type="button" onClick={() => { select(a.id); focus(a.id); }}
                  className="rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] ring-1 ring-line hover:ring-white/20">
                  {a === parent ? '↑ ' : ''}{a.name}{a.agentType ? ` · ${a.agentType}` : ''}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-4">
          <h3 className="eyebrow mb-1.5">Recent work</h3>
          <ol className="space-y-1">
            {[...agent.recentActivity].reverse().slice(0, 10).map((r, i) => (
              <li key={`${r.timestamp}-${i}`} className="flex items-center gap-2 text-[11.5px]">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: ACTIVITY_META[r.activity]?.color }} />
                <span className="truncate text-parchment/80">{ACTIVITY_META[r.activity]?.label}{r.detail ? ` · ${r.detail}` : ''}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted">{ago(r.timestamp)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {agent.online && (
        <footer className="border-t border-line bg-black/20 p-3">
          <h3 className="eyebrow mb-1.5">Orders</h3>
          <OrderBox agent={agent} />
        </footer>
      )}
    </aside>
  );
}
