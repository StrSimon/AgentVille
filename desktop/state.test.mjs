import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTracker, statusLine } from './state.mjs';

const agent = (id, extra = {}) => ({ id, name: id, online: true, busy: false, attention: null, ...extra });

test('tracker counts working and attention dwarves from a snapshot', () => {
  const t = createTracker();
  t.apply({
    type: 'snapshot',
    agents: [
      agent('a', { busy: true }),
      agent('b', { busy: true, attention: { kind: 'permission' } }),
      agent('c', { online: false, busy: true }),
      agent('d'),
    ],
    requests: [],
  });
  assert.deepEqual(t.counts(), { online: 3, working: 1, attention: 1 });
});

test('tracker counts open requests as needing attention', () => {
  const t = createTracker();
  t.apply({ type: 'snapshot', agents: [agent('a', { busy: true })], requests: [] });
  const fx = t.apply({ type: 'request', request: { id: 'r1', agentId: 'a', kind: 'permission' } });
  assert.equal(fx.opened.id, 'r1');
  assert.equal(t.counts().attention, 1);
  const closed = t.apply({ type: 'request:closed', id: 'r1' });
  assert.equal(closed.closedId, 'r1');
  assert.equal(t.counts().attention, 0);
});

test('tracker reports an agent that just finished (attention becomes done)', () => {
  const t = createTracker();
  t.apply({ type: 'snapshot', agents: [agent('a', { busy: true })], requests: [] });
  const fx = t.apply({ type: 'agent', agent: agent('a', { attention: { kind: 'done' } }) });
  assert.equal(fx.done.id, 'a');
  const again = t.apply({ type: 'agent', agent: agent('a', { attention: { kind: 'done' } }) });
  assert.equal(again.done, undefined);
});

test('statusLine summarises counts', () => {
  assert.equal(statusLine({ online: 0, working: 0, attention: 0 }), 'The village is quiet');
  assert.equal(statusLine({ online: 4, working: 3, attention: 1 }), '3 working · 1 needs you');
  assert.equal(statusLine({ online: 2, working: 0, attention: 2 }), '2 need you');
  assert.equal(statusLine({ online: 2, working: 0, attention: 0 }), '2 idle');
});
