import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ResidentProfile {
  agentId: string;
  name: string;
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

export function ResidentDirectory({ open, onClose, bridgeUrl }: ResidentDirectoryProps) {
  const [residents, setResidents] = useState<ResidentProfile[]>([])
  const [loading, setLoading] = useState(false)

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

  // Build parent→children map
  const childrenMap = new Map<string, ResidentProfile[]>()
  const rootResidents: ResidentProfile[] = []
  for (const r of residents) {
    if (r.parentId) {
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
            className="relative w-[520px] max-h-[80vh] overflow-y-auto rounded-xl"
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
            <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
              style={{ background: 'rgba(10,10,30,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div>
                <h2 className="text-[14px] font-bold text-white/80">Resident Directory</h2>
                <span className="text-[10px] text-white/30">{residents.length} resident{residents.length !== 1 ? 's' : ''} registered</span>
              </div>
              <button
                onClick={onClose}
                className="text-white/30 hover:text-white/60 text-sm cursor-pointer px-2 py-1"
              >
                x
              </button>
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

              {!loading && rootResidents.map(resident => (
                <ResidentCard
                  key={resident.agentId}
                  resident={resident}
                  children={childrenMap.get(resident.agentId) || []}
                  allResidents={residents}
                  childrenMap={childrenMap}
                />
              ))}

              {/* Orphan sub-agents (parent not in store) */}
              {!loading && residents
                .filter(r => r.parentId && !residents.some(p => p.agentId === r.parentId))
                .map(resident => (
                  <ResidentCard
                    key={resident.agentId}
                    resident={resident}
                    children={childrenMap.get(resident.agentId) || []}
                    allResidents={residents}
                    childrenMap={childrenMap}
                    orphan
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

function ResidentCard({
  resident,
  children,
  allResidents,
  childrenMap,
  orphan,
  depth = 0,
}: {
  resident: ResidentProfile;
  children: ResidentProfile[];
  allResidents: ResidentProfile[];
  childrenMap: Map<string, ResidentProfile[]>;
  orphan?: boolean;
  depth?: number;
}) {
  const color = LEVEL_COLORS[resident.level] || '#9ca3af'
  const totalBytes = resident.totalInputBytes + resident.totalOutputBytes
  const isSubAgent = !!resident.parentId

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        className="rounded-lg p-3 mb-2"
        style={{
          background: `rgba(255,255,255,${depth > 0 ? 0.02 : 0.04})`,
          border: `1px solid ${color}22`,
        }}
      >
        {/* Top row: avatar + name + level */}
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
            <div className="flex items-center gap-2">
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
