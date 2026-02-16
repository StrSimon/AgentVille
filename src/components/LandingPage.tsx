import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const GITHUB_URL = 'https://github.com/StrSimon/AgentVille'

const BUILDINGS = [
  { icon: '⚒️', name: 'Forge', desc: 'Coding', color: '#f97316' },
  { icon: '📐', name: 'Guild', desc: 'Planning', color: '#3b82f6' },
  { icon: '⚔️', name: 'Arena', desc: 'Testing', color: '#22c55e' },
  { icon: '📚', name: 'Library', desc: 'Research', color: '#a855f7' },
  { icon: '🔭', name: 'Tower', desc: 'Reviews', color: '#eab308' },
  { icon: '🔥', name: 'Campfire', desc: 'Town Square', color: '#fb923c' },
]

// Background scene positions (viewport %)
const BG_POSITIONS = [
  { x: 14, y: 20, color: '#3b82f6' },   // guild
  { x: 82, y: 18, color: '#f97316' },    // forge
  { x: 50, y: 8, color: '#22c55e' },     // arena
  { x: 10, y: 62, color: '#a855f7' },    // library
  { x: 88, y: 58, color: '#eab308' },    // tower
  { x: 50, y: 42, color: '#fb923c' },    // campfire
  { x: 65, y: 78, color: '#d4a558' },    // tavern
]

const AGENT_COLORS = [
  '#60a5fa', '#f97316', '#22c55e', '#a855f7',
  '#eab308', '#ec4899', '#14b8a6', '#f43f5e',
]

const THOUGHTS = ['⚡', '🧠', '📖', '🧪', '💡', '🔨', '📝', '🔍', '✨', '🐛', '⚒️', '📐']

const DWARF_NAMES = [
  'Thorin', 'Bruni', 'Gilda', 'Rurik', 'Helga',
  'Dvalin', 'Freya', 'Baldur', 'Astrid', 'Fenrir',
]

interface BgAgent {
  id: number
  x: number
  y: number
  color: string
  name: string
  thought: string | null
  spawnedAt: number
  lifetime: number
}

let bgIdCounter = 0

