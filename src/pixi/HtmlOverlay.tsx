import { ThoughtBubble } from '../components/ThoughtBubble';
import type { AgentState, BuildingState } from '../types';

interface HtmlOverlayProps {
  agents: Map<string, AgentState>;
  buildings: BuildingState[];
  positions: Map<string, { x: number; y: number }>;
}

const ACTIVITY_LABELS: Record<string, string> = {
  planning: '🧠 planning',
  coding: '⚡ coding',
  testing: '🧪 testing',
  researching: '📖 reading',
  reviewing: '👁 reviewing',
  idle: '💤 idle',
};

export function HtmlOverlay({ agents, buildings, positions }: HtmlOverlayProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    >
      {/* Building labels */}
      {buildings.map(b => {
        const pos = positions.get(b.id);
        if (!pos) return null;
        const isActive = b.activeAgents.length > 0;
        return (
          <div
            key={b.id}
            className="absolute text-center"
            style={{
              left: pos.x,
              top: pos.y + 72,
              transform: 'translate(-50%, 0)',
            }}
          >
            <span
              className="text-[11px] font-semibold whitespace-nowrap tracking-wide"
              style={{ color: isActive ? `${b.glowColor}bb` : 'rgba(255,255,255,0.4)' }}
            >
              {b.name}
            </span>
            {isActive && (
              <div
                className="text-[10px] font-medium mt-0.5"
                style={{ color: b.glowColor, opacity: 0.8 }}
              >
                {b.activeAgents.length} {b.activeAgents.length === 1 ? 'dwarf' : 'dwarves'}
              </div>
            )}
          </div>
        );
      })}

      {/* Agent overlays */}
      {Array.from(agents.values()).map(agent => {
        const pos = positions.get(agent.id);
        if (!pos) return null;
        const isSub = !!agent.isSubAgent;
        const spriteH = isSub ? 28 : 44;

        return (
          <div
            key={agent.id}
            className="absolute flex flex-col items-center"
            style={{
              left: pos.x,
              top: pos.y + spriteH * 0.5 + 4,
              transform: 'translate(-50%, 0)',
            }}
          >
            {/* Thought bubble (main agents only) */}
            {!isSub && (
              <div style={{ position: 'absolute', bottom: spriteH + 16, left: '50%', transform: 'translateX(-50%)' }}>
                <ThoughtBubble
                  detail={agent.detail}
                  activity={agent.activity}
                  color={agent.color}
                  offsetDir={0}
                />
              </div>
            )}

            {/* Name tag */}
            <div
              className="px-2 py-0.5 rounded-full whitespace-nowrap pointer-events-auto cursor-pointer"
              style={{
                background: 'rgba(0,0,0,0.75)',
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

            {/* Activity label */}
            <div className="text-white/40 mt-0.5 whitespace-nowrap" style={{ fontSize: isSub ? 7 : 8 }}>
              {agent.status === 'working'
                ? (ACTIVITY_LABELS[agent.activity] || agent.activity)
                : (!isSub && agent.title && agent.level > 1)
                  ? agent.title
                  : (agent.role || ACTIVITY_LABELS[agent.activity] || agent.activity)
              }
            </div>

            {/* Project badge */}
            {!isSub && agent.project && (
              <div
                className="mt-0.5 px-1.5 py-px rounded-full whitespace-nowrap"
                style={{
                  background: `${agent.color}15`,
                  border: `1px solid ${agent.color}22`,
                  fontSize: 7,
                  color: `${agent.color}88`,
                }}
              >
                {agent.project}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
