// Shapes sent by the bridge (see server/core/profiles.mjs + village.mjs).

export const ACTIVITIES = [
  'planning', 'delegating', 'coding', 'writing', 'testing', 'debugging', 'researching',
  'browsing', 'reviewing', 'committing', 'installing', 'deploying', 'waiting', 'remembering', 'idle',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

export type Source = 'claude' | 'codex' | 'custom';

export interface Attention {
  kind: 'permission' | 'question' | 'done';
  since: number;
  text?: string;
  tool?: string;
  requestId?: string;
  terminal?: boolean;
  leashed?: boolean;
}

export interface ModelUsage {
  model: string;
  label: string;
  cost: number;
  tokens: number;
}

export interface ActivityRecord {
  activity: Activity;
  detail: string;
  timestamp: number;
}

export interface Agent {
  id: string;
  name: string;
  source: Source;
  kind: 'main' | 'sub';
  parentId: string | null;
  agentType: string | null;
  project: string | null;
  model: string | null;
  modelLabel: string | null;
  online: boolean;
  busy: boolean;
  activity: Activity;
  detail: string;
  attention: Attention | null;
  leash: boolean;
  orders: number;
  failure: { text: string; at: number } | null;
  xp: number;
  level: number;
  title: string;
  levelXP: number;
  nextLevelXP: number | null;
  nextTitle: string | null;
  toolCalls: number;
  sessions: number;
  subAgentsSpawned: number;
  cost: number;
  tokens: number;
  bytesIn: number;
  bytesOut: number;
  models: ModelUsage[];
  activityCounts: Partial<Record<Activity, number>>;
  recentActivity: ActivityRecord[];
  firstSeen: number;
  lastSeen: number;
}

export interface BuildingStats {
  id: string;
  xp: number;
  level: number;
  title: string;
  levelXP: number;
  nextLevelXP: number | null;
  toolCalls: number;
  visitors: number;
  visits: number;
  lastActivity: number | null;
}

export interface Question {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options?: Array<{ label: string; description?: string }>;
}

export interface PendingRequest {
  id: string;
  agentId: string;
  kind: 'permission' | 'question' | 'orders';
  source: Source;
  name: string;
  project?: string;
  tool?: string;
  detail?: string;
  command?: string;
  questions?: Question[];
  createdAt: number;
  deadline: number;
}

export interface LimitWindow {
  usedPercent: number;
  windowMinutes: number | null;
  resetsAt: number | null;
}

export interface PlanLimits {
  plan: string | null;
  windows: LimitWindow[];
  credits: { balance: number | null; unlimited: boolean } | null;
  spend?: { usedPercent: number; usedUsd: number | null; limitUsd: number | null; period: string | null; resetsAt: number | null } | null;
  reached: string | null;
  updatedAt?: number;
}

export interface SourceTotals { cost: number; tokens: number; toolCalls: number; dwarves?: number }

export interface BurnHour { hour: number; cost: number; tokens: number; bySource: Partial<Record<Source, number>> }

export interface Stats {
  bySource: Record<string, SourceTotals>;
  days: Array<{ day: string } & Partial<Record<Source, SourceTotals>>>;
  projects: Array<{ name: string } & Partial<Record<Source, SourceTotals>>>;
  models: Array<{ model: string; label: string; source: Source; cost: number; tokens: number }>;
  today: Partial<Record<Source, SourceTotals>>;
  burn: {
    hours: BurnHour[];
    last24: { cost: number; tokens: number; bySource: Partial<Record<Source, { cost: number; tokens: number }>> };
    perHour: number;
    projected24h: number;
  };
  limits: Partial<Record<Source, PlanLimits>>;
}

export interface Settings {
  approvalMode: 'both' | 'village' | 'terminal';
  approvalWaitSec: number;
  ordersMode: 'auto' | 'leash' | 'off';
  codexHold: boolean;
  leashWaitMin: number;
  mainTimeoutMin: number;
  subTimeoutMin: number;
}

export type FxKind = 'spawn' | 'despawn' | 'activity' | 'failure' | 'level' | 'building-level'
  | 'achievement' | 'order' | 'order-delivered' | 'decision';

export interface FxEvent {
  type: 'fx';
  kind: FxKind;
  ts: number;
  agentId?: string;
  name?: string;
  text?: string;
  activity?: Activity;
  detail?: string;
  level?: number;
  title?: string;
  buildingId?: string;
  source?: Source;
  parentId?: string | null;
}

export interface Snapshot {
  type: 'snapshot';
  agents: Agent[];
  buildings: BuildingStats[];
  requests: PendingRequest[];
  stats: Stats;
  settings: Settings;
}

export type ServerMessage =
  | Snapshot
  | { type: 'agent'; agent: Agent }
  | { type: 'building'; building: BuildingStats }
  | { type: 'request'; request: PendingRequest }
  | { type: 'request:closed'; id: string; agentId: string; reason: string }
  | { type: 'stats'; stats: Stats }
  | { type: 'limits'; limits: Partial<Record<Source, PlanLimits>> }
  | { type: 'settings'; settings: Settings }
  | FxEvent;