function BackgroundScene() {
  const [agents, setAgents] = useState<BgAgent[]>([])
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  const tick = useCallback(() => {
    setAgents(prev => {
      const now = Date.now()
      // Remove expired agents
      let next = prev.filter(a => now - a.spawnedAt < a.lifetime)

      // Spawn new agent (max 7)
      if (next.length < 7 && Math.random() < 0.45) {
        const pos = BG_POSITIONS[Math.floor(Math.random() * BG_POSITIONS.length)]
        next = [...next, {
          id: bgIdCounter++,
          x: pos.x + (Math.random() - 0.5) * 4,
          y: pos.y + (Math.random() - 0.5) * 4,
          color: AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)],
          name: DWARF_NAMES[Math.floor(Math.random() * DWARF_NAMES.length)],
          thought: null,
          spawnedAt: now,
          lifetime: 12000 + Math.random() * 16000,
        }]
      }

      // Move & update thoughts
      next = next.map(a => {
        const age = now - a.spawnedAt
        const updates: Partial<BgAgent> = {}

        // Move to new building (~20% chance per tick)
        if (Math.random() < 0.2) {
          const pos = BG_POSITIONS[Math.floor(Math.random() * BG_POSITIONS.length)]
          updates.x = pos.x + (Math.random() - 0.5) * 6
          updates.y = pos.y + (Math.random() - 0.5) * 6
        }

        // Thought bubbles
        if (!a.thought && Math.random() < 0.15 && age > 1000) {
          updates.thought = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)]
        } else if (a.thought && Math.random() < 0.4) {
          updates.thought = null
        }

        return Object.keys(updates).length > 0 ? { ...a, ...updates } : a
      })

      return next
    })
  }, [])

  useEffect(() => {
    // Quick initial population
    tick()
    const t1 = setTimeout(tick, 800)
    const t2 = setTimeout(tick, 1600)
    const interval = setInterval(tick, 2200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearInterval(interval)
    }
  }, [tick])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      {/* Building glow markers */}
      {BG_POSITIONS.map((pos, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: 40,
            height: 40,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${pos.color}12, transparent 70%)`,
          }}
        />
      ))}

      {/* Agents */}
      <AnimatePresence>
        {agents.map(agent => {
          const age = Date.now() - agent.spawnedAt
          const nearDeath = agent.lifetime - age < 3000
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: nearDeath ? 0.15 : 0.5, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ opacity: { duration: 1.5 }, scale: { duration: 0.8 } }}
              className="absolute"
              style={{
                left: `${agent.x}%`,
                top: `${agent.y}%`,
                transition: 'left 3s ease-in-out, top 3s ease-in-out',
              }}
            >
              {/* Name tag */}
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] font-medium"
                style={{ color: agent.color + '80' }}
              >
                {agent.name}
              </div>
              {/* Dot */}
              <div
                className="w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{
                  background: agent.color,
                  boxShadow: `0 0 10px ${agent.color}55, 0 0 4px ${agent.color}88`,
                }}
              />
              {/* Thought bubble */}
              <AnimatePresence>
                {agent.thought && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.3 }}
                    animate={{ opacity: 0.8, y: -14, scale: 1 }}
                    exit={{ opacity: 0, y: -18, scale: 0.3 }}
                    transition={{ duration: 0.4 }}
                    className="absolute left-0 -translate-x-1/2"
                    style={{ top: -12, fontSize: 10 }}
                  >
                    {agent.thought}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

interface LandingPageProps {
  connected: boolean
  onDemo: () => void
}

export function LandingPage({ connected, onDemo }: LandingPageProps) {
  const [dots, setDots] = useState('')

  // Animate the "checking..." dots
  useEffect(() => {
    if (connected) return
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [connected])

  return (
    <div className="w-full h-full overflow-y-auto" style={{ background: '#0a0a1a' }}>
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Ambient glow */}
      <div
        className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }}
      />

      {/* Background agents wuseling around */}
      <BackgroundScene />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-16 min-h-full flex flex-col">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-white/90 tracking-tight mb-3">
            <span className="mr-2">🏘</span>AgentVille
          </h1>
          <p className="text-lg text-white/40 max-w-md mx-auto leading-relaxed">
            Watch your AI agents build a village. Every tool call, every file edit — visualized as dwarves working in real time.
          </p>
        </motion.div>

        {/* Buildings preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex justify-center gap-4 mb-12 flex-wrap"
        >
          {BUILDINGS.map((b, i) => (
            <motion.div
              key={b.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-xl"
                style={{ background: b.color + '18', border: `1px solid ${b.color}30` }}
              >
                {b.icon}
              </div>
              <span className="text-[9px] text-white/25">{b.desc}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-12"
        >
          <AnimatePresence mode="wait">
            {connected ? (
              <motion.div
                key="connected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl p-5 text-center"
                style={{ background: '#22c55e10', border: '1px solid #22c55e30' }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px #22c55e88' }} />
                  <span className="text-sm font-medium text-emerald-400">Bridge connected!</span>
                </div>
                <p className="text-xs text-white/30">Loading dashboard...</p>
              </motion.div>
            ) : (
              <motion.div
                key="disconnected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl p-5 text-center"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full bg-amber-400/60"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-sm text-white/40">
                    Waiting for bridge{dots}
                  </span>
                </div>
                <p className="text-[11px] text-white/20 font-mono">
                  localhost:4242
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Setup Steps */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-12"
        >
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-5 text-center">
            Get Started
          </h2>
          <div className="space-y-4">
            <Step
              n={1}
              title="Clone & install"
              code={`git clone ${GITHUB_URL}.git\ncd AgentVille && npm install`}
            />
            <Step
              n={2}
              title="Start the bridge"
              code="npm run bridge"
            />
            <Step
              n={3}
              title="Connect all sessions globally"
              code="npm run connect:global"
              note="Every Claude Code session on your machine will appear in the village"
            />
            <Step
              n={4}
              title="Start coding!"
              note="Open Claude Code in any project — agents appear automatically"
              last
            />
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex justify-center gap-3 mb-12"
        >
          <button
            onClick={onDemo}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'rgba(251, 146, 60, 0.12)',
              border: '1px solid rgba(251, 146, 60, 0.25)',
              color: '#fb923c',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(251, 146, 60, 0.2)'
              e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(251, 146, 60, 0.12)'
              e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.25)'
            }}
          >
            Try Demo
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }}
          >
            GitHub
          </a>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="grid grid-cols-3 gap-3 mb-16"
        >
          <Feature icon="⚡" title="Real-time" desc="SSE-powered live updates" />
          <Feature icon="📊" title="Persistent" desc="XP & levels across sessions" />
          <Feature icon="🔒" title="Local" desc="All data stays on your machine" />
        </motion.div>

        {/* Footer */}
        <div className="mt-auto text-center pb-8">
          <p className="text-[10px] text-white/15">
            Zero dependencies bridge · Built with React + Framer Motion · Works with Claude Code
          </p>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, code, note, last }: {
  n: number; title: string; code?: string; note?: string; last?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
        >
          {n}
        </div>
        {!last && <div className="w-px flex-1 mt-2" style={{ background: 'rgba(255,255,255,0.06)' }} />}
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <p className="text-sm text-white/50 font-medium mb-1.5">{title}</p>
        {code && (
          <pre
            className="text-[12px] font-mono rounded-lg px-3 py-2 overflow-x-auto whitespace-pre"
            style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(139, 233, 253, 0.6)' }}
          >
            {code}
          </pre>
        )}
        {note && (
          <p className="text-[11px] text-white/20 mt-1.5">{note}</p>
        )}
      </div>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-[11px] font-medium text-white/40">{title}</div>
      <div className="text-[9px] text-white/20 mt-0.5">{desc}</div>
    </div>
  )
}
