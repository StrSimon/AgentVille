import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Link2, Moon, Sun, SunMoon, X } from 'lucide-react';
import { useVillage } from '../state/store';
import type { SetupStatus } from '../state/controller';
import type { Settings } from '../types';
import { notificationsAllowed, requestNotifications } from '../lib/attention';
import { useApp } from './app-context';

function Connection({ name, status, onConnect }: { name: string; status?: SetupStatus['claude']; onConnect: () => void }) {
  const state = !status ? 'unknown' : !status.detected ? 'missing' : status.installed ? 'connected' : 'available';
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-line">
      <span className="flex-1 text-[13px] font-medium">{name}</span>
      {state === 'connected' && <span className="flex items-center gap-1 text-[12px] text-ok"><CheckCircle2 size={14} /> Connected</span>}
      {state === 'missing' && <span className="text-[12px] text-muted">Not installed</span>}
      {state === 'unknown' && <span className="text-[12px] text-muted">Demo mode</span>}
      {state === 'available' && (
        <button type="button" onClick={onConnect} className="flex items-center gap-1 rounded-lg bg-ember px-2.5 py-1 text-[12px] font-bold text-night hover:bg-ember-soft">
          <Link2 size={13} /> Connect
        </button>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const { setOverlay, controller, timeMode, setTimeMode } = useApp();
  const settings = useVillage(s => s.settings);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [notify, setNotify] = useState(notificationsAllowed());

  useEffect(() => { void controller.setupStatus().then(setSetup); }, [controller]);

  const connect = async (target: 'claude' | 'codex') => {
    const res = await controller.setup([target]);
    if (res) setNotes(res.notes);
    setSetup(await controller.setupStatus());
  };
  const save = (patch: Partial<Settings>) => void controller.saveSettings(patch);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-night/55 p-4 backdrop-blur-[2px]" onClick={() => setOverlay('none')}>
      <section className="panel animate-rise scroll-thin max-h-[calc(100vh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-3xl p-6"
        role="dialog" aria-modal="true" aria-labelledby="set-title" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between">
          <h2 id="set-title" className="font-display text-3xl font-semibold tracking-tight">Settings</h2>
          <button type="button" onClick={() => setOverlay('none')} aria-label="Close" className="grid size-9 place-items-center rounded-xl text-muted ring-1 ring-line hover:text-parchment"><X size={16} /></button>
        </header>

        <h3 className="eyebrow mt-5 mb-2">Connections</h3>
        <div className="space-y-2">
          <Connection name="Claude Code — CLI, desktop & IDE" status={setup?.claude} onConnect={() => connect('claude')} />
          <Connection name="Codex — CLI, app & IDE" status={setup?.codex} onConnect={() => connect('codex')} />
        </div>
        {notes.map(n => <p key={n} className="mt-2 text-[12px] text-ember-soft">› {n}</p>)}
        <p className="mt-2 text-[11px] text-muted">Hooks are installed globally, so every new session — in any terminal or editor — shows up here. Remove them anytime with <code className="font-mono">npx agent-ville uninstall</code>.</p>

        {settings && (
          <>
            <h3 className="eyebrow mt-6 mb-2">Approvals & questions</h3>
            <div className="grid gap-1.5" role="radiogroup" aria-label="Where to answer">
              {([
                ['both', 'Village first, then terminal', `Hold requests here for ${settings.approvalWaitSec}s while the village is open, then fall back to the terminal.`],
                ['village', 'Village only', 'Requests wait up to 10 minutes for you here. Best with the desktop app and notifications.'],
                ['terminal', 'Terminal only', 'Just show who is waiting; answer in the terminal as usual.'],
              ] as const).map(([value, label, hint]) => (
                <button key={value} type="button" role="radio" aria-checked={settings.approvalMode === value} onClick={() => save({ approvalMode: value })}
                  className={`rounded-xl px-3 py-2.5 text-left ring-1 transition ${settings.approvalMode === value ? 'bg-ember/12 ring-ember/60' : 'bg-white/[0.02] ring-line hover:ring-white/20'}`}>
                  <span className="text-[13px] font-semibold">{label}</span>
                  <span className="block text-[11px] text-muted">{hint}</span>
                </button>
              ))}
            </div>
            {settings.approvalMode === 'both' && (
              <label className="mt-3 flex items-center gap-3 text-[12px]">
                Terminal fallback after
                <input type="range" min={10} max={180} step={5} value={settings.approvalWaitSec}
                  onChange={(e) => save({ approvalWaitSec: Number(e.target.value) })} className="flex-1 accent-[var(--color-ember)]" />
                <span className="w-10 text-right tabular-nums">{settings.approvalWaitSec}s</span>
              </label>
            )}
          </>
        )}

        <h3 className="eyebrow mt-6 mb-2">Village</h3>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Time of day">
          {([['auto', 'Real time', SunMoon], ['day', 'Always day', Sun], ['night', 'Always night', Moon]] as const).map(([v, label, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={timeMode === v} onClick={() => setTimeMode(v)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] font-semibold ring-1 ${timeMode === v ? 'bg-white/10 ring-white/25' : 'text-muted ring-line hover:text-parchment'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <button type="button" disabled={notify}
          onClick={async () => setNotify(await requestNotifications())}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold ring-1 ring-line hover:ring-white/20 disabled:text-ok">
          <Bell size={14} /> {notify ? 'Desktop notifications on' : 'Notify me when a dwarf needs me'}
        </button>
      </section>
    </div>
  );
}
