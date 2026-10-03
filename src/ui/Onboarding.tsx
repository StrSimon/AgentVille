import { useEffect, useState } from 'react';
import { Copy, Pickaxe, Sparkles } from 'lucide-react';
import { useVillage } from '../state/store';
import type { SetupStatus } from '../state/controller';
import { useApp } from './app-context';

const CMD = 'npx agent-ville';

/** First run: connect Claude Code / Codex with one click. */
export function Welcome() {
  const { controller, mode, switchMode } = useApp();
  const anyOnline = useVillage(s => Object.values(s.agents).some(a => a.online));
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('agentville-welcome') === 'done');
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => { if (mode === 'live') void controller.setupStatus().then(setStatus); }, [controller, mode]);

  if (mode !== 'live' || !status || dismissed || anyOnline) return null;
  const detected = (['claude', 'codex'] as const).filter(t => status[t].detected);
  const connected = detected.filter(t => status[t].installed);
  const allSet = detected.length > 0 && connected.length === detected.length;
  const close = () => { localStorage.setItem('agentville-welcome', 'done'); setDismissed(true); };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-night/40 p-4">
      <section className="panel animate-rise w-full max-w-[480px] rounded-3xl p-7 text-center" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-ember to-[#b45309] text-night shadow-[0_0_40px_-6px_var(--color-ember)]">
          <Pickaxe size={28} strokeWidth={2.3} />
        </span>
        <h2 id="welcome-title" className="mt-4 font-display text-3xl font-semibold tracking-tight">Welcome to AgentVille</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-parchment/75">
          Every Claude Code and Codex session becomes a dwarf in this village. You’ll see what they do, what it costs —
          and you can approve requests right here.
        </p>
        {allSet ? (
          <p className="mt-5 rounded-xl bg-ok/10 px-4 py-3 text-[13px] text-ok ring-1 ring-ok/30">
            All set! Start a new session in any terminal or editor — your first dwarf arrives in seconds.
          </p>
        ) : (
          <button type="button"
            onClick={async () => {
              const res = await controller.setup();
              setNotes(res?.notes || []);
              setStatus(await controller.setupStatus());
            }}
            className="mt-6 w-full rounded-2xl bg-ember py-3 text-[14px] font-bold text-night transition hover:bg-ember-soft"
            disabled={!detected.length}>
            {detected.length ? `Connect ${detected.map(t => (t === 'claude' ? 'Claude Code' : 'Codex')).join(' + ')}` : 'No Claude Code or Codex found'}
          </button>
        )}
        {notes.map(n => <p key={n} className="mt-2 text-[12px] text-ember-soft">› {n}</p>)}
        <div className="mt-4 flex justify-center gap-4 text-[12px]">
          <button type="button" onClick={() => { close(); switchMode('demo'); }} className="flex items-center gap-1 text-muted hover:text-parchment"><Sparkles size={13} /> Watch the demo</button>
          <button type="button" onClick={close} className="text-muted hover:text-parchment">{allSet ? 'Enter the village' : 'Later'}</button>
        </div>
      </section>
    </div>
  );
}

/** Shown on the hosted site, where no local bridge is reachable. */
export function HostedBanner() {
  const { hosted } = useApp();
  const [copied, setCopied] = useState(false);
  if (!hosted) return null;
  return (
    <div className="panel animate-rise absolute bottom-24 left-3 z-20 w-[340px] rounded-2xl p-4">
      <p className="eyebrow">You’re watching the demo village</p>
      <p className="mt-1 text-[13px] text-parchment/80">See your own Claude Code & Codex agents — one command, nothing to configure:</p>
      <button type="button"
        onClick={() => { void navigator.clipboard.writeText(CMD); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="mt-2.5 flex w-full items-center justify-between rounded-xl bg-black/40 px-3 py-2.5 font-mono text-[13px] text-ember-soft ring-1 ring-line hover:ring-ember/50">
        {CMD} <span className="flex items-center gap-1 font-sans text-[11px] text-muted"><Copy size={12} />{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <p className="mt-2 text-[11px] text-muted">Or grab the desktop app for macOS, Windows & Linux from GitHub Releases.</p>
    </div>
  );
}
