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
  parentId?: string;
  isSubAgent?: boolean;
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
    | 'agent:xp';
  agentId: string;
  agentName?: string;
  agentRole?: string;
  activity?: ActivityType;
  targetBuilding?: string;
  targetAgent?: string;
  detail?: string;
  project?: string;
  parentId?: string;
  totalInputBytes?: number;
  totalOutputBytes?: number;
  level?: number;
  title?: string;
  xp?: number;
  nextLevelXP?: number | null;
  subAgentsSpawned?: number;
  recentActivity?: { activity: string; detail: string; timestamp: number }[];
}
