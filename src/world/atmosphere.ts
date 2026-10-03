// Clouds drifting over the island (with their shadows on the ground) and a
// screen-space light grade: warm sun from the upper left, cool shade and a vignette.
import { Container, FillGradient, Graphics, Sprite } from 'pixi.js';
import { iso } from './iso';
import { softDot } from './particles';

interface Cloud { body: Container; shadow: Container; x: number; y: number; speed: number }

const SPAN = { minX: -1300, maxX: 1300 };

function puff(count: number, w: number, tint: number, alpha: number): Container {
  const c = new Container();
  for (let i = 0; i < count; i++) {
    const s = new Sprite(softDot());
    s.anchor.set(0.5);
    s.tint = tint;
    s.alpha = alpha;
    const k = 0.6 + Math.random() * 0.6;
    s.width = w * k;
    s.height = w * k * 0.55;
    s.position.set((Math.random() - 0.5) * w * 1.3, (Math.random() - 0.5) * w * 0.25);
    c.addChild(s);
  }
  return c;
}

export class Clouds {
  readonly sky = new Container({ label: 'clouds' });
  readonly ground = new Container({ label: 'cloud-shadows' });
  private clouds: Cloud[] = [];

  constructor(count = 6) {
    const center = iso(15.5, 15.5);
    for (let i = 0; i < count; i++) {
      const w = 160 + Math.random() * 140;
      const body = puff(7, w, 0xffffff, 0.42);
      const shadow = puff(5, w * 0.9, 0x0a1020, 0.16);
      const cloud = {
        body, shadow,
        x: SPAN.minX + Math.random() * (SPAN.maxX - SPAN.minX),
        y: center.y - 420 + Math.random() * 700,
        speed: 6 + Math.random() * 8,
      };
      this.sky.addChild(body);
      this.ground.addChild(shadow);
      this.clouds.push(cloud);
    }
  }

  update(dt: number, night: number): void {
    this.sky.alpha = 0.38 * (1 - night * 0.7);
    this.ground.alpha = 1 - night;
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > SPAN.maxX) c.x = SPAN.minX;
      // clouds float high: their shadow lands down-right of them
      c.body.position.set(c.x, c.y - 260);
      c.shadow.position.set(c.x + 120, c.y + 40);
      // only cast cloud shadows onto the island, never into the open sky
      const center = iso(15.5, 15.5);
      const k = Math.hypot((c.shadow.x - center.x) / 640, (c.shadow.y - center.y) / 330);
      c.shadow.alpha = Math.max(0, Math.min(1, (1 - k) * 4));
    }
  }
}

/** Full-screen light grade: sunlight, ambient tint and vignette (screen space). */
export class LightGrade {
  readonly container = new Container({ label: 'grade' });
  private sun = new Graphics();
  private vignette = new Graphics();
  private w = 0;
  private h = 0;

  constructor() {
    this.container.addChild(this.sun, this.vignette);
    this.container.eventMode = 'none';
  }

  layout(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const sunGrad = new FillGradient({
      type: 'radial',
      center: { x: 0.12, y: 0.0 }, innerRadius: 0,
      outerCenter: { x: 0.12, y: 0.0 }, outerRadius: 1.05,
      colorStops: [
        { offset: 0, color: 'rgba(255,214,150,0.30)' },
        { offset: 0.5, color: 'rgba(255,214,150,0.06)' },
        { offset: 1, color: 'rgba(255,214,150,0)' },
      ],
    });
    this.sun.clear().rect(0, 0, w, h).fill(sunGrad);
    this.sun.blendMode = 'add';
    const vig = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.45 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.45 }, outerRadius: 0.78,
      colorStops: [
        { offset: 0, color: 'rgba(5,8,22,0)' },
        { offset: 0.7, color: 'rgba(5,8,22,0)' },
        { offset: 1, color: 'rgba(5,8,22,0.38)' },
      ],
    });
    this.vignette.clear().rect(0, 0, w, h).fill(vig);
  }

  update(night: number): void {
    // golden hour is warmest; at night the sun glow fades out
    const dusk = 1 - Math.abs(night - 0.4) / 0.4;
    this.sun.alpha = Math.max(0, 1 - night) * 0.9 + Math.max(0, dusk) * 0.6;
    this.sun.tint = dusk > 0 ? 0xffb070 : 0xffffff;
    this.vignette.alpha = 0.55 + night * 0.45;
  }
}
