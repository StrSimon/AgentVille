import { useMemo } from 'react';
import { BellRing, Crosshair, Hourglass, Terminal } from 'lucide-react';
import { needsYou } from '../state/reducer';
import { store, useVillage } from '../state/store';
import type { Agent, PendingRequest } from '../types';
import { duration } from '../lib/format';
import { useApp } from './app-context';
import { OrderBox } from './OrderBox';
import { PermissionBody, QuestionBody } from './RequestCard';
import { SourceBadge } from './widgets';
import { useNow } from './use-now';

function Card({ agent, request, now }: { agent: Agent; request?: PendingRequest; now: number }) {
  const { focus, select } = useApp();
  const att = agent.attention!;
  const blocking = att.kind !== 'done';
  const accent = blocking ? 'ring-alert/55 shadow-[0_0_30px_-10px_var(--color-alert)]' : 'ring-ember/35';
  return (
    <article className={`panel animate-rise rounded-2xl p-3.5 ring-1 ${accent}`} aria-label={`${agent.name} needs you`}>
      <header className="flex items-center gap-2">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full ${blocking ? 'animate-pulse-ring bg-alert text-white' : 'bg-ember/20 text-ember-soft'}`}>
          {blocking ? <BellRing size={14} /> : <Hourglass size={14} />}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-[15px] font-semibold">{agent.name}</span>
            <SourceBadge source={agent.source} compact />
          </div>
          <span className="block truncate text-[11px] text-muted">
            {agent.project || 'unknown project'} · {blocking ? 'blocked' : 'idle'} for <span className="tabular-nums text-parchment/80">{duration(now - att.since)}</span>
          </span>
        </div>
        <button type="button" onClick={() => { select(agent.id); focus(agent.id); }} aria-label={`Show ${agent.name} in the village`}
          className="grid size-7 place-items-center rounded-lg text-muted ring-1 ring-line transition hover:text-parchment">
          <Crosshair size={13} />
        </button>
      </header>

      {request?.kind === 'permission' && <PermissionBody req={request} now={now} />}
      {request?.kind === 'question' && <QuestionBody req={request} now={now} />}
      {!request && blocking && (
        <p className="mt-2.5 flex items-start gap-2 rounded-lg bg-black/25 px-2.5 py-2 text-[11.5px] text-parchment/80">
          <Terminal size={13} className="mt-0.5 shrink-0 text-muted" />
          <span>{att.kind === 'question' ? 'Asks' : 'Needs approval'}{att.text ? `: ${att.text}` : ''} — answer in its terminal{agent.source === 'codex' && att.kind === 'question' ? ' (Codex questions can’t be answered remotely)' : ''}.</span>
        </p>
      )}
      {!blocking && (
        <>
          <p className="mt-2 text-[12px] text-parchment/75">{att.leashed ? 'Finished — waiting for your next orders. Type here or in its terminal.' : 'Finished its task — waiting for your reply in its terminal.'}</p>
          <OrderBox agent={agent} compact />
        </>
      )}
    </article>
  );
}

/** Left column: every dwarf that is waiting on you, most urgent first. */
export function Inbox() {
  const agents = useVillage(s => s.agents);
  const requests = useVillage(s => s.requests);
  const now = useNow(1000);
  const waiting = useMemo(() => { void agents; return needsYou(store.getState()); }, [agents]);
  const byAgent = useMemo(() => {
    const m = new Map<string, PendingRequest>();
    for (const r of Object.values(requests)) if (r.kind !== 'orders') m.set(r.agentId, r);
    return m;
  }, [requests]);

  if (!waiting.length) return null;
  const blocked = waiting.filter(a => a.attention?.kind !== 'done').length;
  return (
    <section className="pointer-events-none absolute top-[84px] bottom-24 left-3 z-10 flex w-[340px] flex-col" aria-label="Dwarves waiting for you">
      <h2 className="eyebrow pointer-events-auto mb-2 flex items-center gap-2 px-1">
        {blocked > 0 && <span className="size-2 animate-pulse rounded-full bg-alert" />}
        Needs you · {waiting.length}
      </h2>
      <div className="scroll-thin pointer-events-auto -mr-2 flex flex-col gap-2.5 overflow-y-auto pr-2 pb-2">
        {waiting.map(a => <Card key={a.id} agent={a} request={byAgent.get(a.id)} now={now} />)}
      </div>
    </section>
  );
}
