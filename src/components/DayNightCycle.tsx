import { motion } from 'framer-motion'

interface DayNightCycleProps {
  agentCount?: number
  activeAgentCount: number
}

type TimeOfDay = 'night' | 'dusk' | 'afternoon' | 'day'

const skyGradients: Record<TimeOfDay, string> = {
  night: 'radial-gradient(ellipse at center, rgba(5,5,20,0.3) 0%, rgba(0,0,10,0.6) 100%)',
  dusk: 'radial-gradient(ellipse at center, rgba(20,20,50,0.15) 0%, rgba(10,10,30,0.4) 100%)',
  afternoon: 'radial-gradient(ellipse at center, rgba(40,40,80,0.08) 0%, rgba(20,20,50,0.25) 100%)',
  day: 'radial-gradient(ellipse at center, rgba(60,60,100,0.05) 0%, rgba(30,30,60,0.15) 100%)',
}

const warmGlowOpacity: Record<TimeOfDay, number> = {
  night: 0,
  dusk: 0,
  afternoon: 0.03,
  day: 0.06,
}

// Deterministic star positions based on index
const stars = Array.from({ length: 20 }, (_, i) => ({
  left: `${((i * 37 + 13) % 97)}%`,
  top: `${((i * 53 + 7) % 91)}%`,
  size: 1 + (i % 2),
  delay: (i * 0.3) % 4,
}))

function getTimeOfDay(activeAgentCount: number): TimeOfDay {
  if (activeAgentCount >= 5) return 'day'
  if (activeAgentCount >= 3) return 'afternoon'
  if (activeAgentCount >= 1) return 'dusk'
  return 'night'
}

export function DayNightCycle({ activeAgentCount }: DayNightCycleProps) {
  const time = getTimeOfDay(activeAgentCount)
  const isNight = time === 'night'

  return (
    <>
      {/* Sky gradient overlay */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
        animate={{ background: skyGradients[time] }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />

      {/* Stars layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        {stars.map((star, i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              borderRadius: '50%',
              backgroundColor: 'white',
            }}
            animate={{
              opacity: isNight ? [0, 0.6, 0] : 0,
            }}
            transition={
              isNight
                ? {
                    duration: 3,
                    repeat: Infinity,
                    delay: star.delay,
                    ease: 'easeInOut',
                  }
                : { duration: 2, ease: 'easeInOut' }
            }
          />
        ))}
      </div>

      {/* Warm glow */}
      <motion.div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 800,
          height: 800,
          marginLeft: -400,
          marginTop: -400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,200,100,1) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
        animate={{ opacity: warmGlowOpacity[time] }}
        transition={{ duration: 2.5, ease: 'easeInOut' }}
      />
    </>
  )
}
