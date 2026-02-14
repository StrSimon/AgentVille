import { motion } from 'framer-motion'
import { ThoughtBubble } from './ThoughtBubble'
import { getClanColor } from '../types'
import type { AgentState } from '../types'

interface AgentAvatarProps {
  agent: AgentState;
  targetPosition: { x: number; y: number };
  centerX: number;
  centerY: number;
  parentPosition?: { x: number; y: number } | null;
  onClick?: () => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  planning: '🧠 planning',
  coding: '⚡ coding',
  testing: '🧪 testing',
  researching: '📖 reading',
  reviewing: '👁 reviewing',
  idle: '💤 idle',
};

export function AgentAvatar({ agent, targetPosition, centerX, centerY, parentPosition, onClick }: AgentAvatarProps) {
  const isSub = !!agent.isSubAgent;
  const size = isSub ? 13 : 18;
  const glowSize = isSub ? 20 : 28;

  // Offset agents slightly so they don't stack exactly
  const hash =
    (agent.id.charCodeAt(0) * 7 +
      agent.id.charCodeAt(agent.id.length - 1) * 13 +
      agent.id.length * 3) %
    60 - 30;
  const hash2 =
    (agent.id.charCodeAt(Math.floor(agent.id.length / 2)) * 11 + agent.id.length * 7) % 30 - 15;

  const x = centerX + targetPosition.x + hash;
  const y = centerY + targetPosition.y + 50 + Math.abs(hash2);

  return (
    <>
      {/* Connection line to parent */}
      {isSub && parentPosition && (
        <motion.svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 14 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.line
            x1={parentPosition.x}
            y1={parentPosition.y}
            x2={x + size / 2}
            y2={y + size / 2}
            stroke={agent.color}
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.4"
            animate={{ strokeOpacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.svg>
      )}

      <motion.div
        className="absolute flex flex-col items-center cursor-pointer"
        style={{ zIndex: 15 }}
        onClick={onClick}
        initial={{ left: centerX, top: centerY + 50, opacity: 0, scale: 0 }}
        animate={{
          left: x,
          top: y,
          opacity: 1,
          scale: 1,
        }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{
          left: { type: 'tween', duration: 1.8, ease: 'easeInOut' },
          top: { type: 'tween', duration: 1.8, ease: 'easeInOut' },
          opacity: { duration: 0.4 },
          scale: { duration: 0.3 },
        }}
      >
        {/* Thought bubble (not for sub-agents — too crowded) */}
        {!isSub && (
          <ThoughtBubble
            detail={agent.detail}
            activity={agent.activity}
            color={agent.color}
            offsetDir={hash > 0 ? 1 : hash < -10 ? -1 : 0}
          />
        )}

        {/* Bobbing animation when working */}
        <motion.div
          className="relative flex flex-col items-center"
          animate={{
            y: agent.status === 'working' ? [0, -4, 0] : 0,
          }}
          transition={{
            duration: 0.8,
            repeat: agent.status === 'working' ? Infinity : 0,
            ease: 'easeInOut',
          }}
        >
          {/* Ground shadow */}
          <div
            className="absolute rounded-full"
            style={{
              width: size - 2,
              height: 6,
              background: 'rgba(0,0,0,0.4)',
              bottom: -3,
              left: '50%',
              transform: 'translateX(-50%)',
              filter: 'blur(2px)',
            }}
          />

          {/* Glow ring */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: glowSize,
              height: glowSize,
              background: agent.color,
              filter: `blur(${isSub ? 5 : 8}px)`,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              opacity: agent.status === 'working' ? [0.2, 0.5, 0.2] : 0.15,
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Body */}
          <div
            className="relative rounded-full"
            style={{
              width: size,
              height: size,
              background: `radial-gradient(circle at 35% 35%, ${agent.color}, ${agent.color}77)`,
              border: `${isSub ? 1 : 2}px solid ${agent.color}bb`,
              boxShadow: `0 0 10px ${agent.color}44`,
            }}
          >
            {/* Eye highlight */}
            <div
              className="absolute rounded-full bg-white/60"
              style={{
                width: isSub ? 3 : 4,
                height: isSub ? 3 : 4,
                top: isSub ? 3 : 4,
                left: isSub ? 3 : 5,
              }}
            />
          </div>
        </motion.div>

        {/* Name tag */}
        <div
          className="mt-2 px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{
            background: 'rgba(0,0,0,0.7)',
            color: agent.color,
            border: `1px solid ${agent.color}33`,
            backdropFilter: 'blur(4px)',
            fontSize: isSub ? 7 : 9,
            fontWeight: isSub ? 500 : 700,
          }}
        >
          {agent.name}
          {isSub && <span className="ml-0.5 opacity-50 text-[6px]">⛏</span>}
          {!isSub && agent.level > 1 && (
            <span className="ml-1 opacity-60" style={{ fontSize: 7 }}>
              Lv.{agent.level}
            </span>
          )}
        </div>

        {/* Role / activity label */}
        <div className="text-white/40 mt-0.5 whitespace-nowrap" style={{ fontSize: isSub ? 7 : 8 }}>
          {agent.status === 'working'
            ? (ACTIVITY_LABELS[agent.activity] || agent.activity)
            : (!isSub && agent.title && agent.level > 1)
              ? agent.title
              : (agent.role || ACTIVITY_LABELS[agent.activity] || agent.activity)
          }
        </div>

        {/* Clan badge */}
        {!isSub && agent.clan && (() => {
          const cc = getClanColor(agent.clan);
          return (
            <div
              className="mt-0.5 px-1.5 py-px rounded-full whitespace-nowrap"
              style={{
                background: `${cc}20`,
                border: `1px solid ${cc}44`,
                fontSize: 7,
                color: cc,
              }}
            >
              Clan {agent.clan}
            </div>
          );
        })()}
      </motion.div>
    </>
  );
}
