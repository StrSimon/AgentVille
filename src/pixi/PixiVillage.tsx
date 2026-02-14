import { useRef, useCallback, useState } from 'react';
import { Application, useTick } from '@pixi/react';
import type { Texture } from 'pixi.js';
import { DayNightCycle } from '../components/DayNightCycle';
import { HtmlOverlay } from './HtmlOverlay';
import { PixiBuilding } from './PixiBuilding';
import { PixiDwarf } from './PixiDwarf';
import { useSpriteAssets } from './spriteLoader';
import {
  VILLAGE_W, VILLAGE_H, CENTER_X, CENTER_Y,
  DECORATIONS, FIREFLIES,
} from './setup';
import type { AgentState, BuildingState, Trail } from '../types';

// Import setup to trigger extend() registration
import './setup';

interface PixiVillageProps {
  agents: Map<string, AgentState>;
  buildings: BuildingState[];
  trails: Trail[];
  agentCount: number;
  activeAgentCount: number;
  onAgentClick: (agentId: string) => void;
}

export function PixiVillage({ agents, buildings, trails, agentCount, activeAgentCount, onAgentClick }: PixiVillageProps) {
  const { ready, textures } = useSpriteAssets();
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const frameCount = useRef(0);

  const getBuildingPos = useCallback((id: string) => {
    const b = buildings.find(b => b.id === id);
    return b?.position || { x: 0, y: 0 };
  }, [buildings]);

  // Collect positions from PixiJS children for HTML overlay
  const handlePosition = useCallback((id: string, x: number, y: number) => {
    positionsRef.current.set(id, { x, y });
  }, []);

  // Sync positions to React state at ~15fps for overlay rendering
  const syncPositions = useCallback(() => {
    frameCount.current++;
    if (frameCount.current % 4 === 0) {
      setPositions(new Map(positionsRef.current));
    }
  }, []);

  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-white/30 text-sm animate-pulse">
          Loading village assets...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative" style={{ width: VILLAGE_W, height: VILLAGE_H }}>
        {/* Day/Night atmosphere (behind canvas) */}
        <DayNightCycle agentCount={agentCount} activeAgentCount={activeAgentCount} />

        {/* PixiJS canvas */}
        <Application
          className="absolute inset-0"
          width={VILLAGE_W}
          height={VILLAGE_H}
          backgroundAlpha={0}
          antialias={false}
          resolution={1}
        >
          <PixiScene
            agents={agents}
            buildings={buildings}
            trails={trails}
            textures={textures}
            onAgentClick={onAgentClick}
            onPosition={handlePosition}
            onTick={syncPositions}
          />
        </Application>

        {/* HTML overlay (labels, thought bubbles) */}
        <HtmlOverlay
          agents={agents}
          buildings={buildings}
          positions={positions}
        />

        {/* Quiet village overlay */}
        {agents.size === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 20 }}
          >
            <div className="text-center animate-pulse" style={{ animationDuration: '4s' }}>
              <div className="text-white/20 text-sm font-light tracking-widest">
                The village rests
              </div>
              <div className="text-white/10 text-xs mt-1">
                waiting for dwarves...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inner scene (rendered inside PixiJS Application context) ──

interface PixiSceneProps {
  agents: Map<string, AgentState>;
  buildings: BuildingState[];
  trails: Trail[];
  textures: Map<string, Texture>;
  onAgentClick: (id: string) => void;
  onPosition: (id: string, x: number, y: number) => void;
  onTick: () => void;
}

