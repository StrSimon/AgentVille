import { motion, AnimatePresence } from 'framer-motion'
import type { Trail } from '../types'

interface TrailLayerProps {
  trails: Trail[];
  centerX: number;
  centerY: number;
  spread?: number;
}

/**
 * Compute a Bezier control point offset from the midpoint
 * to create a natural curved path. Curves away from the village center.
 */
function getCurvePath(
  x1: number, y1: number,
  x2: number, y2: number,
  centerX: number, centerY: number,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Perpendicular direction from line midpoint, offset away from center
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular (rotated 90°)
  const px = -dy / len;
  const py = dx / len;
  // Offset away from center
  const toCenter = { x: centerX - mx, y: centerY - my };
  const dot = px * toCenter.x + py * toCenter.y;
  const sign = dot > 0 ? -1 : 1;
  const curve = Math.min(len * 0.3, 40);
  const cx = mx + px * curve * sign;
  const cy = my + py * curve * sign;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export function TrailLayer({ trails, centerX, centerY, spread = 1 }: TrailLayerProps) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <defs>
        {trails.map(trail => (
          <linearGradient
            key={`grad-${trail.id}`}
            id={`trail-grad-${trail.id}`}
            x1={centerX + trail.fromPos.x * spread}
            y1={centerY + trail.fromPos.y * spread}
            x2={centerX + trail.toPos.x * spread}
            y2={centerY + trail.toPos.y * spread}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={trail.color} stopOpacity="0.05" />
            <stop offset="40%" stopColor={trail.color} stopOpacity="0.4" />
            <stop offset="60%" stopColor={trail.color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={trail.color} stopOpacity="0.05" />
          </linearGradient>
        ))}
      </defs>

      {/* Curved trail paths */}
      <AnimatePresence>
        {trails.map(trail => {
          const x1 = centerX + trail.fromPos.x * spread;
          const y1 = centerY + trail.fromPos.y * spread;
          const x2 = centerX + trail.toPos.x * spread;
          const y2 = centerY + trail.toPos.y * spread;
          const path = getCurvePath(x1, y1, x2, y2, centerX, centerY);

          return (
            <motion.path
              key={trail.id}
              d={path}
              fill="none"
              stroke={`url(#trail-grad-${trail.id})`}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 0.6, pathLength: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.3 },
                pathLength: { duration: 1, ease: 'easeOut' },
                exit: { duration: 3, ease: 'easeOut' },
              }}
            />
          );
        })}
      </AnimatePresence>

      {/* Glowing dots at trail destination */}
      <AnimatePresence>
        {trails.map(trail => (
          <motion.circle
            key={`dot-${trail.id}`}
            cx={centerX + trail.toPos.x * spread}
            cy={centerY + trail.toPos.y * spread}
            r={3}
            fill={trail.color}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0.3] }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.6 },
              exit: { duration: 3, ease: 'easeOut' },
            }}
          />
        ))}
      </AnimatePresence>

      {/* Moving dot along newest trails */}
      <AnimatePresence>
        {trails.slice(-3).map(trail => {
          const x1 = centerX + trail.fromPos.x * spread;
          const y1 = centerY + trail.fromPos.y * spread;
          const x2 = centerX + trail.toPos.x * spread;
          const y2 = centerY + trail.toPos.y * spread;
          const path = getCurvePath(x1, y1, x2, y2, centerX, centerY);

          return (
            <motion.circle
              key={`travel-${trail.id}`}
              r={2}
              fill={trail.color}
              filter={`drop-shadow(0 0 3px ${trail.color})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.8, 0] }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            >
              <animateMotion
                dur="1.2s"
                fill="freeze"
                path={path}
              />
            </motion.circle>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
