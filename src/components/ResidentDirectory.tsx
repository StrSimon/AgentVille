import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getClanColor } from '../types'

interface ResidentProfile {
  agentId: string;
  name: string;
  clan: string | null;
  toolCalls: number;
  totalInputBytes: number;
  totalOutputBytes: number;
  sessions: number;
  subAgentsSpawned: number;
  parentId: string | null;
  firstSeen: number;
  lastSeen: number;
  xp: number;
  level: number;
  title: string;
  nextLevelXP: number | null;
}

interface ResidentDirectoryProps {
  open: boolean;
  onClose: () => void;
  bridgeUrl: string;
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#9ca3af', 2: '#60a5fa', 3: '#34d399', 4: '#f97316',
  5: '#eab308', 6: '#a855f7', 7: '#ec4899', 8: '#f43f5e',
  9: '#14b8a6', 10: '#fbbf24',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function estimateTokens(bytes: number): string {
  const tokens = Math.round(bytes / 4)
  if (tokens < 1000) return `~${tokens}`
  if (tokens < 1_000_000) return `~${(tokens / 1000).toFixed(1)}k`
  return `~${(tokens / 1_000_000).toFixed(1)}M`
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface ClanStats {
  name: string;
  color: string;
  members: number;
  totalXP: number;
  totalToolCalls: number;
  totalBytes: number;
  avgLevel: number;
  maxLevel: number;
}

function computeClanStats(residents: ResidentProfile[]): ClanStats[] {
  const clanMap = new Map<string, ResidentProfile[]>()
  for (const r of residents) {
    const clan = r.clan || 'Clanless'
    const list = clanMap.get(clan) || []
    list.push(r)
    clanMap.set(clan, list)
  }

  return Array.from(clanMap.entries())
    .map(([name, members]) => {
      const totalXP = members.reduce((s, m) => s + m.xp, 0)
      const totalToolCalls = members.reduce((s, m) => s + m.toolCalls, 0)
      const totalBytes = members.reduce((s, m) => s + m.totalInputBytes + m.totalOutputBytes, 0)
      const levels = members.map(m => m.level)
      return {
        name,
        color: name === 'Clanless' ? '#555' : getClanColor(name),
        members: members.length,
        totalXP,
        totalToolCalls,
        totalBytes,
        avgLevel: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length * 10) / 10,
        maxLevel: Math.max(...levels),
      }
    })
    .sort((a, b) => b.totalXP - a.totalXP)
}

export function ResidentDirectory({ open, onClose, bridgeUrl }: ResidentDirectoryProps) {
  const [residents, setResidents] = useState<ResidentProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedClan, setSelectedClan] = useState<string | null>(null) // null = all

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`${bridgeUrl}/api/leaderboard`)
      .then(r => r.json())
      .then(data => {
        setResidents(data.leaderboard || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [open, bridgeUrl])

  // Reset filter when closing
  useEffect(() => {
    if (!open) setSelectedClan(null)
  }, [open])

  const clanStats = useMemo(() => computeClanStats(residents), [residents])

  // Filter residents by selected clan
  const filteredResidents = useMemo(() => {
    if (!selectedClan) return residents
    return residents.filter(r => (r.clan || 'Clanless') === selectedClan)
  }, [residents, selectedClan])

  // Build parent→children map from filtered residents
  const childrenMap = new Map<string, ResidentProfile[]>()
  const rootResidents: ResidentProfile[] = []
  const filteredIds = new Set(filteredResidents.map(r => r.agentId))
  for (const r of filteredResidents) {
    if (r.parentId && filteredIds.has(r.parentId)) {
      const existing = childrenMap.get(r.parentId) || []
      existing.push(r)
      childrenMap.set(r.parentId, existing)
    } else {
      rootResidents.push(r)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="relative w-[580px] max-h-[85vh] overflow-y-auto rounded-xl"
            style={{
              background: 'rgba(10,10,30,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'tween', duration: 0.2 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 px-5 py-4"
              style={{ background: 'rgba(10,10,30,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-bold text-white/80">Resident Directory</h2>
                  <span className="text-[10px] text-white/30">
                    {residents.length} resident{residents.length !== 1 ? 's' : ''} in {clanStats.length} clan{clanStats.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/30 hover:text-white/60 text-sm cursor-pointer px-2 py-1"
                >
                  x
                </button>
              </div>

              {/* Clan filter pills */}
              {!loading && clanStats.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  <button
                    className="text-[9px] px-2.5 py-1 rounded-full cursor-pointer transition-all duration-150"
                    style={{
                      background: selectedClan === null ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                      color: selectedClan === null ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)',
                      border: `1px solid ${selectedClan === null ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                    onClick={() => setSelectedClan(null)}
                  >
                    All Clans
                  </button>
                  {clanStats.map(clan => (
                    <button
                      key={clan.name}
                      className="text-[9px] px-2.5 py-1 rounded-full cursor-pointer transition-all duration-150 flex items-center gap-1.5"
                      style={{
                        background: selectedClan === clan.name ? `${clan.color}25` : 'rgba(255,255,255,0.04)',
                        color: selectedClan === clan.name ? clan.color : 'rgba(255,255,255,0.35)',
                        border: `1px solid ${selectedClan === clan.name ? `${clan.color}44` : 'rgba(255,255,255,0.06)'}`,
                      }}
                      onClick={() => setSelectedClan(selectedClan === clan.name ? null : clan.name)}
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: clan.color }}
                      />
                      {clan.name}
                      <span style={{ opacity: 0.5 }}>{clan.members}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              {loading && (
                <div className="text-center text-white/30 text-[11px] py-8">Loading residents...</div>
              )}

              {!loading && residents.length === 0 && (
                <div className="text-center text-white/30 text-[11px] py-8">
                  No residents registered yet.
                </div>
              )}

              {/* Clan summary card when a specific clan is selected */}
              {!loading && selectedClan && (() => {
                const clan = clanStats.find(c => c.name === selectedClan)
                if (!clan) return null
                return <ClanBanner clan={clan} />
              })()}

              {/* Grouped by clan view (when "All" is selected) */}
              {!loading && !selectedClan && clanStats.length > 1 && (
                <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(clanStats.length, 3)}, 1fr)` }}>
                  {clanStats.map(clan => (
                    <button
                      key={clan.name}
                      className="rounded-lg p-3 text-left cursor-pointer transition-all duration-150 hover:scale-[1.02]"
                      style={{
                        background: `${clan.color}08`,
                        border: `1px solid ${clan.color}22`,
                      }}
                      onClick={() => setSelectedClan(clan.name)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{
                            background: `linear-gradient(135deg, ${clan.color}, ${clan.color}88)`,
                            boxShadow: `0 0 6px ${clan.color}33`,
                          }}
                        />
                        <span className="text-[11px] font-bold" style={{ color: clan.color }}>
                          {clan.name}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between">
                          <span className="text-[8px] text-white/25">Members</span>
                          <span className="text-[9px] text-white/50 font-mono">{clan.members}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[8px] text-white/25">Total XP</span>
                          <span className="text-[9px] font-mono" style={{ color: `${clan.color}aa` }}>
                            {clan.totalXP.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[8px] text-white/25">Top Level</span>
                          <span className="text-[9px] text-white/50 font-mono">Lv.{clan.maxLevel}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Resident list */}
              {!loading && rootResidents.map(resident => (
                <ResidentCard
                  key={resident.agentId}
                  resident={resident}
                  children={childrenMap.get(resident.agentId) || []}
                  allResidents={filteredResidents}
                  childrenMap={childrenMap}
                  showClan={!selectedClan}
                />
              ))}

              {/* Orphan sub-agents (parent not in filtered set) */}
              {!loading && filteredResidents
                .filter(r => r.parentId && !filteredIds.has(r.parentId) && !rootResidents.includes(r))
                .map(resident => (
                  <ResidentCard
                    key={resident.agentId}
                    resident={resident}
                    children={childrenMap.get(resident.agentId) || []}
                    allResidents={filteredResidents}
                    childrenMap={childrenMap}
                    orphan
                    showClan={!selectedClan}
                  />
                ))
              }
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ClanBanner({ clan }: { clan: ClanStats }) {
  return (
    <motion.div
      className="rounded-lg p-4 mb-4"
      style={{
        background: `linear-gradient(135deg, ${clan.color}12, ${clan.color}06)`,
        border: `1px solid ${clan.color}30`,
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-3 mb-3">
        {/* Clan emblem */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] font-black"
          style={{
            background: `linear-gradient(135deg, ${clan.color}44, ${clan.color}22)`,
            border: `2px solid ${clan.color}55`,
            boxShadow: `0 0 12px ${clan.color}22`,
            color: clan.color,
          }}
        >
          {clan.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="text-[13px] font-bold" style={{ color: clan.color }}>
            {clan.name}
          </h3>
          <span className="text-[9px] text-white/30">
            {clan.members} member{clan.members !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <ClanStatBox label="Total XP" value={clan.totalXP.toLocaleString()} color={clan.color} />
        <ClanStatBox label="Tool Calls" value={clan.totalToolCalls.toLocaleString()} color={clan.color} />
        <ClanStatBox label="Avg Level" value={String(clan.avgLevel)} color={clan.color} />
        <ClanStatBox label="Data" value={formatBytes(clan.totalBytes)} color={clan.color} />
      </div>
    </motion.div>
  )
}

function ClanStatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-mono font-bold" style={{ color: `${color}cc` }}>{value}</div>
      <div className="text-[7px] text-white/25 mt-0.5">{label}</div>
    </div>
  )
}

function ResidentCard({
  resident,
  children,
  allResidents,
  childrenMap,
  orphan,
  showClan,
  depth = 0,
}: {
  resident: ResidentProfile;
  children: ResidentProfile[];
  allResidents: ResidentProfile[];
  childrenMap: Map<string, ResidentProfile[]>;
  orphan?: boolean;
  showClan?: boolean;
  depth?: number;
}) {
  const color = LEVEL_COLORS[resident.level] || '#9ca3af'
  const totalBytes = resident.totalInputBytes + resident.totalOutputBytes
  const isSubAgent = !!resident.parentId
  const clanColor = resident.clan ? getClanColor(resident.clan) : null

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        className="rounded-lg p-3 mb-2"
        style={{
          background: `rgba(255,255,255,${depth > 0 ? 0.02 : 0.04})`,
          border: `1px solid ${color}22`,
        }}
      >
        {/* Top row: avatar + name + level + clan */}
        <div className="flex items-center gap-2.5">
          {/* Mini avatar */}
          <div
            className="rounded-full shrink-0"
            style={{
              width: isSubAgent ? 14 : 20,
              height: isSubAgent ? 14 : 20,
              background: `radial-gradient(circle at 35% 35%, ${color}, ${color}77)`,
              border: `2px solid ${color}88`,
              boxShadow: `0 0 8px ${color}33`,
            }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[13px]" style={{ color }}>
                {resident.name}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${color}22`, color, border: `1px solid ${color}33` }}
              >
                Lv.{resident.level} {resident.title}
              </span>
              {isSubAgent && (
                <span className="text-[8px] text-white/25">
                  {orphan ? '⛏ Sub-Agent' : '⛏'}
                </span>
              )}
              {/* Clan badge */}
              {showClan && resident.clan && clanColor && (
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1"
                  style={{
                    background: `${clanColor}15`,
                    color: `${clanColor}bb`,
                    border: `1px solid ${clanColor}25`,
                  }}
                >
                  <span
                    className="inline-block w-1 h-1 rounded-full"
                    style={{ background: clanColor }}
                  />
                  {resident.clan}
                </span>
              )}
            </div>

            {/* XP bar */}
            {resident.nextLevelXP && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: color,
                      width: `${Math.min(100, (resident.xp / resident.nextLevelXP) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[8px] text-white/25 shrink-0">
                  {resident.xp}/{resident.nextLevelXP} XP
                </span>
              </div>
            )}
            {!resident.nextLevelXP && (
              <div className="text-[8px] text-white/25 mt-0.5">{resident.xp} XP (max)</div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-2 flex-wrap">
          <MiniStat label="Tool Calls" value={String(resident.toolCalls)} />
          <MiniStat label="Sessions" value={String(resident.sessions)} />
          {totalBytes > 0 && (
            <MiniStat label="Tokens" value={estimateTokens(totalBytes)} />
          )}
          {totalBytes > 0 && (
            <MiniStat label="Data" value={formatBytes(totalBytes)} />
          )}
          {resident.subAgentsSpawned > 0 && (
            <MiniStat label="Sub-Agents" value={String(resident.subAgentsSpawned)} />
          )}
        </div>

        {/* Time info */}
        <div className="flex gap-3 mt-1.5 text-[8px] text-white/20">
          <span>First seen: {timeAgo(resident.firstSeen)}</span>
          <span>Last active: {timeAgo(resident.lastSeen)}</span>
        </div>
      </div>

      {/* Children */}
      {children.map(child => (
        <ResidentCard
          key={child.agentId}
          resident={child}
          children={childrenMap.get(child.agentId) || []}
          allResidents={allResidents}
          childrenMap={childrenMap}
          showClan={showClan}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[8px] text-white/25">{label}</span>
      <span className="text-[10px] text-white/50 font-mono">{value}</span>
    </div>
  )
}