function PixiScene({ agents, buildings, trails, textures, onAgentClick, onPosition, onTick }: PixiSceneProps) {
  // Sync tick
  useTick(() => onTick());

  const agentArray = Array.from(agents.values());
  const groundTexture = textures.get('ground-tile');

  return (
    <pixiContainer>
      {/* Ground tiles */}
      {groundTexture && (
        <pixiTilingSprite
          texture={groundTexture}
          width={VILLAGE_W}
          height={VILLAGE_H}
          tileScale={{ x: 0.12, y: 0.12 }}
          alpha={0.2}
        />
      )}

      {/* Path lines */}
      <PathLines buildings={buildings} />

      {/* Trail lines */}
      <TrailLines trails={trails} />

      {/* Depth-sorted container for buildings, decorations, agents */}
      <pixiContainer sortableChildren={true}>
        {/* Decorations */}
        {DECORATIONS.map((d, i) => {
          const tex = textures.get(d.sprite);
          if (!tex) return null;
          return (
            <DecoSprite
              key={`deco-${i}`}
              texture={tex}
              x={CENTER_X + d.x}
              y={CENTER_Y + d.y}
              width={d.w}
              sway={!!d.sway}
              idx={i}
            />
          );
        })}

        {/* Buildings */}
        {buildings.map(b => {
          const tex = textures.get(`building-${b.id}`);
          if (!tex) return null;
          return (
            <PixiBuilding
              key={b.id}
              building={b}
              texture={tex}
              onPosition={onPosition}
            />
          );
        })}

        {/* Agents */}
        {agentArray.map(agent => {
          const buildingPos = agent.targetBuilding
            ? (buildings.find(b => b.id === agent.targetBuilding)?.position || { x: 0, y: 0 })
            : { x: 0, y: 0 };
          return (
            <PixiDwarf
              key={agent.id}
              agent={agent}
              buildingPos={buildingPos}
              textures={textures}
              onAgentClick={onAgentClick}
              onPosition={onPosition}
            />
          );
        })}
      </pixiContainer>

      {/* Campfire smoke */}
      <CampfireSmoke cx={CENTER_X} cy={CENTER_Y + 20} />

      {/* Forest fog wisps */}
      <FogWisps />

      {/* Fireflies */}
      <Fireflies />
    </pixiContainer>
  );
}

// ── Path lines between buildings ─────────────────────────

function PathLines({ buildings }: { buildings: BuildingState[] }) {
  return (
    <pixiGraphics
      draw={(g: any) => {
        g.clear();
        const cx = CENTER_X;
        const cy = CENTER_Y + 20; // campfire offset

        for (const b of buildings) {
          if (b.id === 'campfire') continue;
          const bx = CENTER_X + b.position.x;
          const by = CENTER_Y + b.position.y;

          // Draw dotted stone path
          const dx = bx - cx;
          const dy = by - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const nx = dx / dist;
          const ny = dy / dist;
          const dotSpacing = 12;
          const dotRadius = 2.5;

          for (let d = 20; d < dist - 30; d += dotSpacing) {
            const x = cx + nx * d + (Math.sin(d * 0.3) * 2); // slight wobble
            const y = cy + ny * d + (Math.cos(d * 0.4) * 1.5);
            const fade = 1 - Math.abs(d / dist - 0.5) * 0.4; // brighter in middle
            g.circle(x, y, dotRadius);
            g.fill({ color: 0x8b775a, alpha: 0.18 * fade });
          }

          // Wider soft path underneath
          g.moveTo(cx + nx * 20, cy + ny * 20);
          g.lineTo(bx - nx * 30, by - ny * 30);
          g.stroke({ color: 0x6b5a3a, alpha: 0.06, width: 14, cap: 'round' });
        }
      }}
    />
  );
}

// ── Trail lines ──────────────────────────────────────────

function TrailLines({ trails }: { trails: Trail[] }) {
  const now = Date.now();
  return (
    <pixiGraphics
      draw={(g: any) => {
        g.clear();
        for (const t of trails) {
          const age = (now - t.createdAt) / 8000;
          if (age >= 1) continue;
          const alpha = (1 - age) * 0.3;
          const color = parseInt(t.color.replace('#', ''), 16);
          g.moveTo(CENTER_X + t.fromPos.x, CENTER_Y + t.fromPos.y + 50);
          g.lineTo(CENTER_X + t.toPos.x, CENTER_Y + t.toPos.y + 50);
          g.stroke({ color, alpha, width: 2 });
        }
      }}
    />
  );
}

// ── Decoration sprite with optional sway ─────────────────

