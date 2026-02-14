import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BuildingState, AgentState } from '../types'

interface BuildingProps {
  building: BuildingState;
  centerX: number;
  centerY: number;
  /** Agents currently working in this building (for tooltip) */
  agentsInside?: AgentState[];
}

export function Building({ building, centerX, centerY, agentsInside = [] }: BuildingProps) {
  const isActive = building.activeAgents.length > 0;
  const intensity = Math.min(building.activeAgents.length, 5);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{
        left: centerX + building.position.x,
        top: centerY + building.position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Building body */}
      <motion.div
        className="relative"
        animate={{
          scale: isActive ? [1, 1.03, 1] : 1,
        }}
        transition={{
          duration: 2.5,
          repeat: isActive ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Outer glow when active */}
        {isActive && (
          <motion.div
            className="absolute rounded-2xl"
            style={{
              inset: -15,
              background: building.glowColor,
              filter: `blur(${25 + intensity * 8}px)`,
              borderRadius: '50%',
            }}
            animate={{
              opacity: [0.15, 0.35, 0.15],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Diamond shape — isometric building top-down */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: 80,
            height: 80,
            transform: 'rotate(45deg)',
            background: isActive
              ? `linear-gradient(135deg, ${building.color}, ${building.glowColor}55)`
              : `linear-gradient(135deg, ${building.color}, ${building.color}88)`,
            borderRadius: 10,
            border: `2px solid ${isActive ? building.glowColor + 'aa' : 'rgba(255,255,255,0.08)'}`,
            boxShadow: isActive
              ? `0 0 30px ${building.glowColor}33, 0 0 60px ${building.glowColor}15, inset 0 0 20px ${building.glowColor}22`
              : '0 6px 20px rgba(0,0,0,0.5)',
            transition: 'border 0.6s ease, box-shadow 0.6s ease',
          }}
        >
          {/* Icon (counter-rotate) */}
          <span
            className="text-2xl select-none"
            style={{
              transform: 'rotate(-45deg)',
              filter: isActive ? 'brightness(1.3)' : 'brightness(0.8)',
              transition: 'filter 0.5s ease',
            }}
          >
            {building.icon}
          </span>

          {/* Window lights when active */}
          {isActive && (
            <>
              <motion.div
                className="absolute rounded-sm"
                style={{
                  width: 8, height: 8,
                  background: building.glowColor,
                  top: 18, left: 18,
                  transform: 'rotate(-45deg)',
                }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="absolute rounded-sm"
                style={{
                  width: 8, height: 8,
                  background: building.glowColor,
                  bottom: 18, right: 18,
                  transform: 'rotate(-45deg)',
                }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.7 }}
              />
            </>
          )}
        </div>

        {/* === Building-specific particle effects === */}

        {/* Forge: sparks flying up */}
        {isActive && building.id === 'forge' && <Sparks color={building.glowColor} />}

        {/* Arena: pulsing ring + lightning flashes */}
        {isActive && building.id === 'arena' && (
          <>
            <motion.div
              className="absolute rounded-full border-2"
              style={{ inset: -8, borderColor: building.glowColor }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            />
            <LightningFlashes color={building.glowColor} />
          </>
        )}

        {/* Library: floating glowing runes */}
        {isActive && building.id === 'library' && <FloatingRunes color={building.glowColor} />}

        {/* Guild: spinning geometric pattern */}
        {isActive && building.id === 'guild' && <GeometricOrbit color={building.glowColor} />}

        {/* Tower: twinkling stars above */}
        {isActive && building.id === 'tower' && <TwinklingStars color={building.glowColor} />}

        {/* Campfire: always has flames */}
        {building.id === 'campfire' && <CampfireFlames active={isActive} color={building.glowColor} />}
      </motion.div>

      {/* Label */}
      <div className="mt-4 text-center">
        <span className="text-[11px] font-semibold text-white/50 whitespace-nowrap tracking-wide">
          {building.name}
        </span>
        {isActive && (
          <motion.div
            className="text-[10px] font-medium mt-0.5"
            style={{ color: building.glowColor }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 0.8, y: 0 }}
          >
            {building.activeAgents.length} {building.activeAgents.length === 1 ? 'agent' : 'agents'}
          </motion.div>
        )}
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hovered && agentsInside.length > 0 && (
          <motion.div
            className="absolute z-50 pointer-events-none"
            style={{ bottom: '100%', marginBottom: 8 }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="px-2.5 py-2 rounded-lg text-[9px] whitespace-nowrap"
              style={{
                background: 'rgba(0,0,0,0.9)',
                border: `1px solid ${building.glowColor}33`,
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="text-[10px] font-semibold mb-1.5" style={{ color: building.glowColor }}>
                {building.name}
              </div>
              {agentsInside.map(a => (
                <div key={a.id} className="flex items-center gap-1.5 py-0.5">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: a.color }}
                  />
                  <span style={{ color: a.color }}>{a.name}</span>
                  {a.detail && (
                    <span className="text-white/30 font-mono ml-1">
                      {a.detail.length > 16 ? a.detail.slice(0, 14) + '…' : a.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Particle Effects ──────────────────────────────────────

function Sparks({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 3, height: 3,
            background: color,
            left: '50%', top: '20%',
            boxShadow: `0 0 4px ${color}`,
          }}
          animate={{
            x: [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 70],
            y: [0, -Math.random() * 50 - 20],
            opacity: [1, 0],
            scale: [1, 0.3],
          }}
          transition={{
            duration: 0.6 + Math.random() * 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

function LightningFlashes({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            width: 2, height: 12 + i * 6,
            background: `linear-gradient(to bottom, ${color}, transparent)`,
            left: `${30 + i * 20}%`,
            top: '-10%',
            transform: `rotate(${-15 + i * 15}deg)`,
            borderRadius: 1,
          }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{
            duration: 0.15,
            repeat: Infinity,
            repeatDelay: 2 + i * 1.3,
            delay: i * 0.7,
          }}
        />
      ))}
    </div>
  );
}

function FloatingRunes({ color }: { color: string }) {
  const runes = ['⟁', '◇', '△', '○', '⬡', '⊡'];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {runes.slice(0, 5).map((rune, i) => (
        <motion.div
          key={i}
          className="absolute text-[8px] select-none"
          style={{
            color,
            left: `${15 + i * 16}%`,
            top: '-5%',
            textShadow: `0 0 6px ${color}`,
          }}
          animate={{
            y: [0, -20 - i * 5, 0],
            x: [(i % 2 ? -5 : 5), (i % 2 ? 5 : -5)],
            opacity: [0, 0.7, 0],
            rotate: [0, 180],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeInOut',
          }}
        >
          {rune}
        </motion.div>
      ))}
    </div>
  );
}

function GeometricOrbit({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible flex items-center justify-center">
      {/* Orbiting dot */}
      <motion.div
        className="absolute"
        style={{ width: 50, height: 50 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 4, height: 4,
            background: color,
            boxShadow: `0 0 6px ${color}`,
            top: 0, left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      </motion.div>
      {/* Second orbit, opposite direction */}
      <motion.div
        className="absolute"
        style={{ width: 36, height: 36 }}
        animate={{ rotate: -360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 3, height: 3,
            background: color,
            boxShadow: `0 0 4px ${color}`,
            top: 0, left: '50%',
            transform: 'translateX(-50%)',
            opacity: 0.6,
          }}
        />
      </motion.div>
    </div>
  );
}

function TwinklingStars({ color }: { color: string }) {
  return (
    <div className="absolute pointer-events-none overflow-visible" style={{ inset: -20, top: -35 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: i % 2 ? 2 : 3,
            height: i % 2 ? 2 : 3,
            background: i % 3 === 0 ? color : 'white',
            boxShadow: `0 0 4px ${i % 3 === 0 ? color : 'white'}`,
            left: `${((i * 37 + 10) % 90) + 5}%`,
            top: `${((i * 23 + 5) % 40)}%`,
          }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1, 0.5] }}
          transition={{
            duration: 1.5 + (i % 3) * 0.5,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function CampfireFlames({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="absolute pointer-events-none overflow-visible" style={{ inset: -5, bottom: -15 }}>
      {/* Base glow — always on, brighter when agents present */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 40, height: 40,
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
        }}
        animate={{ opacity: active ? [0.4, 0.8, 0.4] : [0.15, 0.25, 0.15] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Flame particles */}
      {Array.from({ length: active ? 8 : 4 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 4 - (i % 2),
            height: 6 - (i % 3),
            background: i % 3 === 0 ? '#ff6b35' : i % 3 === 1 ? '#ffa500' : '#ffcc00',
            left: `${45 + ((i * 7) % 15)}%`,
            bottom: '40%',
            borderRadius: '40% 40% 50% 50%',
            boxShadow: `0 0 3px ${i % 2 ? '#ff6b35' : '#ffa500'}`,
          }}
          animate={{
            y: [0, -12 - (i * 3), -20 - (i * 2)],
            x: [(i % 2 ? -3 : 3), (i % 2 ? 4 : -4)],
            opacity: [active ? 0.9 : 0.4, active ? 0.6 : 0.2, 0],
            scaleY: [1, 1.4, 0.5],
          }}
          transition={{
            duration: 0.8 + (i % 3) * 0.3,
            repeat: Infinity,
            delay: i * 0.12,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}
