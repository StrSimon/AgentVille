import { motion, AnimatePresence } from 'framer-motion'
import { Building } from './Building'
import { AgentAvatar } from './AgentAvatar'
import { TrailLayer } from './TrailLayer'
import { DayNightCycle } from './DayNightCycle'
import type { AgentState, BuildingState, Trail } from '../types'

interface VillageProps {
  agents: Map<string, AgentState>;
  buildings: BuildingState[];
  trails: Trail[];
  agentCount: number;
  activeAgentCount: number;
  onAgentClick: (agentId: string) => void;
}

export function Village({ agents, buildings, trails, agentCount, activeAgentCount, onAgentClick }: VillageProps) {
  const centerX = 450;
  const centerY = 350;

  const getBuildingPosition = (buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    return building?.position || { x: 0, y: 0 };
  };

  // Compute agent pixel positions for parent-child lines
  const getAgentPixelPos = (agent: AgentState) => {
    const targetPos = agent.targetBuilding
      ? getBuildingPosition(agent.targetBuilding)
      : { x: 0, y: 0 };
    const hash =
      (agent.id.charCodeAt(0) * 7 +
        agent.id.charCodeAt(agent.id.length - 1) * 13 +
        agent.id.length * 3) %
      60 - 30;
    const hash2 =
      (agent.id.charCodeAt(Math.floor(agent.id.length / 2)) * 11 + agent.id.length * 7) % 30 - 15;
    return {
      x: centerX + targetPos.x + hash,
      y: centerY + targetPos.y + 50 + Math.abs(hash2),
    };
  };

  const agentArray = Array.from(agents.values());

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative" style={{ width: 900, height: 700 }}>
        {/* Day/Night atmospheric cycle */}
        <DayNightCycle agentCount={agentCount} activeAgentCount={activeAgentCount} />

        {/* Ambient ground glow */}
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '50%',
            width: 600,
            height: 600,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(30,40,80,0.3) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Static path connections between buildings */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        >
          {buildings
            .filter(b => b.id !== 'campfire')
            .map(building => (
              <line
                key={building.id}
                x1={centerX}
                y1={centerY}
                x2={centerX + building.position.x}
                y2={centerY + building.position.y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="3"
                strokeDasharray="6 10"
              />
            ))}
        </svg>

        {/* Agent movement trails */}
        <TrailLayer trails={trails} centerX={centerX} centerY={centerY} />

        {/* Buildings - sorted by Y for depth */}
        {[...buildings]
          .sort((a, b) => a.position.y - b.position.y)
          .map(building => (
            <Building
              key={building.id}
              building={building}
              centerX={centerX}
              centerY={centerY}
              agentsInside={agentArray.filter(a => a.targetBuilding === building.id)}
            />
          ))}

        {/* Agents - always on top */}
        <AnimatePresence>
          {agentArray.map(agent => {
            const targetPos = agent.targetBuilding
              ? getBuildingPosition(agent.targetBuilding)
              : { x: 0, y: 0 };

            // Find parent pixel position for sub-agent connection line
            let parentPixelPos: { x: number; y: number } | null = null;
            if (agent.isSubAgent && agent.parentId) {
              const parent = agents.get(agent.parentId);
              if (parent) {
                parentPixelPos = getAgentPixelPos(parent);
              }
            }

            return (
              <AgentAvatar
                key={agent.id}
                agent={agent}
                targetPosition={targetPos}
                centerX={centerX}
                centerY={centerY}
                parentPosition={parentPixelPos}
                onClick={() => onAgentClick(agent.id)}
              />
            );
          })}
        </AnimatePresence>

        {/* Quiet village overlay when no agents */}
        <AnimatePresence>
          {agents.size === 0 && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 20 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
            >
              {/* Fireflies / ambient particles */}
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 3,
                    height: 3,
                    background: '#fbbf24',
                    boxShadow: '0 0 6px #fbbf2466',
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`,
                  }}
                  animate={{
                    x: [0, (Math.random() - 0.5) * 40, 0],
                    y: [0, (Math.random() - 0.5) * 30, 0],
                    opacity: [0, 0.6, 0],
                  }}
                  transition={{
                    duration: 3 + Math.random() * 4,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: 'easeInOut',
                  }}
                />
              ))}

              {/* Quiet message */}
              <motion.div
                className="text-center"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="text-white/20 text-sm font-light tracking-widest">
                  The village is quiet
                </div>
                <div className="text-white/10 text-xs mt-1">
                  waiting for agents...
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
