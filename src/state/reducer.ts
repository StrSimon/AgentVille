import type {
  Agent, BuildingStats, FxEvent, PendingRequest, ServerMessage, Settings, Stats,
} from '../types';

export interface TimelineEntry {
  id: number;
  ts: number;
  agentId?: string;
  kind: FxEvent['kind'];
  text: string;
  activity?: FxEvent['activity'];
}

export interface Toast {
  id: number;
  ts: number;
  kind: 'achievement' | 'level' | 'building-level' | 'failure';
  text: string;
}

export interface VillageState {
  ready: boolean;
  agents: Record<string, Agent>;
  buildings: Record<string, BuildingStats>;
  requests: Record<string, PendingRequest>;
  stats: Stats | null;
  settings: Settings | null;
  timeline: TimelineEntry[];
  toasts: Toast[];
}

export const initialState: VillageState = {
  ready: false,
  agents: {},
  buildings: {},
  requests: {},
  stats: null,
  settings: null,
  timeline: [],
  toasts: [],
};

const TIMELINE_MAX = 120;
const TOAST_KINDS = new Set(['achievement', 'level', 'building-level']);
let seq = 0;

function describe(e: FxEvent, agents: Record<string, Agent>): string {
  const name = e.name || (e.agentId && agents[e.agentId]?.name) || 'A dwarf';
  switch (e.kind) {
    case 'spawn': return `${name} arrived in the village`;
    case 'despawn': return `${name} ${e.text || 'went home'}`;
    case 'activity': return `${name} · ${e.activity}${e.detail ? ` — ${e.detail}` : ''}`;
    case 'failure': return `${name} hit a snag: ${e.text}`;
    case 'level': return `${name} reached level ${e.level} — ${e.title}`;
    case 'building-level': return `${e.buildingId} grew to level ${e.level} — ${e.title}`;
    case 'achievement': return e.text || 'Achievement unlocked';
    case 'order': return `Orders sent to ${name}: “${e.text}”`;
    case 'order-delivered': return `${name} received the orders`;
    case 'decision': return `You ${e.text} ${name}'s request`;
    default: return e.text || '';
  }
}

/** Pure reducer: apply one bridge message to the state. */
export function reduce(state: VillageState, msg: ServerMessage): VillageState {
  switch (msg.type) {
    case 'snapshot':
      return {
        ...state,
        ready: true,
        agents: Object.fromEntries(msg.agents.map(a => [a.id, a])),
        buildings: Object.fromEntries(msg.buildings.map(b => [b.id, b])),
        requests: Object.fromEntries(msg.requests.map(r => [r.id, r])),
        stats: msg.stats,
        settings: msg.settings,
      };
    case 'agent':
      return { ...state, agents: { ...state.agents, [msg.agent.id]: msg.agent } };
    case 'building':
      return { ...state, buildings: { ...state.buildings, [msg.building.id]: msg.building } };
    case 'request':
      return { ...state, requests: { ...state.requests, [msg.request.id]: msg.request } };
    case 'request:closed': {
      if (!state.requests[msg.id]) return state;
      const requests = { ...state.requests };
      delete requests[msg.id];
      return { ...state, requests };
    }
    case 'stats':
      return { ...state, stats: msg.stats };
    case 'limits':
      return state.stats ? { ...state, stats: { ...state.stats, limits: msg.limits } } : state;
    case 'settings':
      return { ...state, settings: msg.settings };
    case 'fx': {
      const text = describe(msg, state.agents);
      const entry: TimelineEntry = { id: ++seq, ts: msg.ts, agentId: msg.agentId, kind: msg.kind, text, activity: msg.activity };
      const timeline = [entry, ...state.timeline].slice(0, TIMELINE_MAX);
      const toasts = TOAST_KINDS.has(msg.kind)
        ? [...state.toasts, { id: entry.id, ts: msg.ts, kind: msg.kind as Toast['kind'], text }].slice(-4)
        : state.toasts;
      return { ...state, timeline, toasts };
    }
    default:
      return state;
  }
}

export function dismissToast(state: VillageState, id: number): VillageState {
  return { ...state, toasts: state.toasts.filter(t => t.id !== id) };
}

/** Dwarves that need the user, most urgent first. */
export function needsYou(state: VillageState): Agent[] {
  const rank = (a: Agent) => (a.attention?.kind === 'done' ? 1 : 0);
  return Object.values(state.agents)
    .filter(a => a.online && a.attention)
    .sort((a, b) => rank(a) - rank(b) || (a.attention!.since - b.attention!.since));
}
