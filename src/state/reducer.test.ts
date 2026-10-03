import type { Agent, PendingRequest, Snapshot } from '../types';
import { initialState, needsYou, reduce, dismissToast } from './reducer';
import { makeAgent } from '../test-utils';

const snapshot = (agents: Agent[], requests: PendingRequest[] = []): Snapshot => ({
  type: 'snapshot', agents, buildings: [], requests, stats: null as unknown as Snapshot['stats'],
  settings: { approvalMode: 'both', approvalWaitSec: 45, ordersMode: 'auto', codexHold: false, leashWaitMin: 30, mainTimeoutMin: 180, subTimeoutMin: 15 },
});

describe('reduce', () => {
  it('should load a snapshot and mark the state ready', () => {
    const s = reduce(initialState, snapshot([makeAgent()]));
    expect(s.ready).toBe(true);
    expect(s.agents.a1.name).toBe('Grimdur');
    expect(s.settings?.approvalMode).toBe('both');
  });

  it('should upsert agents and track requests', () => {
    let s = reduce(initialState, snapshot([]));
    s = reduce(s, { type: 'agent', agent: makeAgent({ id: 'b', name: 'Brok' }) });
    const req = { id: 'r1', agentId: 'b', kind: 'permission', source: 'claude', name: 'Brok', createdAt: 0, deadline: 1 } as PendingRequest;
    s = reduce(s, { type: 'request', request: req });
    expect(s.requests.r1.agentId).toBe('b');
    s = reduce(s, { type: 'request:closed', id: 'r1', agentId: 'b', reason: 'answered' });
    expect(s.requests.r1).toBeUndefined();
  });

  it('should turn fx events into timeline entries and toasts', () => {
    let s = reduce(initialState, snapshot([makeAgent()]));
    s = reduce(s, { type: 'fx', kind: 'activity', ts: 1, agentId: 'a1', activity: 'testing', detail: 'npm test' });
    expect(s.timeline[0].text).toBe('Grimdur · testing — npm test');
    expect(s.toasts).toHaveLength(0);
    s = reduce(s, { type: 'fx', kind: 'level', ts: 2, agentId: 'a1', name: 'Grimdur', level: 2, title: 'Journeyman' });
    expect(s.toasts[0].text).toMatch(/level 2/);
    expect(dismissToast(s, s.toasts[0].id).toasts).toHaveLength(0);
  });

  it('should keep state identity for unknown closures', () => {
    const s = reduce(initialState, snapshot([]));
    expect(reduce(s, { type: 'request:closed', id: 'nope', agentId: 'x', reason: 'x' })).toBe(s);
  });
});

describe('needsYou', () => {
  it('should list blocked dwarves before finished ones, oldest first', () => {
    const s = reduce(initialState, snapshot([
      makeAgent({ id: 'done', attention: { kind: 'done', since: 1 } }),
      makeAgent({ id: 'perm2', attention: { kind: 'permission', since: 5 } }),
      makeAgent({ id: 'perm1', attention: { kind: 'permission', since: 2 } }),
      makeAgent({ id: 'off', online: false, attention: { kind: 'done', since: 0 } }),
      makeAgent({ id: 'busy' }),
    ]));
    expect(needsYou(s).map(a => a.id)).toEqual(['perm1', 'perm2', 'done']);
  });
});
