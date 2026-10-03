import type { Container, FederatedPointerEvent, Application } from 'pixi.js';
import type { Pt } from './iso';

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.6;

/** Pan (drag) + zoom (wheel/pinch) camera that drives several world-space layers. */
export class Camera {
  x = 0; y = 0; zoom = 1;
  private target = { x: 0, y: 0, zoom: 1 };
  private drag: { x: number; y: number; cx: number; cy: number } | null = null;
  private moved = 0;
  private pointers = new Map<number, Pt>();
  private pinchDist = 0;

  constructor(private app: Application, private layers: Container[]) {
    const stage = app.stage;
    stage.eventMode = 'static';
    stage.hitArea = app.screen;
    stage.on('pointerdown', this.onDown);
    stage.on('pointerup', this.onUp);
    stage.on('pointerupoutside', this.onUp);
    stage.on('globalpointermove', this.onMove);
    app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** True if the last pointer interaction was a drag (so taps can be ignored). */
  get dragged(): boolean { return this.moved > 6; }

  private onDown = (e: FederatedPointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
    this.drag = { x: e.global.x, y: e.global.y, cx: this.target.x, cy: this.target.y };
    this.moved = 0;
  };

  private onUp = (e: FederatedPointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.drag = null;
  };

  private onMove = (e: FederatedPointerEvent) => {
    if (!this.drag) return;
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinchDist);
      this.pinchDist = d;
      return;
    }
    const dx = e.global.x - this.drag.x, dy = e.global.y - this.drag.y;
    this.moved = Math.max(this.moved, Math.hypot(dx, dy));
    this.target.x = this.drag.cx + dx;
    this.target.y = this.drag.cy + dy;
    this.x = this.target.x;
    this.y = this.target.y;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
  };

  zoomAt(sx: number, sy: number, factor: number): void {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.target.zoom * factor));
    const k = z / this.target.zoom;
    this.target.x = sx - (sx - this.target.x) * k;
    this.target.y = sy - (sy - this.target.y) * k;
    this.target.zoom = z;
  }

  /** Center a world point on screen. */
  focus(p: Pt, zoom = this.target.zoom, instant = false): void {
    this.target.zoom = zoom;
    this.target.x = this.app.screen.width / 2 - p.x * zoom;
    this.target.y = this.app.screen.height / 2 - p.y * zoom;
    if (instant) { this.x = this.target.x; this.y = this.target.y; this.zoom = zoom; }
  }

  update(dt: number): void {
    const k = Math.min(1, dt * 7);
    this.x += (this.target.x - this.x) * k;
    this.y += (this.target.y - this.y) * k;
    this.zoom += (this.target.zoom - this.zoom) * k;
    for (const l of this.layers) {
      l.position.set(this.x, this.y);
      l.scale.set(this.zoom);
    }
  }

  destroy(): void {
    this.app.canvas.removeEventListener('wheel', this.onWheel);
  }
}
