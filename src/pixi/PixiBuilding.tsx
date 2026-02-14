import { useRef } from 'react';
import { useTick } from '@pixi/react';
import { BlurFilter, type Texture } from 'pixi.js';
import type { BuildingState } from '../types';
import { CENTER_X, CENTER_Y } from './setup';

interface PixiBuildingProps {
  building: BuildingState;
  texture: Texture;
  onPosition?: (id: string, x: number, y: number) => void;
}

export function PixiBuilding({ building, texture, onPosition }: PixiBuildingProps) {
  const isActive = building.activeAgents.length > 0;
  const intensity = Math.min(building.activeAgents.length, 5);

  const elapsed = useRef(0);
  const glowRef = useRef<any>(null);
  const spriteRef = useRef<any>(null);
  const blurFilter = useRef(new BlurFilter({ strength: 20 }));

  const px = CENTER_X + building.position.x;
  const py = CENTER_Y + building.position.y;

  // Report position for HTML overlay
  onPosition?.(building.id, px, py);

  // Animate glow + slight pulse
  useTick((ticker) => {
    elapsed.current += ticker.deltaMS;
    const t = elapsed.current;

    if (glowRef.current) {
      if (isActive) {
        const pulse = 0.08 + Math.sin(t * 0.003) * 0.15;
        glowRef.current.alpha = pulse;
        blurFilter.current.strength = 16 + intensity * 5;
      } else {
        // Fade glow out
        glowRef.current.alpha *= 0.95;
      }
    }

    if (spriteRef.current) {
      if (isActive) {
        const s = baseScale * (1 + Math.sin(t * 0.002) * 0.015);
        spriteRef.current.scale.set(s);
      } else {
        spriteRef.current.scale.set(baseScale);
      }
    }
  });

  const SPRITE_SIZE = 130;
  const baseScale = SPRITE_SIZE / Math.max(texture.width, texture.height);

  return (
    <pixiContainer
      x={px}
      y={py}
      zIndex={py}
      sortableChildren={false}
    >
      {/* Glow layer behind (blurred copy) */}
      <pixiSprite
        ref={glowRef}
        texture={texture}
        anchor={0.5}
        scale={baseScale * 1.1}
        alpha={0}
        filters={[blurFilter.current]}
        tint={building.glowColor}
      />

      {/* Main building sprite */}
      <pixiSprite
        ref={spriteRef}
        texture={texture}
        anchor={0.5}
        scale={baseScale}
        alpha={isActive ? 1 : 0.65}
      />

      {/* Active particles — sparks rising */}
      {isActive && <BuildingSparks color={building.glowColor} />}
    </pixiContainer>
  );
}

// ── Rising spark particles ──────────────────────────────

function BuildingSparks({ color }: { color: string }) {
  const graphicsRef = useRef<any>(null);
  const elapsed = useRef(0);

  // 6 particles, each with a phase offset
  const particles = useRef(
    Array.from({ length: 6 }, (_, i) => ({
      phase: i * 0.4,
      baseX: (i - 2.5) * 8,
      speed: 30 + (i % 3) * 12,
    })),
  );

  const colorNum = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;

  useTick((ticker) => {
    elapsed.current += ticker.deltaMS / 1000;
    const g = graphicsRef.current;
    if (!g) return;

    g.clear();
    const t = elapsed.current;

    for (const p of particles.current) {
      const life = ((t + p.phase) % 1.8) / 1.8; // 0..1 cycle
      const x = p.baseX + Math.sin((t + p.phase) * 3) * 6;
      const y = -20 - life * p.speed;
      const alpha = 1 - life;
      const size = (1 - life) * 2.5;

      g.circle(x, y, size);
      g.fill({ color: colorNum, alpha: alpha * 0.8 });
    }
  });

  return <pixiGraphics ref={graphicsRef} draw={(g: any) => g.clear()} />;
}