function DecoSprite({ texture, x, y, width: w, sway, idx }: {
  texture: Texture;
  x: number; y: number; width: number;
  sway: boolean; idx: number;
}) {
  const ref = useRef<any>(null);
  const elapsed = useRef(idx * 1000);

  const scale = w / Math.max(texture.width, texture.height);

  useTick((ticker) => {
    if (!sway || !ref.current) return;
    elapsed.current += ticker.deltaMS;
    ref.current.rotation = Math.sin(elapsed.current * 0.0015) * 0.02;
  });

  return (
    <pixiSprite
      ref={ref}
      texture={texture}
      x={x}
      y={y}
      anchor={{ x: 0.5, y: 0.8 }} // pivot near trunk base
      scale={scale}
      zIndex={y}
    />
  );
}

// ── Ambient fireflies ────────────────────────────────────

function Fireflies() {
  const ref = useRef<any>(null);
  const elapsed = useRef(0);

  useTick((ticker) => {
    elapsed.current += ticker.deltaMS / 1000;
    const g = ref.current;
    if (!g) return;

    g.clear();
    const t = elapsed.current;

    for (const f of FIREFLIES) {
      const phase = t * f.speed * 1000 + f.delay;
      const x = f.x + Math.sin(phase * 0.7) * f.dx;
      const y = f.y + Math.cos(phase * 0.5) * f.dy;
      const alpha = 0.3 + Math.sin(phase) * 0.35;

      g.circle(x, y, 2);
      g.fill({ color: f.color, alpha: Math.max(0, alpha) });
    }
  });

  return <pixiGraphics ref={ref} draw={(g: any) => g.clear()} />;
}

// ── Campfire smoke particles ─────────────────────────────

function CampfireSmoke({ cx, cy }: { cx: number; cy: number }) {
  const ref = useRef<any>(null);
  const elapsed = useRef(0);

  const particles = useRef(
    Array.from({ length: 10 }, (_, i) => ({
      phase: i * 0.6,
      baseX: (i - 4.5) * 4,
      speed: 18 + (i % 4) * 6,
      drift: ((i * 7) % 5) - 2.5,
    })),
  );

  useTick((ticker) => {
    elapsed.current += ticker.deltaMS / 1000;
    const g = ref.current;
    if (!g) return;
    g.clear();
    const t = elapsed.current;

    for (const p of particles.current) {
      const life = ((t + p.phase) % 2.5) / 2.5;
      const x = cx + p.baseX + Math.sin((t + p.phase) * 1.5) * (4 + life * 8) + p.drift * life;
      const y = cy - 30 - life * p.speed;
      const alpha = (1 - life) * 0.15 * (life > 0.1 ? 1 : life / 0.1);
      const size = 3 + life * 8;

      g.circle(x, y, size);
      g.fill({ color: 0x9ca3af, alpha });
    }
  });

  return <pixiGraphics ref={ref} draw={(g: any) => g.clear()} />;
}

// ── Forest fog wisps ─────────────────────────────────────

function FogWisps() {
  const ref = useRef<any>(null);
  const elapsed = useRef(0);

  const wisps = useRef([
    // Top-right forest
    { x: CENTER_X + 340, y: CENTER_Y - 220, w: 120, h: 40 },
    { x: CENTER_X + 300, y: CENTER_Y - 180, w: 100, h: 35 },
    // Bottom-left forest
    { x: CENTER_X - 370, y: CENTER_Y + 260, w: 110, h: 35 },
    { x: CENTER_X - 340, y: CENTER_Y + 290, w: 90, h: 30 },
    // Village ambient
    { x: CENTER_X - 50, y: CENTER_Y + 120, w: 140, h: 25 },
  ]);

  useTick((ticker) => {
    elapsed.current += ticker.deltaMS / 1000;
    const g = ref.current;
    if (!g) return;
    g.clear();
    const t = elapsed.current;

    for (let i = 0; i < wisps.current.length; i++) {
      const w = wisps.current[i];
      const drift = Math.sin(t * 0.15 + i * 2) * 20;
      const breathe = Math.sin(t * 0.3 + i) * 0.5 + 0.5;
      const alpha = 0.03 + breathe * 0.025;

      g.ellipse(w.x + drift, w.y, w.w * (0.8 + breathe * 0.2), w.h);
      g.fill({ color: 0xc9d1d9, alpha });
    }
  });

  return <pixiGraphics ref={ref} draw={(g: any) => g.clear()} />;
}
