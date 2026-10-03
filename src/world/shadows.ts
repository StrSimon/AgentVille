// Cast shadows from the sun (upper left → shadows fall right and slightly down).
import { Container, Graphics } from 'pixi.js';
import { iso, type Pt } from './iso';
import type { BuildingDef } from './layout';

/** Screen offset of a shadow per pixel of object height. */
const SUN = { x: 0.62, y: 0.2 };

function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper: Pt[] = [];
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export interface Caster { kind: 'building'; def: BuildingDef; height: number }
export interface TreeCaster { kind: 'tree'; x: number; y: number; size: number; height: number }

/** Static shadow layer, rendered once to a texture so overlaps don't double up. */
export class ShadowLayer {
  readonly container = new Container({ label: 'shadows' });
  private g = new Graphics();

  constructor() {
    this.container.addChild(this.g);
  }

  build(buildings: Caster[], trees: TreeCaster[]): void {
    const g = this.g.clear();
    for (const { def, height } of buildings) {
      const pad = def.id === 'campfire' || def.id === 'well' ? 0.15 : 0;
      const corners = [
        iso(def.gx + pad, def.gy + pad), iso(def.gx + def.w - pad, def.gy + pad),
        iso(def.gx + def.w - pad, def.gy + def.d - pad), iso(def.gx + pad, def.gy + def.d - pad),
      ];
      const h = Math.min(height, 150);
      const tops = corners.map(c => ({ x: c.x + h * SUN.x, y: c.y + h * SUN.y }));
      const shape = hull([...corners, ...tops]);
      g.poly(shape.flatMap(p => [p.x, p.y])).fill(0x050816);
    }
    for (const t of trees) {
      const len = t.height * SUN.x;
      g.ellipse(t.x + len * 0.55, t.y + t.height * SUN.y * 0.5, t.size + len * 0.45, t.size * 0.45).fill(0x050816);
    }
    this.container.cacheAsTexture(false);
    this.container.cacheAsTexture(true);
  }

  /** Shadows fade at night (no sun) and are softest at dusk. */
  update(night: number): void {
    this.container.alpha = 0.26 * (1 - night * 0.85);
  }
}
