import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Village } from './components/Village'
import { ActivityTimeline, type TimelineEntry } from './components/ActivityTimeline'
import { AgentStatsPanel, type ActivityRecord } from './components/AgentStatsPanel'
import { createSimulator } from './simulator'
import { useBridge } from './hooks/useBridge'
import { useSound } from './hooks/useSound'
import { useKeyboard } from './hooks/useKeyboard'
import { SessionStats } from './components/SessionStats'
import { ResidentDirectory } from './components/ResidentDirectory'
import { AchievementBanner } from './components/AchievementBanner'
import { LandingPage } from './components/LandingPage'
import type { AgentState, BuildingState, AgentEvent, ActivityType, Trail } from './types'

const AGENT_COLORS = [
  '#60a5fa', '#f97316', '#22c55e', '#a855f7',
  '#eab308', '#ec4899', '#14b8a6', '#f43f5e',
  '#818cf8', '#fb923c', '#34d399', '#c084fc',
];

const DEFAULT_BUILDINGS: BuildingState[] = [
  {
    id: 'campfire', name: 'Town Square', type: 'idle',
    position: { x: 0, y: 20 },
    color: '#78350f', glowColor: '#fb923c', icon: '🔥',
    activeAgents: [],
    level: 1, title: 'Campsite', xp: 0, nextLevelXP: 100,
  },
  {
    id: 'guild', name: 'Architect Guild', type: 'planning',
    position: { x: -200, y: -120 },
    color: '#1e3a5f', glowColor: '#3b82f6', icon: '📐',
    activeAgents: [],
    level: 1, title: 'Outpost', xp: 0, nextLevelXP: 100,
  },
  {
    id: 'forge', name: 'The Forge', type: 'coding',
    position: { x: 200, y: -80 },
    color: '#7c2d12', glowColor: '#f97316', icon: '⚒️',
    activeAgents: [],
    level: 1, title: 'Outpost', xp: 0, nextLevelXP: 100,
  },
  {
    id: 'arena', name: 'The Arena', type: 'testing',
    position: { x: 0, y: -220 },
    color: '#14532d', glowColor: '#22c55e', icon: '⚔️',
    activeAgents: [],
    level: 1, title: 'Outpost', xp: 0, nextLevelXP: 100,
  },
  {
    id: 'library', name: 'The Library', type: 'researching',
    position: { x: -200, y: 130 },
    color: '#3b0764', glowColor: '#a855f7', icon: '📚',
    activeAgents: [],
    level: 1, title: 'Outpost', xp: 0, nextLevelXP: 100,
  },
  {
    id: 'tower', name: 'Watchtower', type: 'reviewing',
    position: { x: 200, y: 160 },
    color: '#713f12', glowColor: '#eab308', icon: '🔭',
    activeAgents: [],
    level: 1, title: 'Outpost', xp: 0, nextLevelXP: 100,
  },
  {
    id: 'tavern', name: 'The Tavern', type: 'idle',
    position: { x: 100, y: 80 },
    color: '#5c3a1e', glowColor: '#d4a558', icon: '🍺',
    activeAgents: [],
    level: 1, title: 'Campsite', xp: 0, nextLevelXP: 100,
  },
];

const ACTIVITY_BUILDING: Record<ActivityType, string> = {
  planning: 'guild',
  coding: 'forge',
  testing: 'arena',
  researching: 'library',
  reviewing: 'tower',
  idle: 'campfire',
};

const ACTIVITY_ICONS: Record<string, string> = {
  planning: '🧠', coding: '⚡', testing: '🧪',
  researching: '📖', reviewing: '👁', idle: '💤',
};

const TRAIL_LIFETIME = 8000;

let colorIndex = 0;
let trailCounter = 0;

