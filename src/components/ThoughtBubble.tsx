import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ActivityType } from '../types'

interface ThoughtBubbleProps {
  detail: string;
  activity: ActivityType;
  color: string;
  /** Hash-based horizontal offset to prevent overlap (-1 = left, 0 = center, 1 = right) */
  offsetDir?: number;
}

const ACTIVITY_ICON: Record<string, string> = {
  coding: '⛏',
  researching: '📜',
  testing: '⚔️',
  planning: '🗺',
  reviewing: '👁',
  idle: '💤',
};

const SHOW_DURATION = 5000; // ms before auto-hide

// ── Dwarf Speech Templates ──────────────────────────────
// Each activity has a set of dwarf-flavored phrases.
// {f} is replaced with the short filename/detail.

const DWARF_CODING = [
  'Hammering {f}',
  'Forging {f}',
  'Chiseling {f}',
  'Filing {f}',
  'Shaping {f}',
  'Crafting {f}',
  'Working on {f}',
];

const DWARF_RESEARCHING = [
  'Studying {f}',
  'Digging into {f}',
  'Reading runes in {f}',
  'Searching {f}',
  'Deciphering {f}',
  'Researching {f}',
];

const DWARF_TESTING = [
  'Testing the craft!',
  'Into the arena!',
  'Testing the blade!',
  'Blow after blow!',
  'Stress test!',
];

const DWARF_PLANNING = [
  'Pondering the plan\u2026',
  'Guild meeting\u2026',
  'Plotting the scheme\u2026',
  'Advising the guild\u2026',
  'Drawing the map\u2026',
];

const DWARF_IDLE = [
  'Sharpening the axe\u2026',
  'Resting by the fire\u2026',
  'Dozing off\u2026',
  'Awaiting orders\u2026',
  'Puffing smoke\u2026',
];

/** Deterministic pick based on string hash */
function pick<T>(arr: T[], seed: string): T {
  const h = seed.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return arr[Math.abs(h) % arr.length];
}

/** Extract short filename from detail (strip paths, truncate) */
function shortFile(detail: string): string {
  let f = detail;
  // Extract basename from file paths (but not from commands with slashes)
  if (f.includes('/') && !f.includes(' ')) f = f.split('/').pop() || f;
  // Truncate long names
  if (f.length > 18) f = f.slice(0, 16) + '\u2026';
  return f;
}

/** Transform technical detail into dwarf-themed speech */
function dwarfSpeak(activity: ActivityType, detail: string): string {
  if (!detail || detail === 'undefined') {
    switch (activity) {
      case 'coding':      return pick(DWARF_CODING, 'no').replace(' {f}', '').replace('{f}', 'something fine');
      case 'researching': return pick(DWARF_RESEARCHING, 'no').replace(' {f}', '').replace('{f}', 'the archives');
      case 'testing':     return pick(DWARF_TESTING, detail || 'test');
      case 'planning':    return pick(DWARF_PLANNING, detail || 'plan');
      default:            return pick(DWARF_IDLE, detail || 'idle');
    }
  }

  const f = shortFile(detail);

  switch (activity) {
    case 'coding':
      return pick(DWARF_CODING, detail).replace('{f}', f);
    case 'researching':
      return pick(DWARF_RESEARCHING, detail).replace('{f}', f);
    case 'testing':
      return pick(DWARF_TESTING, detail);
    case 'planning':
      if (detail === 'updating tasks') return 'Organizing the tasks\u2026';
      if (detail === 'starting') return 'Awakening to duty!';
      return pick(DWARF_PLANNING, detail);
    case 'idle':
      return pick(DWARF_IDLE, detail);
    default:
      return pick(DWARF_IDLE, detail);
  }
}

export function ThoughtBubble({ detail, activity, color, offsetDir = 0 }: ThoughtBubbleProps) {
  const [visible, setVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!detail || detail === currentDetail) return;
    setCurrentDetail(detail);
    setVisible(true);

    // Auto-hide after duration
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), SHOW_DURATION);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  const icon = ACTIVITY_ICON[activity] || '';
  const dwarf = dwarfSpeak(activity, currentDetail);
  const text = dwarf.length > 38 ? dwarf.slice(0, 36) + '\u2026' : dwarf;

  // Offset bubble position based on hash direction
  const xShift = offsetDir * 28;
  const yShift = Math.abs(offsetDir) * -4; // slightly higher when offset

  return (
    <AnimatePresence>
      {visible && currentDetail && (
        <motion.div
          key={currentDetail}
          className="absolute flex flex-col items-center pointer-events-none"
          style={{
            bottom: '100%',
            left: `calc(50% + ${xShift}px)`,
            transform: 'translateX(-50%)',
            marginBottom: 8 + yShift,
          }}
          initial={{ opacity: 0, y: 8, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="relative px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{
              background: 'rgba(0,0,0,0.85)',
              border: `1px solid ${color}33`,
              maxWidth: 220,
            }}
          >
            <span className="text-[7px] leading-tight" style={{ color: `${color}bb` }}>
              {icon && <span className="mr-0.5">{icon}</span>}
              <span>{text}</span>
            </span>
          </div>
          {/* Tiny tail */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '3px solid transparent',
              borderRight: '3px solid transparent',
              borderTop: '3px solid rgba(0,0,0,0.85)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
