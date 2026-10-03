import { useState } from 'react';
import { Anchor, Send } from 'lucide-react';
import type { Agent } from '../types';
import { useApp } from './app-context';

/** Send instructions to a dwarf and toggle "wait in the village for orders". */
export function OrderBox({ agent, compact = false }: { agent: Agent; compact?: boolean }) {
  const { controller } = useApp();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const leashed = agent.leash;
  const done = agent.attention?.kind === 'done';
  const deliverable = agent.busy || leashed;

  const send = async () => {
    if (!text.trim()) return;
    if (await controller.sendOrder(agent.id, text.trim())) {
      setText('');
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    }
  };

  const hint = leashed
    ? done ? 'Waiting in the village — orders start it right away.' : 'Will wait in the village for orders after this task.'
    : agent.busy ? 'Delivered with its next tool call.'
      : 'Idle in its terminal — orders wait until it acts again. Turn on “Wait for orders” to command it from here.';

  return (
    <div className={compact ? 'mt-2.5' : 'mt-1'}>
      <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={deliverable ? `Orders for ${agent.name}…` : 'Orders (queued)…'}
          aria-label={`Send orders to ${agent.name}`}
          className="min-w-0 flex-1 rounded-xl bg-black/30 px-3 py-2 text-[12px] ring-1 ring-line outline-none placeholder:text-muted/70 focus:ring-ember/60"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send orders"
          className="grid w-9 place-items-center rounded-xl bg-ember text-night transition hover:bg-ember-soft disabled:opacity-40">
          <Send size={14} strokeWidth={2.5} />
        </button>
      </form>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-muted">{sent ? (deliverable ? '✓ Orders sent' : '✓ Queued — delivered on its next action') : hint}</span>
        <button
          type="button"
          onClick={() => controller.setLeash(agent.id, !leashed)}
          aria-pressed={leashed}
          className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-semibold ring-1 transition ${leashed ? 'bg-ember/15 text-ember-soft ring-ember/50' : 'text-muted ring-line hover:text-parchment'}`}
          title="When it finishes, the dwarf waits in the village for your next orders instead of going idle"
        >
          <Anchor size={11} /> Wait for orders
        </button>
      </div>
    </div>
  );
}
