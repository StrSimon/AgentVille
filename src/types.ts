export type ActivityType =
  | 'planning'
  | 'coding'
  | 'testing'
  | 'researching'
  | 'reviewing'
  | 'idle';

export interface AgentState {
  id: string;
  name: string;
  role: string;
  color: string;
  position: { x: number; y: number };
  targetBuilding: string | null;
  previousBuilding: string | null;
  activity: ActivityType;
  status: 'idle' | 'moving' | 'working';
  detail: string;
  project?: string;
  clan?: string;
  parentId?: string;
  isSubAgent?: boolean;
  previousActivity?: ActivityType;
  waiting?: boolean;
  failure?: string;
  offline?: boolean;
  totalInputBytes: number;
  totalOutputBytes: number;
  subAgentsSpawned: number;
  spawnedAt: number;
  level: number;
  title: string;
  xp: number;
  nextLevelXP: number | null;
}

export interface BuildingState {
  id: string;
  name: string;
  type: ActivityType;
  position: { x: number; y: number };
  color: string;
  glowColor: string;
  icon: string;
  activeAgents: string[];
}

export interface Trail {
  id: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  color: string;
  createdAt: number;
}

export interface AgentEvent {
  type:
    | 'agent:spawn'
    | 'agent:move'
    | 'agent:work'
    | 'agent:communicate'
    | 'agent:complete'
    | 'agent:despawn'
    | 'agent:tokens'
    | 'agent:levelup'
    | 'agent:xp'
    | 'agent:waiting'
    | 'agent:achievement'
    | 'agent:failure';
  agentId: string;
  agentName?: string;
  agentRole?: string;
  activity?: ActivityType;
  targetBuilding?: string;
  targetAgent?: string;
  detail?: string;
  project?: string;
  clan?: string;
  parentId?: string;
  totalInputBytes?: number;
  totalOutputBytes?: number;
  level?: number;
  title?: string;
  xp?: number;
  nextLevelXP?: number | null;
  subAgentsSpawned?: number;
  recentActivity?: { activity: string; detail: string; timestamp: number }[];
  waiting?: boolean;
  achievement?: string;
  offline?: boolean;
}

// ── Clan colors ─────────────────────────────────────────
// Distinct, earthy/fantasy palette for clan badges.
// Deterministic: same clan name always gets the same color.
const CLAN_COLORS = [
  '#c2884d', // bronze
  '#5b8a72', // forest
  '#8b6cc1', // amethyst
  '#c75d5d', // garnet
  '#4a90b8', // steel blue
  '#b8943a', // gold
  '#6b8e5a', // moss
  '#a85882', // rose quartz
  '#5c7fa8', // slate
  '#d49a5a', // copper
  '#7a6e5d', // stone
  '#9c6b4e', // clay
];

export function getClanColor(clan: string): string {
  let hash = 0;
  for (let i = 0; i < clan.length; i++) {
    hash = ((hash << 5) - hash + clan.charCodeAt(i)) | 0;
  }
  return CLAN_COLORS[Math.abs(hash) % CLAN_COLORS.length];
}
