import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useVillage } from '../state/store';
import { BUILDING_BY_ID, ACTIVITY_HOME, type BuildingId } from '../world/layout';
import { count } from '../lib/format';
import { useApp } from './app-context';
import { Meter } from './widgets';

export function BuildingCard({ id, onClose }: { id: BuildingId; onClose: () => void }) {
  const { select, focus } = useApp();
  const stats = useVillage(s => s.buildings[id]);
  const agents = useVillage(s => s.agents);
  const def = BUILDING_BY_ID[id];
  const inside = useMemo(() => Object.values(agents).filter(a => {
    if (id === 'tavern') return !a.online;
    if (!a.online) return false;
    if (id === 'townhall') return !!a.attention;
    return !a.attention && ACTIVITY_HOME[a.activity] === id;
  }), [agents, id]);
  const span = stats?.nextLevelXP ? stats.nextLevelXP - stats.levelXP : 1;
  const progress = stats?.nextLevelXP ? ((stats.xp - stats.levelXP) / span) * 100 : 100;
  const glow = `#${def.glow.toString(16).padStart(6, '0')}`;

  return (
    <section className="panel animate-rise absolute top-[84px] left-1/2 z-20 w-[320px] -translate-x-1/2 rounded-2xl p-4" aria-label={def.name}>
      <header className="flex items-start gap-2">
        <span className="mt-1 size-2.5 rounded-full" style={{ background: glow, boxShadow: `0 0 12px ${glow}` }} />
        <div className="flex-1">
          <h2 className="font-display text-[19px] font-semibold">{def.name}</h2>
          <p className="text-[12px] text-muted">{def.blurb}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-lg text-muted ring-1 ring-line hover:text-parchment"><X size={14} /></button>
      </header>
      {stats && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>Level {stats.level} · <span className="text-parchment">{stats.title}</span></span>
            <span>{count(stats.toolCalls)} tool calls · {stats.visitors} visitors</span>
          </div>
          <Meter value={progress} color={glow} />
        </div>
      )}
      <h3 className="eyebrow mt-3 mb-1.5">{id === 'tavern' ? 'Resting here' : 'Here right now'}</h3>
      {inside.length ? (
        <div className="flex flex-wrap gap-1.5">
          {inside.slice(0, 18).map(a => (
            <button key={a.id} type="button" onClick={() => { select(a.id); focus(a.id); onClose(); }}
              className="rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] ring-1 ring-line hover:ring-white/20">{a.name}</button>
          ))}
        </div>
      ) : <p className="text-[12px] text-muted">Nobody at the moment.</p>}
    </section>
  );
}
