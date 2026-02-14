import { motion, AnimatePresence } from 'framer-motion'
import { getClanColor } from '../types'
import type { AgentState, ActivityType } from '../types'

export interface ActivityRecord {
  activity: ActivityType;
  detail: string;
  timestamp: number;
}

interface AgentStatsPanelProps {
  agent: AgentState | null;
  activityHistory: ActivityRecord[];
  onClose: () => void;
}

const ACTIVITY_ICONS: Record<string, string> = {
  planning: '🧠', coding: '⚡', testing: '🧪',
  researching: '📖', reviewing: '👁', idle: '💤',
}

const ACTIVITY_COLORS: Record<string, string> = {
  planning: '#3b82f6', coding: '#f97316', testing: '#22c55e',
  researching: '#a855f7', reviewing: '#eab308',
}

const BUILDING_NAMES: Record<string, string> = {
  planning: 'Guild', coding: 'Forge', testing: 'Arena',
  researching: 'Library', reviewing: 'Watchtower', idle: 'Town Square',
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toTimeString().slice(0, 8)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function estimateTokens(bytes: number): string {
  // Rough estimate: ~4 chars per token
  const tokens = Math.round(bytes / 4)
  if (tokens < 1000) return `~${tokens}`
  if (tokens < 1_000_000) return `~${(tokens / 1000).toFixed(1)}k`
  return `~${(tokens / 1_000_000).toFixed(1)}M`
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '...' : s
}

export function AgentStatsPanel({ agent, activityHistory, onClose }: AgentStatsPanelProps) {
  // Build activity distribution
  const distribution = activityHistory.reduce<Record<string, number>>((acc, r) => {
    if (r.activity !== 'idle') {
      acc[r.activity] = (acc[r.activity] || 0) + 1
    }
    return acc
  }, {})
  const maxCount = Math.max(1, ...Object.values(distribution))
  const recent = activityHistory.slice(-8).reverse()

  return (
    <AnimatePresence>
      {agent && (
        <motion.div
          key="stats-panel"
          className="fixed top-0 right-0 h-full overflow-y-auto z-50"
          style={{
            width: 280,
            background: 'rgba(10,10,26,0.95)',
            backdropFilter: 'blur(12px)',
            borderLeft: `1px solid ${agent.color}4d`,
          }}
          initial={{ x: 280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 280, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.25 }}
        >
          <div className="p-4 flex flex-col gap-3">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-white/40 hover:text-white/60 text-sm cursor-pointer"
            >
              x
            </button>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-1 pt-2">
              <div
                className="rounded-full"
                style={{
                  width: 24, height: 24,
                  background: `radial-gradient(circle at 35% 35%, ${agent.color}, ${agent.color}77)`,
                  border: `2px solid ${agent.color}bb`,
                  boxShadow: `0 0 12px ${agent.color}44`,
                }}
              />
              <span className="font-bold text-[14px]" style={{ color: agent.color }}>
                {agent.name}
              </span>
              {/* Level badge */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: `${agent.color}22`,
                    color: agent.color,
                    border: `1px solid ${agent.color}33`,
                  }}
                >
                  Lv.{agent.level ?? 1} {agent.title || 'Apprentice'}
                </span>
              </div>
              {/* XP progress bar */}
              {agent.nextLevelXP && (
                <div className="w-full mt-1">
                  <div className="flex justify-between text-[8px] text-white/25 mb-0.5">
                    <span>{agent.xp} XP</span>
                    <span>{agent.nextLevelXP} XP</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: agent.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (agent.xp / agent.nextLevelXP) * 100)}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
              <span className="text-white/40 text-[10px] mt-1">{agent.role}</span>
              {agent.clan && (() => {
                const cc = getClanColor(agent.clan);
                return (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{ background: `${cc}20`, border: `1px solid ${cc}44`, color: cc }}
                  >
                    Clan {agent.clan}
                  </span>
                );
              })()}
              {agent.isSubAgent && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full mt-0.5"
                  style={{ background: `${agent.color}22`, color: agent.color, border: `1px solid ${agent.color}33` }}
                >
                  ⛏ Sub-Agent
                </span>
              )}
            </div>

            <div className="w-full h-px bg-white/10" />

            {/* Activity section */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Activity</div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/60 mb-3">
                <span>{ACTIVITY_ICONS[agent.activity] || '💤'}</span>
                <span>{agent.activity}</span>
                <span className="text-white/30">- {BUILDING_NAMES[agent.activity] || 'Town Square'}</span>
              </div>

              {/* Distribution bars */}
              <div className="flex flex-col gap-1.5">
                {Object.entries(distribution).map(([act, count]) => (
                  <div key={act} className="flex items-center gap-2">
                    <span className="text-[9px] text-white/40 w-16 text-right">{act}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: ACTIVITY_COLORS[act] || '#666' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxCount) * 100}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <span className="text-[9px] text-white/30 w-4">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full h-px bg-white/10" />

            {/* Token usage section */}
            {(agent.totalInputBytes > 0 || agent.totalOutputBytes > 0) && (
              <>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Token Usage</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[9px] text-white/30 mb-0.5">Input</div>
                      <div className="text-[13px] font-mono text-emerald-400/80">
                        {estimateTokens(agent.totalInputBytes)}
                      </div>
                      <div className="text-[8px] text-white/20">{formatBytes(agent.totalInputBytes)}</div>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[9px] text-white/30 mb-0.5">Output</div>
                      <div className="text-[13px] font-mono text-amber-400/80">
                        {estimateTokens(agent.totalOutputBytes)}
                      </div>
                      <div className="text-[8px] text-white/20">{formatBytes(agent.totalOutputBytes)}</div>
                    </div>
                  </div>
                  {agent.spawnedAt > 0 && (
                    <div className="mt-1.5 text-[9px] text-white/25 text-center">
                      {estimateTokens(agent.totalInputBytes + agent.totalOutputBytes)} total
                      {' '}
                      ({(() => {
                        const mins = Math.max(1, (Date.now() - agent.spawnedAt) / 60000)
                        const tokPerMin = Math.round((agent.totalInputBytes + agent.totalOutputBytes) / 4 / mins)
                        return `~${tokPerMin.toLocaleString()}/min`
                      })()})
                    </div>
                  )}
                </div>
                <div className="w-full h-px bg-white/10" />
              </>
            )}

            {/* Stats section */}
            {agent.subAgentsSpawned > 0 && (
              <>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Stats</div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg p-2 flex-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[9px] text-white/30 mb-0.5">Sub-Agents spawned</div>
                      <div className="text-[13px] font-mono text-cyan-400/80">
                        {agent.subAgentsSpawned}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-full h-px bg-white/10" />
              </>
            )}

            {/* Recent section */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Recent</div>
              <div className="flex flex-col gap-1">
                {recent.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[9px] text-white/40">
                    <span className="font-mono text-white/25 w-[52px] shrink-0">{formatTime(r.timestamp)}</span>
                    <span>{ACTIVITY_ICONS[r.activity] || '💤'}</span>
                    <span className="truncate">{truncate(r.detail, 20)}</span>
                  </div>
                ))}
                {recent.length === 0 && (
                  <span className="text-[9px] text-white/20">No activity yet</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
