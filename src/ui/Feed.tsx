import { useEffect, useState } from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { store, useVillage } from '../state/store';
import { sound } from '../lib/sound';
import { ACTIVITY_META } from './activity-meta';
import { useApp } from './app-context';

/** Bottom ticker of the latest village events. */
export function Timeline() {
  const timeline = useVillage(s => s.timeline);
  const { select } = useApp();
  const [open, setOpen] = useState(false);
  const items = timeline.slice(0, open ? 40 : 4);
  if (!timeline.length) return null;
  return (
    <section className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3" aria-label="Village activity">
      <div className={`panel pointer-events-auto w-full max-w-[640px] rounded-2xl px-3 py-2 ${open ? 'max-h-72' : ''}`}>
        <button type="button" onClick={() => setOpen(o => !o)} className="eyebrow flex w-full items-center justify-between py-0.5" aria-expanded={open}>
          <span>Village chronicle</span><span>{open ? 'less' : 'more'}</span>
        </button>
        <ol className={`scroll-thin mt-1 space-y-0.5 ${open ? 'max-h-60 overflow-y-auto' : ''}`} aria-live="polite">
          {items.map(e => (
            <li key={e.id} className="flex items-center gap-2 text-[11.5px] text-parchment/80">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: e.activity ? ACTIVITY_META[e.activity].color : e.kind === 'failure' ? '#fb4f6b' : '#f59e0b' }} />
              <button type="button" onClick={() => e.agentId && select(e.agentId)} className="truncate text-left hover:text-parchment">{e.text}</button>
              <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted">{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Celebratory toasts for level-ups and achievements. */
export function Toasts() {
  const toasts = useVillage(s => s.toasts);
  const [seen] = useState(() => new Set<number>());
  useEffect(() => {
    for (const t of toasts) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      sound.achievement();
      setTimeout(() => store.dismissToast(t.id), 6000);
    }
  }, [toasts, seen]);
  return (
    <div className="pointer-events-none absolute top-[84px] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="panel animate-rise flex items-center gap-2.5 rounded-2xl px-4 py-2.5 ring-1 ring-ember/40">
          <span className="grid size-7 place-items-center rounded-full bg-ember/20 text-ember-soft">
            {t.kind === 'achievement' ? <Trophy size={14} /> : <Sparkles size={14} />}
          </span>
          <span className="text-[13px] font-medium">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
