import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type { Texture } from 'pixi.js';
import type { AgentState } from '../types';
import { CENTER_X, CENTER_Y, DWARF_SPRITE, agentOffset } from './setup';

interface PixiDwarfProps {
  agent: AgentState;
  buildingPos: { x: number; y: number };
  textures: Map<string, Texture>;
  onAgentClick: (id: string) => void;
  onPosition?: (id: string, x: number, y: number) => void;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function PixiDwarf({ agent, buildingPos, textures, onAgentClick, onPosition }: PixiDwarfProps) {
  const isSub = !!agent.isSubAgent;
  const size = isSub ? 28 : 44;
  const glowSize = isSub ? 18 : 28;

  const { dx, dy } = agentOffset(agent.id);
  const targetX = CENTER_X + buildingPos.x + dx;
  const targetY = CENTER_Y + buildingPos.y + dy;

  // Smooth position interpolation — start at target so agent spawns in place
  const posRef = useRef({ x: targetX, y: targetY });
  const moveStart = useRef({ x: targetX, y: targetY });
  const moveTarget = useRef({ x: targetX, y: targetY });
  const moveProgress = useRef(1);
  const elapsed = useRef(0);
  const wanderTimer = useRef(0);
  const isWandering = useRef(false);
  const containerRef = useRef<any>(null);
  const spriteRef = useRef<any>(null);
  const shadowRef = useRef<any>(null);
  const glowRef = useRef<any>(null);
  const dustRef = useRef<any>(null);

  // Detect target change
  if (moveTarget.current.x !== targetX || moveTarget.current.y !== targetY) {
    moveStart.current = { ...posRef.current };
    moveTarget.current = { x: targetX, y: targetY };
    moveProgress.current = 0;
  }

  // Get the right dwarf sprite
  const spriteName = DWARF_SPRITE[agent.activity] || DWARF_SPRITE.idle;
  const texture = textures.get(spriteName);
  if (!texture) return null;

  const scale = size / Math.max(texture.width, texture.height);
  const colorNum = parseInt(agent.color.replace('#', ''), 16);
  const isMoving = moveProgress.current < 1;

  useTick((ticker) => {
    elapsed.current += ticker.deltaMS;
    const dt = ticker.deltaMS / 1000;

    // Position lerp (1.8s duration)
    const wasMoving = moveProgress.current < 1;
    if (moveProgress.current < 1) {
      moveProgress.current = Math.min(1, moveProgress.current + dt / 1.8);
      const t = easeInOut(moveProgress.current);
      posRef.current.x = moveStart.current.x + (moveTarget.current.x - moveStart.current.x) * t;
      posRef.current.y = moveStart.current.y + (moveTarget.current.y - moveStart.current.y) * t;
    }

    // ── Idle wandering at campfire ─────────────────────────
    if (agent.activity === 'idle' && moveProgress.current >= 1) {
      wanderTimer.current += dt;
      // Deterministic interval per agent (3-6 seconds)
      const wanderInterval = 3 + ((agent.id.charCodeAt(0) * 7) % 30) / 10;
      if (wanderTimer.current >= wanderInterval) {
        wanderTimer.current = 0;
        isWandering.current = true;
        // Random point within ~70px of current building position
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 50;
        const bx = CENTER_X + buildingPos.x + dx;
        const by = CENTER_Y + buildingPos.y + dy;
        moveStart.current = { ...posRef.current };
        moveTarget.current = {
          x: bx + Math.cos(angle) * dist,
          y: by + Math.sin(angle) * dist,
        };
        moveProgress.current = 0;
      }
    }
    // Reset wander when activity changes from idle
    if (agent.activity !== 'idle' && isWandering.current) {
      isWandering.current = false;
      wanderTimer.current = 0;
    }

    const { x, y } = posRef.current;

    // Bobbing when working
    let bobOffset = 0;
    if (agent.status === 'working') {
      bobOffset = Math.sin(elapsed.current * 0.008) * 4;
    }

    // Walking hop when moving
    if (wasMoving) {
      bobOffset = Math.abs(Math.sin(elapsed.current * 0.012)) * -3;
    }

    // Update container position
    if (containerRef.current) {
      containerRef.current.x = x;
      containerRef.current.y = y + bobOffset;
      containerRef.current.zIndex = Math.round(y);
    }

    // Flip sprite to face movement direction
    if (spriteRef.current) {
      if (wasMoving) {
        const dir = moveTarget.current.x - moveStart.current.x;
        if (Math.abs(dir) > 5) {
          spriteRef.current.scale.x = dir < 0 ? -scale : scale;
        }
      }
    }

    // Glow pulse
    if (glowRef.current) {
      if (agent.status === 'working') {
        glowRef.current.alpha = 0.12 + Math.sin(elapsed.current * 0.004) * 0.1;
      } else {
        glowRef.current.alpha = 0.06;
      }
    }

    // Dust puffs while walking
    if (dustRef.current) {
      const g = dustRef.current;
      g.clear();
      if (wasMoving) {
        const t = elapsed.current * 0.01;
        for (let i = 0; i < 3; i++) {
          const age = ((t + i * 0.3) % 0.9) / 0.9;
          const px = (i - 1) * 6 + Math.sin(t * 3 + i) * 3;
          const py = size * 0.4 - age * 8;
          const alpha = (1 - age) * 0.25;
          const r = 1.5 + age * 3;
          g.circle(px, py, r);
          g.fill({ color: 0xa89070, alpha });
        }
      }
    }

    // Report position for HTML overlay
    onPosition?.(agent.id, x, y + bobOffset);
  });

  const handleClick = useCallback(() => {
    onAgentClick(agent.id);
  }, [agent.id, onAgentClick]);

  return (
    <pixiContainer
      ref={containerRef}
      x={posRef.current.x}
      y={posRef.current.y}
      zIndex={Math.round(posRef.current.y)}
      sortableChildren={false}
    >
      {/* Shadow ellipse */}
      <pixiGraphics
        ref={shadowRef}
        draw={(g: any) => {
          g.clear();
          g.ellipse(0, size * 0.45, size * 0.3, 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
        }}
      />

      {/* Glow circle */}
      <pixiGraphics
        ref={glowRef}
        alpha={0.1}
        draw={(g: any) => {
          g.clear();
          g.circle(0, 0, glowSize);
          g.fill({ color: colorNum, alpha: 1 });
        }}
      />

      {/* Dwarf sprite — tinted with agent color */}
      <pixiSprite
        ref={spriteRef}
        texture={texture}
        anchor={0.5}
        scale={scale}
        tint={colorNum}
        eventMode="static"
        cursor="pointer"
        onPointerDown={handleClick}
      />

      {/* Dust puffs (walking) */}
      <pixiGraphics ref={dustRef} draw={(g: any) => g.clear()} />
    </pixiContainer>
  );
}
