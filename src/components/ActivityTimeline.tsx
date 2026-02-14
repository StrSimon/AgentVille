import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { ActivityType } from '../types'

export interface TimelineEntry {
  agentId: string
  agentName: string
  agentColor: string
  activity: ActivityType
  detail: string
  timestamp: number
}

interface ActivityTimelineProps {
  entries: TimelineEntry[]
  visible: boolean
}

const activityColors: Record<ActivityType, string> = {
  planning: '#3b82f6',
  coding: '#f97316',
  testing: '#22c55e',
  researching: '#a855f7',
  reviewing: '#eab308',
  idle: '#666',
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false })
}

export function ActivityTimeline({ entries, visible }: ActivityTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [entries.length])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50"
          style={{
            height: 80,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-1.5 pb-1">
            <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase">
              Timeline
            </span>
            <span className="text-[10px] text-white/40">
              {entries.length} events
            </span>
          </div>

          {/* Scrollable timeline */}
          <div
            ref={scrollRef}
            className="flex items-start gap-[3px] px-3 overflow-x-auto overflow-y-hidden pb-2"
            style={{ scrollBehavior: 'smooth' }}
          >
            {entries.map((entry, i) => (
              <div key={`${entry.timestamp}-${entry.agentId}-${i}`} className="flex flex-col items-center flex-shrink-0">
                {/* Time label every 20 entries */}
                {i % 20 === 0 ? (
                  <span className="text-[8px] text-white/30 mb-0.5 whitespace-nowrap">
                    {formatTime(entry.timestamp)}
                  </span>
                ) : (
                  <span className="text-[8px] mb-0.5 invisible">00:00</span>
                )}

                {/* Entry dot + activity line */}
                <div className="relative group cursor-pointer">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.agentColor }}
                  />
                  <div
                    className="w-[2px] h-4 mx-auto mt-[1px] rounded-full"
                    style={{ backgroundColor: activityColors[entry.activity] }}
                  />

                  {/* Hover tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block pointer-events-none whitespace-nowrap z-50">
                    <div
                      className="px-2 py-1.5 rounded text-[10px] leading-tight"
                      style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.12)' }}
                    >
                      <div className="font-medium" style={{ color: entry.agentColor }}>
                        {entry.agentName}
                      </div>
                      <div style={{ color: activityColors[entry.activity] }}>
                        {entry.activity}
                      </div>
                      <div className="text-white/50 max-w-[180px] truncate">
                        {entry.detail}
                      </div>
                      <div className="text-white/30">{formatTime(entry.timestamp)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
