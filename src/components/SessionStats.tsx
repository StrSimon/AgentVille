import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface SessionStatsProps {
  agentCount: number;
  totalEvents: number;
  totalInputBytes: number;
  totalOutputBytes: number;
}

/** Rough estimate: ~4 bytes per token on average */
function formatTokens(bytes: number): string {
  const tokens = Math.round(bytes / 4);
  if (tokens < 1000) return String(tokens);
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

export function SessionStats({ agentCount, totalEvents, totalInputBytes, totalOutputBytes }: SessionStatsProps) {
  const [elapsed, setElapsed] = useState(0);
  const [peakAgents, setPeakAgents] = useState(0);
  const startRef = useRef(Date.now());

  // Update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track peak agents
  useEffect(() => {
    setPeakAgents(prev => Math.max(prev, agentCount));
  }, [agentCount]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (totalEvents === 0) return null;

  return (
    <motion.div
      className="absolute top-[4.2rem] left-6 z-20 flex items-center gap-4"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Stat label="Session" value={timeStr} />
      <Stat label="Events" value={String(totalEvents)} />
      <Stat label="Peak" value={String(peakAgents)} />
      {(totalInputBytes + totalOutputBytes) > 0 && (
        <Stat label="Tokens" value={`~${formatTokens(totalInputBytes + totalOutputBytes)}`} />
      )}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[9px] text-white/20 uppercase tracking-wider">{label}</span>
      <span className="text-[11px] text-white/40 font-mono">{value}</span>
    </div>
  );
}
