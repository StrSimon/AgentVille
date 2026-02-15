import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ActivityType } from '../types'

interface ThoughtBubbleProps {
  detail: string;
  activity: ActivityType;
  color: string;
  /** Hash-based horizontal offset to prevent overlap (-1 = left, 0 = center, 1 = right) */
  offsetDir?: number;
  /** Agent is waiting for user input — show persistent bubble */
  waiting?: boolean;
  /** Agent is idle at the campfire */
  isIdleAtCampfire?: boolean;
  /** Previous activity (for victory detection after testing) */
  previousActivity?: ActivityType | null;
  /** Transient failure message */
  failure?: string;
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

const DWARF_WAITING = [
  'Awaiting orders, chief!',
  'Need yer input, boss!',
  'Waitin\u2019 on ye, chief!',
  'Oi! Need instructions!',
  'Standing by for orders!',
];

const CAMPFIRE_STORIES = [
  'Remember that refactor\u2026',
  'The tests were fierce today\u2026',
  'I once compiled 500 files\u2026',
  'Back in my day, no types\u2026',
  'Did ye hear the merge conflict?',
  'The linter spared no one\u2026',
  'That bug took three days\u2026',
  'Legend says the build still runs\u2026',
  'I dream of zero warnings\u2026',
  'The CI was relentless\u2026',
  'Three deploys before breakfast!',
  'The code review was brutal\u2026',
];

const VICTORY_PHRASES = [
  'Victory! Tests pass!',
  'The blade holds true!',
  'All tests conquered!',
  'Arena cleared!',
  'Battle won!',
];

const DWARF_FAILURE = [
  'My hammer broke!',
  'Blast! It crumbled!',
  'The anvil cracked!',
  'Ack! Failed!',
  'That didn\u2019t work!',
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

export function ThoughtBubble({ detail, activity, color, offsetDir = 0, waiting = false, isIdleAtCampfire = false, previousActivity = null, failure }: ThoughtBubbleProps) {
  const [visible, setVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [storyText, setStoryText] = useState<string | null>(null);
  const storyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [showVictory, setShowVictory] = useState(false);

  useEffect(() => {
    // Waiting mode — always visible, no auto-hide
    if (waiting) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (!detail || detail === currentDetail) return;
    setCurrentDetail(detail);
    setVisible(true);

    // Auto-hide after duration
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), SHOW_DURATION);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [detail, waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isIdleAtCampfire || waiting) {
      setStoryText(null);
      if (storyTimerRef.current) clearTimeout(storyTimerRef.current);
      return;
    }

    function showStory() {
      const story = CAMPFIRE_STORIES[Math.floor(Math.random() * CAMPFIRE_STORIES.length)];
      setStoryText(story);
      // Hide after 4 seconds, then schedule next in 8-15s
      storyTimerRef.current = setTimeout(() => {
        setStoryText(null);
        storyTimerRef.current = setTimeout(showStory, 8000 + Math.random() * 7000);
      }, 4000);
    }

    // First story after 5-10 seconds of being idle at campfire
    storyTimerRef.current = setTimeout(showStory, 5000 + Math.random() * 5000);
    return () => { if (storyTimerRef.current) clearTimeout(storyTimerRef.current); };
  }, [isIdleAtCampfire, waiting]);

  useEffect(() => {
    if (previousActivity === 'testing' && activity !== 'testing') {
      setShowVictory(true);
      const timer = setTimeout(() => setShowVictory(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [previousActivity, activity]);

  const isStoryMode = isIdleAtCampfire && !waiting && storyText;
  const isVictoryMode = showVictory;
  const isWaiting = waiting;
  const isFailureMode = !!failure;

  const icon = isFailureMode ? '💥'
    : isVictoryMode ? '⚔️'
    : isStoryMode ? '🔥'
    : isWaiting ? '⏳'
    : (ACTIVITY_ICON[activity] || '');

  const dwarf = isFailureMode
    ? pick(DWARF_FAILURE, failure || 'fail')
    : isVictoryMode
    ? pick(VICTORY_PHRASES, currentDetail || 'victory')
    : isStoryMode
    ? storyText!
    : isWaiting
    ? pick(DWARF_WAITING, currentDetail || 'wait')
    : dwarfSpeak(activity, currentDetail);

  const text = dwarf.length > 38 ? dwarf.slice(0, 36) + '\u2026' : dwarf;

  // Offset bubble position based on hash direction
  const xShift = offsetDir * 28;
  const yShift = Math.abs(offsetDir) * -4; // slightly higher when offset

  return (
    <AnimatePresence>
      {(visible && (isWaiting || currentDetail) || isStoryMode || isVictoryMode || isFailureMode) && (
        <motion.div
          key={isWaiting ? 'waiting' : currentDetail}
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
          <motion.div
            className="relative px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{
              background: isFailureMode ? 'rgba(30,0,0,0.92)' : isWaiting ? 'rgba(30,10,0,0.92)' : 'rgba(0,0,0,0.85)',
              border: `1px solid ${isFailureMode ? '#ef444488' : isWaiting ? '#f59e0b88' : `${color}33`}`,
              maxWidth: 220,
            }}
            animate={isWaiting ? {
              borderColor: ['#f59e0b88', '#f59e0bdd', '#f59e0b88'],
            } : {}}
            transition={isWaiting ? {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            } : {}}
          >
            <span className="text-[7px] leading-tight" style={{ color: isFailureMode ? '#f87171' : isWaiting ? '#fbbf24' : `${color}bb` }}>
              {icon && <span className="mr-0.5">{icon}</span>}
              <span>{text}</span>
            </span>
          </motion.div>
          {/* Tiny tail */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '3px solid transparent',
              borderRight: '3px solid transparent',
              borderTop: `3px solid ${isFailureMode ? 'rgba(30,0,0,0.92)' : isWaiting ? 'rgba(30,10,0,0.92)' : 'rgba(0,0,0,0.85)'}`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
