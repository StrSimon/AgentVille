import { useState } from 'react';
import { Check, Terminal, X } from 'lucide-react';
import type { PendingRequest, Question } from '../types';
import { duration } from '../lib/format';
import { sound } from '../lib/sound';
import { useApp } from './app-context';

function Countdown({ req, now }: { req: PendingRequest; now: number }) {
  const total = req.deadline - req.createdAt;
  const left = Math.max(0, req.deadline - now);
  return (
    <div className="mt-3 flex items-center gap-2 text-[10px] text-muted">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-alert/70 transition-[width] duration-1000 ease-linear" style={{ width: `${(left / total) * 100}%` }} />
      </div>
      <span className="tabular-nums">terminal in {duration(left)}</span>
    </div>
  );
}

export function PermissionBody({ req, now }: { req: PendingRequest; now: number }) {
  const { controller } = useApp();
  const [busy, setBusy] = useState(false);
  const answer = async (decision: 'allow' | 'deny' | 'release') => {
    setBusy(true);
    if (decision === 'allow') sound.approve();
    await controller.respond(req.id, decision === 'release' ? { release: true } : { decision });
  };
  return (
    <>
      <p className="mt-2 text-[12px] text-parchment/80">wants to use <span className="font-semibold text-parchment">{req.tool}</span></p>
      {req.command && (
        <pre className="scroll-thin mt-1.5 max-h-28 overflow-auto rounded-lg bg-black/40 px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-amber-100/90">
          {req.command}
        </pre>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => answer('allow')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ok/90 py-2 text-[12px] font-bold text-night transition hover:bg-ok disabled:opacity-50">
          <Check size={14} strokeWidth={3} /> Allow
        </button>
        <button type="button" disabled={busy} onClick={() => answer('deny')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-alert/15 py-2 text-[12px] font-bold text-alert ring-1 ring-alert/40 transition hover:bg-alert/25 disabled:opacity-50">
          <X size={14} strokeWidth={3} /> Deny
        </button>
        <button type="button" disabled={busy} onClick={() => answer('release')} title="Answer in the terminal instead"
          aria-label="Answer in the terminal instead"
          className="grid w-10 place-items-center rounded-xl bg-white/5 text-muted ring-1 ring-line transition hover:text-parchment disabled:opacity-50">
          <Terminal size={14} />
        </button>
      </div>
      <Countdown req={req} now={now} />
    </>
  );
}

function QuestionBlock({ q, value, onChange }: { q: Question; value: string[]; onChange: (v: string[]) => void }) {
  const [other, setOther] = useState('');
  const toggle = (label: string) => {
    if (q.multiSelect) onChange(value.includes(label) ? value.filter(v => v !== label) : [...value, label]);
    else onChange([label]);
  };
  return (
    <fieldset className="mt-2">
      <legend className="text-[12.5px] font-medium text-parchment">{q.question}</legend>
      <div className="mt-2 grid gap-1.5">
        {(q.options || []).map(o => {
          const on = value.includes(o.label);
          return (
            <button key={o.label} type="button" onClick={() => toggle(o.label)} aria-pressed={on}
              className={`rounded-xl px-3 py-2 text-left text-[12px] ring-1 transition ${on ? 'bg-ember/15 ring-ember/60' : 'bg-white/[0.03] ring-line hover:ring-white/20'}`}>
              <span className="font-semibold">{o.label}</span>
              {o.description && <span className="block text-[11px] text-muted">{o.description}</span>}
            </button>
          );
        })}
        <input
          value={other}
          onChange={(e) => { setOther(e.target.value); onChange(e.target.value ? [e.target.value] : []); }}
          placeholder="Other answer…"
          aria-label={`Other answer for: ${q.question}`}
          className="rounded-xl bg-black/30 px-3 py-2 text-[12px] ring-1 ring-line outline-none placeholder:text-muted/70 focus:ring-ember/60"
        />
      </div>
    </fieldset>
  );
}

export function QuestionBody({ req, now }: { req: PendingRequest; now: number }) {
  const { controller } = useApp();
  const questions = req.questions || [];
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const complete = questions.every(q => (answers[q.question] || []).length > 0);
  const submit = async () => {
    const out = Object.fromEntries(questions.map(q => [q.question, (answers[q.question] || []).join(',')]));
    sound.approve();
    await controller.respond(req.id, { answers: out });
  };
  return (
    <>
      {questions.map(q => (
        <QuestionBlock key={q.question} q={q} value={answers[q.question] || []} onChange={(v) => setAnswers(a => ({ ...a, [q.question]: v }))} />
      ))}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={!complete} onClick={submit}
          className="flex-1 rounded-xl bg-ember py-2 text-[12px] font-bold text-night transition hover:bg-ember-soft disabled:opacity-40">
          Send answer
        </button>
        <button type="button" onClick={() => controller.respond(req.id, { release: true })} aria-label="Answer in the terminal instead"
          className="grid w-10 place-items-center rounded-xl bg-white/5 text-muted ring-1 ring-line hover:text-parchment">
          <Terminal size={14} />
        </button>
      </div>
      <Countdown req={req} now={now} />
    </>
  );
}