export default function App() {
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map());
  const [buildings, setBuildings] = useState<BuildingState[]>(DEFAULT_BUILDINGS);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [mode, setMode] = useState<'live' | 'demo'>('live');
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activityHistory, setActivityHistory] = useState<Map<string, ActivityRecord[]>>(new Map());
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [achievements, setAchievements] = useState<Array<{
    id: number;
    agentName: string;
    message: string;
    timestamp: number;
  }>>([]);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  // Sound system
  const sound = useSound();

  // Keyboard shortcuts
  const switchModeRef = useRef<() => void>(() => {});

  useKeyboard(useMemo(() => ({
    toggleSound: sound.toggle,
    toggleTimeline: () => setTimelineVisible(v => !v),
    toggleMode: () => switchModeRef.current(),
  }), [sound.toggle]));

  // Clean up expired trails
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTrails(prev => prev.filter(t => now - t.createdAt < TRAIL_LIFETIME));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Idle wandering: offline main agents randomly wander between campfire and tavern
  useEffect(() => {
    const getPos = (id: string) => DEFAULT_BUILDINGS.find(b => b.id === id)?.position || { x: 0, y: 20 };
    const interval = setInterval(() => {
      setAgents(prev => {
        const next = new Map(prev);
        let changed = false;
        for (const [id, agent] of next) {
          if (!agent.offline || agent.isSubAgent) continue;
          if (agent.targetBuilding !== 'campfire' && agent.targetBuilding !== 'tavern') continue;
          if (Math.random() > 0.08) continue; // ~8% chance per tick
          const dest = agent.targetBuilding === 'campfire' ? 'tavern' : 'campfire';
          setTrails(t => [...t, {
            id: `wander-${trailCounter++}`,
            fromPos: getPos(agent.targetBuilding!),
            toPos: getPos(dest),
            color: agent.color + '66',
            createdAt: Date.now(),
          }]);
          next.set(id, { ...agent, previousBuilding: agent.targetBuilding, targetBuilding: dest });
          changed = true;
        }
        return changed ? next : prev;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-cleanup expired achievements
  useEffect(() => {
    if (achievements.length === 0) return;
    const timer = setTimeout(() => {
      setAchievements(prev => prev.filter(a => Date.now() - a.timestamp < 6000));
    }, 6500);
    return () => clearTimeout(timer);
  }, [achievements]);

  const getBuildingPosition = useCallback((buildingId: string) => {
    const building = DEFAULT_BUILDINGS.find(b => b.id === buildingId);
    return building?.position || { x: 0, y: 20 };
  }, []);

  const handleEvent = useCallback((event: AgentEvent) => {
    setAgents(prev => {
      const next = new Map(prev);

      switch (event.type) {
        case 'agent:spawn': {
          const existing = next.get(event.agentId);
          if (existing && !existing.offline) break; // truly duplicate spawn, skip

          // Offline resident waking up — update in place
          if (existing?.offline && !event.offline) {
            next.set(event.agentId, {
              ...existing,
              role: event.agentRole || existing.role,
              project: event.project || existing.project,
              clan: event.clan || event.project || existing.clan,
              parentId: event.parentId,
              isSubAgent: !!event.parentId,
              totalInputBytes: event.totalInputBytes || existing.totalInputBytes,
              totalOutputBytes: event.totalOutputBytes || existing.totalOutputBytes,
              subAgentsSpawned: event.subAgentsSpawned || existing.subAgentsSpawned,
              level: event.level || existing.level,
              title: event.title || existing.title,
              xp: event.xp || existing.xp,
              nextLevelXP: event.nextLevelXP ?? existing.nextLevelXP,
              offline: false,
            });
            break;
          }

          const isSubAgent = !!event.parentId;
          const color = AGENT_COLORS[colorIndex % AGENT_COLORS.length];
          colorIndex++;
          next.set(event.agentId, {
            id: event.agentId,
            name: event.agentName || event.agentId,
            role: event.agentRole || '',
            color,
            position: { x: 0, y: 20 },
            targetBuilding: 'campfire',
            previousBuilding: null,
            activity: 'idle',
            previousActivity: undefined,
            status: 'idle',
            detail: '',
            project: event.project,
            clan: event.clan || event.project,
            parentId: event.parentId,
            isSubAgent,
            offline: event.offline,
            totalInputBytes: event.totalInputBytes || 0,
            totalOutputBytes: event.totalOutputBytes || 0,
            subAgentsSpawned: event.subAgentsSpawned || 0,
            spawnedAt: Date.now(),
            level: event.level || 1,
            title: event.title || 'Apprentice',
            xp: event.xp || 0,
            nextLevelXP: event.nextLevelXP ?? null,
          });
          // Restore historical activity from store
          if (event.recentActivity && event.recentActivity.length > 0) {
            setActivityHistory(prev => {
              const hist = new Map(prev);
              const records: ActivityRecord[] = event.recentActivity!.map(r => ({
                activity: r.activity as ActivityType,
                detail: r.detail,
                timestamp: r.timestamp,
              }));
              hist.set(event.agentId, records);
              return hist;
            });
          }
          if (!event.offline) {
            const label = isSubAgent ? '⛏' : '⬆';
            setEventLog(l => [`${label} ${event.agentName || event.agentId} spawned`, ...l].slice(0, 30));
            sound.playSpawn();
          }
          break;
        }

        case 'agent:work': {
          const agent = next.get(event.agentId);
          if (agent && event.activity) {
            const buildingId = event.targetBuilding || ACTIVITY_BUILDING[event.activity];
            const previousBuilding = agent.targetBuilding;

            // Create trail when agent moves between buildings
            if (previousBuilding && buildingId && previousBuilding !== buildingId) {
              const fromPos = getBuildingPosition(previousBuilding);
              const toPos = getBuildingPosition(buildingId);
              setTrails(prev => [
                ...prev,
                {
                  id: `trail-${trailCounter++}`,
                  fromPos,
                  toPos,
                  color: agent.color,
                  createdAt: Date.now(),
                },
              ]);
              sound.playMove();
            }

            // Track activity history for stats panel
            if (event.activity !== 'idle') {
              const record: ActivityRecord = {
                activity: event.activity,
                detail: event.detail || '',
                timestamp: Date.now(),
              };
              setActivityHistory(prev => {
                const hist = new Map(prev);
                const existing = hist.get(event.agentId) || [];
                hist.set(event.agentId, [...existing, record].slice(-50));
                return hist;
              });

              // Add timeline entry
              setTimelineEntries(prev => [
                ...prev,
                {
                  agentId: event.agentId,
                  agentName: agent.name,
                  agentColor: agent.color,
                  activity: event.activity!,
                  detail: event.detail || '',
                  timestamp: Date.now(),
                },
              ].slice(-200));
            }

            next.set(event.agentId, {
              ...agent,
              activity: event.activity,
              previousActivity: agent.activity,
              targetBuilding: buildingId,
              previousBuilding,
              status: event.activity === 'idle' ? 'idle' : 'working',
              detail: event.detail || agent.detail,
              // Clear waiting when agent resumes real work
              waiting: event.activity !== 'idle' ? false : agent.waiting,
            });
            if (event.activity !== 'idle') {
              const icon = ACTIVITY_ICONS[event.activity] || '⚡';
              const detailStr = event.detail ? ` (${event.detail})` : '';
              setEventLog(l => [`${icon} ${agent.name} → ${event.activity}${detailStr}`, ...l].slice(0, 30));
            }
          }
          break;
        }

        case 'agent:move': {
          const agent = next.get(event.agentId);
          if (agent && event.targetBuilding) {
            next.set(event.agentId, {
              ...agent,
              targetBuilding: event.targetBuilding,
              previousBuilding: agent.targetBuilding,
              status: 'moving',
            });
          }
          break;
        }

        case 'agent:tokens': {
          const agent = next.get(event.agentId);
          if (agent) {
            next.set(event.agentId, {
              ...agent,
              totalInputBytes: event.totalInputBytes || agent.totalInputBytes,
              totalOutputBytes: event.totalOutputBytes || agent.totalOutputBytes,
            });
          }
          break;
        }

        case 'agent:xp':
        case 'agent:levelup': {
          const agent = next.get(event.agentId);
          if (agent) {
            const leveledUp = event.level && event.level > agent.level;
            next.set(event.agentId, {
              ...agent,
              level: event.level || agent.level,
              title: event.title || agent.title,
              xp: event.xp ?? agent.xp,
              nextLevelXP: event.nextLevelXP ?? agent.nextLevelXP,
            });
            if (leveledUp) {
              setEventLog(l => [`🎉 ${agent.name} → Lv.${event.level} ${event.title}`, ...l].slice(0, 30));
            }
          }
          break;
        }

        case 'agent:waiting': {
          const agent = next.get(event.agentId);
          if (agent) {
            next.set(event.agentId, {
              ...agent,
              waiting: !!event.waiting,
            });
            if (event.waiting) {
              setEventLog(l => [`⏳ ${agent.name} awaits orders!`, ...l].slice(0, 30));
            }
          }
          break;
        }

        case 'agent:achievement': {
          if (event.achievement) {
            setAchievements(prev => [
              ...prev,
              {
                id: Date.now(),
                agentName: event.agentName || event.agentId,
                message: event.achievement!,
                timestamp: Date.now(),
              },
            ]);
            setEventLog(l => [`🏆 ${event.achievement}`, ...l].slice(0, 30));
            sound.playAchievement();
          }
          break;
        }

        case 'agent:failure': {
          const agent = next.get(event.agentId);
          if (agent) {
            next.set(event.agentId, {
              ...agent,
              failure: event.detail || 'Something went wrong',
            });
            setEventLog(l => [`💥 ${agent.name}: ${event.detail || 'tool failed'}`, ...l].slice(0, 30));
            // Auto-clear failure after 4s
            setTimeout(() => {
              setAgents(prev => {
                const a = prev.get(event.agentId);
                if (a?.failure) {
                  const updated = new Map(prev);
                  updated.set(event.agentId, { ...a, failure: undefined });
                  return updated;
                }
                return prev;
              });
            }, 4000);
          }
          break;
        }

        case 'building:xp':
        case 'building:state':
          // Handled outside setAgents below
          break;

        case 'agent:complete':
        case 'agent:despawn': {
          const agent = next.get(event.agentId);
          if (agent) {
            if (agent.isSubAgent) {
              setEventLog(l => [`⛏ ${agent.name} left`, ...l].slice(0, 30));
              sound.playDespawn();
            } else {
              setEventLog(l => [`🔥 ${agent.name} rests by the fire`, ...l].slice(0, 30));
            }
            // Both main agents and sub-agents become offline residents
            next.set(event.agentId, {
              ...agent,
              activity: 'idle',
              previousActivity: agent.activity,
              status: 'idle',
              targetBuilding: 'campfire',
              previousBuilding: agent.targetBuilding,
              detail: '',
              waiting: false,
              offline: true,
            });
          }
          setSelectedAgentId(prev => prev === event.agentId ? null : prev);
          break;
        }
      }

      return next;
    });

    // Handle building events (outside setAgents since they affect buildings state)
    if (event.type === 'building:xp' || event.type === 'building:state') {
      if (event.buildingId) {
        setBuildings(prev => {
          const prevBuilding = prev.find(b => b.id === event.buildingId);
          // Detect level-up before updating
          if (event.type === 'building:xp' && event.level && prevBuilding && event.level > prevBuilding.level) {
            setEventLog(l => [
              `🏰 ${prevBuilding.name} → Lv.${event.level} ${event.title}`,
              ...l,
            ].slice(0, 30));
            sound.playAchievement();
          }
          return prev.map(b =>
            b.id === event.buildingId
              ? {
                  ...b,
                  level: event.level ?? b.level,
                  title: event.title ?? b.title,
                  xp: event.xp ?? b.xp,
                  nextLevelXP: event.nextLevelXP ?? b.nextLevelXP,
                  toolCalls: event.toolCalls ?? b.toolCalls,
                  uniqueVisitors: event.uniqueVisitors ?? b.uniqueVisitors,
                }
              : b,
          );
        });
      }
    }
  }, [getBuildingPosition, sound]);

  // Bridge connection (live mode)
  const { connected, everConnected } = useBridge(handleEvent, mode === 'live');

  // Clear agents when switching modes
  const switchMode = useCallback((newMode: 'live' | 'demo') => {
    setAgents(new Map());
    setTrails([]);
    setEventLog([]);
    setTimelineEntries([]);
    setActivityHistory(new Map());
    setSelectedAgentId(null);
    colorIndex = 0;
    trailCounter = 0;
    setMode(newMode);
  }, []);

  switchModeRef.current = () => switchMode(mode === 'live' ? 'demo' : 'live');

  // Update building active states
  useEffect(() => {
    setBuildings(prev =>
      prev.map(building => ({
        ...building,
        activeAgents: Array.from(agents.values())
          .filter(a => a.targetBuilding === building.id && a.status === 'working')
          .map(a => a.id),
      })),
    );
  }, [agents]);

  // Simulator (demo mode only)
  useEffect(() => {
    if (mode !== 'demo') return;
    const sim = createSimulator(handleEvent);
    sim.start();
    return () => sim.stop();
  }, [mode, handleEvent]);

  const isLive = mode === 'live';

  // Compute agent counts for header and day/night cycle
  const { activeAgentCount, residentCount, subAgentCount } = useMemo(() => {
    let active = 0, residents = 0, subs = 0;
    for (const a of agents.values()) {
      if (a.status === 'working') active++;
      if (a.isSubAgent) subs++; else residents++;
    }
    return { activeAgentCount: active, residentCount: residents, subAgentCount: subs };
  }, [agents]);

  // Compute total bytes across all agents
  const { totalInputBytes, totalOutputBytes } = useMemo(() => {
    let inB = 0, outB = 0;
    for (const a of agents.values()) {
      inB += a.totalInputBytes;
      outB += a.totalOutputBytes;
    }
    return { totalInputBytes: inB, totalOutputBytes: outB };
  }, [agents]);

  // Selected agent for stats panel
  const selectedAgent = selectedAgentId ? agents.get(selectedAgentId) || null : null;
  const selectedHistory = selectedAgentId ? activityHistory.get(selectedAgentId) || [] : [];

  // Show landing page when bridge has never connected in live mode
  if (mode === 'live' && !everConnected) {
    return <LandingPage connected={connected} onDemo={() => switchMode('demo')} />;
  }

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#0a0a1a' }}>
      {/* Header */}
      <div className="absolute top-5 left-6 z-20">
        <h1 className="text-xl font-bold text-white/70 tracking-wider">
          AgentVille
        </h1>
        <p className="text-[11px] text-white/30 mt-0.5">
          {activeAgentCount} working · {residentCount} resident{residentCount !== 1 ? 's' : ''}{subAgentCount > 0 ? ` · ${subAgentCount} child${subAgentCount !== 1 ? 'ren' : ''}` : ''}
        </p>
      </div>

      {/* Session stats */}
      <SessionStats agentCount={agents.size} totalEvents={timelineEntries.length} totalInputBytes={totalInputBytes} totalOutputBytes={totalOutputBytes} />

      {/* Controls */}
      <div className="absolute top-5 right-6 z-20 flex items-center gap-3">
        {/* Sound toggle */}
        <button
          onClick={sound.toggle}
          className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
          title="Toggle sound (M)"
        >
          {sound.enabled ? '🔊' : '🔇'}
        </button>

        {/* Timeline toggle */}
        <button
          onClick={() => setTimelineVisible(v => !v)}
          className={`text-[10px] transition-colors ${
            timelineVisible ? 'text-amber-400/60' : 'text-white/30 hover:text-white/50'
          }`}
          title="Toggle timeline (T)"
        >
          📊
        </button>

        {/* Connection indicator */}
        {isLive && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: connected ? '#22c55e' : '#ef4444',
                boxShadow: connected ? '0 0 6px #22c55e88' : '0 0 6px #ef444488',
              }}
            />
            <span className="text-[10px] text-white/40">
              {connected ? 'Bridge connected' : 'Bridge offline'}
            </span>
          </div>
        )}

        {/* Toggle buttons */}
        <div className="flex rounded-full overflow-hidden border border-white/10">
          <button
            onClick={() => switchMode('live')}
            className={`px-3 py-1 text-[10px] font-medium transition-colors ${
              isLive
                ? 'bg-emerald-500/20 text-emerald-400 border-r border-white/10'
                : 'bg-transparent text-white/30 border-r border-white/10 hover:text-white/50'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => switchMode('demo')}
            className={`px-3 py-1 text-[10px] font-medium transition-colors ${
              !isLive
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-transparent text-white/30 hover:text-white/50'
            }`}
          >
            Demo
          </button>
        </div>

        {/* Directory button */}
        <button
          onClick={() => setDirectoryOpen(true)}
          className="px-3 py-1 text-[10px] font-medium rounded-full border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 transition-colors cursor-pointer"
        >
          Residents
        </button>
      </div>

      {/* Event log */}
      <div className="absolute left-6 z-20 max-w-xs" style={{ bottom: timelineVisible ? 90 : 20 }}>
        <div className="text-[10px] text-white/20 mb-1 font-medium uppercase tracking-wider">
          Activity
        </div>
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {eventLog.slice(0, 15).map((msg, i) => (
            <div
              key={`${msg}-${i}`}
              className="text-[10px] text-white/30 transition-opacity"
              style={{ opacity: 1 - i * 0.05 }}
            >
              {msg}
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="absolute right-6 z-20 text-right" style={{ bottom: timelineVisible ? 90 : 20 }}>
        {isLive && agents.size === 0 && !connected ? (
          <div className="text-[10px] text-white/20 leading-relaxed">
            <p className="text-white/30 font-medium mb-1">Waiting for agents...</p>
            <p>Start the bridge: <span className="text-emerald-400/60 font-mono">npm run bridge</span></p>
          </div>
        ) : (
          <div className="text-[9px] text-white/15 space-y-0.5">
            <div><span className="text-white/25 font-mono">D</span> mode <span className="text-white/25 font-mono">T</span> timeline <span className="text-white/25 font-mono">M</span> sound</div>
          </div>
        )}
      </div>

      {/* Village */}
      <Village
        agents={agents}
        buildings={buildings}
        trails={trails}
        agentCount={agents.size}
        activeAgentCount={activeAgentCount}
        onAgentClick={setSelectedAgentId}
      />

      {/* Achievement Banners */}
      <AchievementBanner achievements={achievements} />

      {/* Activity Timeline */}
      <ActivityTimeline entries={timelineEntries} visible={timelineVisible} />

      {/* Agent Stats Panel */}
      <AgentStatsPanel
        agent={selectedAgent}
        activityHistory={selectedHistory}
        onClose={() => setSelectedAgentId(null)}
      />

      {/* Resident Directory */}
      <ResidentDirectory
        open={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        bridgeUrl={mode === 'live' ? (import.meta.env.VITE_BRIDGE_URL || 'http://localhost:4242') : ''}
      />
    </div>
  );
}
