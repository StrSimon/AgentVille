import { useMemo, useState, useSyncExternalStore } from 'react';
import { Gauge, Pickaxe, Settings, Users, Volume2, VolumeX } from 'lucide-react';
import { useVillage } from '../state/store';
import { connectionStore } from '../state/controller';
import { money, windowLabel } from '../lib/format';
import { sound } from '../lib/sound';
import type { Agent, PlanLimits } from '../types';
import { useApp } from './app-context';
import { BurnSparkline, IconButton, Ring, SOURCE_HEX } from './widgets';

const isMacApp = /Electron/.test(navigator.userAgent) && /Mac/.test(navigator.platform);

function counts(agents: Record<string, Agent>) {
  let working = 0, waiting = 0, online = 0, residents = 0;
  for (const a of Object.values(agents)) {
    residents++;
    if (!a.online) continue;
    online++;
    if (a.attention) waiting++;
    else if (a.activity !== 'idle' && a.activity !== 'waiting') working++;
  }
  return { working, waiting, online, residents };
}

function LimitChip({ source, limits }: { source: string; limits: PlanLimits }) {
  const w = limits.windows[0];
  if (!w) return null;
  return (
    <span className="flex items-center gap-1.5" title={`${source === 'claude' ? 'Claude' : 'Codex'} ${windowLabel(w.windowMinutes)} limit`}>
      <Ring value={w.usedPercent} size={28} stroke={3.5} />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold" style={{ color: SOURCE_HEX[source] }}>{source === 'claude' ? 'Claude' : 'Codex'}</span>
        <span className="text-[10px] text-muted">{windowLabel(w.windowMinutes)}</span>
      </span>
    </span>
  );
}

export function TopBar() {
  const { setOverlay, overlay, mode, switchMode, hosted } = useApp();
  const agents = useVillage(s => s.agents);
  const stats = useVillage(s => s.stats);
  const connection = useSyncExternalStore(connectionStore.subscribe, connectionStore.get);
  const c = useMemo(() => counts(agents), [agents]);
  const [muted, setMuted] = useState(!sound.enabled);
  const burn = stats?.burn;
  const limits = stats?.limits || {};

  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3 p-3"
      style={{ paddingLeft: isMacApp ? 88 : undefined, WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="panel pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-2.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-ember to-[#b45309] text-night shadow-[0_0_20px_-4px_var(--color-ember)]">
          <Pickaxe size={17} strokeWidth={2.4} />
        </span>
        <div className="leading-tight">
          <h1 className="font-display text-[19px] font-semibold tracking-tight">AgentVille</h1>
          <p className="text-[11px] text-muted" aria-live="polite">
            <span className="text-parchment/90">{c.working}</span> working
            {c.waiting > 0 && <> · <span className="font-semibold text-alert">{c.waiting} need{c.waiting === 1 ? 's' : ''} you</span></>}
            {' '}· {c.residents} residents
          </p>
        </div>
      </div>

      {burn && (
        <button
          type="button"
          onClick={() => setOverlay(overlay === 'control' ? 'none' : 'control')}
          className="panel pointer-events-auto flex items-center gap-4 rounded-2xl px-4 py-2 text-left transition-colors hover:border-ember/40"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          aria-label="Open the control center"
        >
          <span className="leading-tight">
            <span className="eyebrow block">Burn · 24h</span>
            <span className="font-display text-xl font-semibold tabular-nums">{money(burn.last24.cost)}</span>
          </span>
          <BurnSparkline hours={burn.hours} />
          <span className="leading-tight">
            <span className="eyebrow block">Now</span>
            <span className="text-sm font-semibold tabular-nums text-ember-soft">{money(burn.perHour)}<span className="text-muted">/h</span></span>
          </span>
          {Object.entries(limits).map(([src, l]) => l && <LimitChip key={src} source={src} limits={l} />)}
        </button>
      )}

      <div className="ml-auto flex items-center gap-2 pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {!hosted && (
          <div className="panel flex rounded-xl p-0.5 text-[11px] font-semibold" role="group" aria-label="Data source">
            {(['live', 'demo'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
                className={`rounded-[10px] px-3 py-1.5 capitalize transition-colors ${mode === m ? 'bg-white/10 text-parchment' : 'text-muted hover:text-parchment'}`}
              >
                {m === 'live' && mode === 'live' && (
                  <span className={`mr-1.5 inline-block size-1.5 rounded-full ${connection === 'online' ? 'bg-ok' : connection === 'connecting' ? 'bg-ember' : 'bg-alert'}`} />
                )}
                {m}
              </button>
            ))}
          </div>
        )}
        <IconButton label="Control center (C)" onClick={() => setOverlay(overlay === 'control' ? 'none' : 'control')} active={overlay === 'control'}><Gauge size={17} /></IconButton>
        <IconButton label="Residents (R)" onClick={() => setOverlay(overlay === 'residents' ? 'none' : 'residents')} active={overlay === 'residents'}><Users size={17} /></IconButton>
        <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => { sound.set(muted); setMuted(!muted); }}>
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </IconButton>
        <IconButton label="Settings" onClick={() => setOverlay(overlay === 'settings' ? 'none' : 'settings')} active={overlay === 'settings'}><Settings size={17} /></IconButton>
      </div>
    </header>
  );
}
