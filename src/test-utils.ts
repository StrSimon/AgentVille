import type { Agent } from './types';

/** Build a complete Agent with sensible defaults for tests. */
export function makeAgent(over: Partial<Agent> = {}): Agent {
  return {
    id: 'a1', name: 'Grimdur', source: 'claude', kind: 'main', parentId: null, agentType: null, project: 'shop',
    model: null, modelLabel: null, online: true, busy: true, activity: 'coding', detail: 'App.tsx', attention: null,
    leash: false, orders: 0, failure: null, xp: 10, level: 1, title: 'Apprentice', levelXP: 0, nextLevelXP: 50,
    nextTitle: 'Journeyman', toolCalls: 10, sessions: 1, subAgentsSpawned: 0, cost: 1, tokens: 1000, bytesIn: 0,
    bytesOut: 0, models: [], activityCounts: {}, recentActivity: [], firstSeen: 0, lastSeen: 0, ...over,
  };
}
