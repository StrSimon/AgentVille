import { Container, Graphics, Sprite } from 'pixi.js';
import type { Light } from './art-types';
import { softDot } from './particles';

export type TimeMode = 'auto' | 'day' | 'night';

/** 0 = full day, 1 = deep night, based on the local clock. */
export function nightFactor(date = new Date(), mode: TimeMode = 'auto'): number {
  if (mode === 'day') return 0;
  if (mode === 'night') return 1;
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 7 && h < 18) return 0;
  if (h >= 18 && h < 21) return (h - 18) / 3;
  if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
  return 1;
}

const DAY_TOP = [0x5aa2e6, 0xcde6f8];
const NIGHT_TOP = [0x060a1c, 0x1a1f45];
const DUSK = [0x3b2a5c, 0xf0905a];

function lerpColor(a: number, b: number, t: number): string {
  const c = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}

/** CSS gradient for the sky behind the canvas. */
export function skyGradient(night: number): string {
  const duskK = 1 - Math.abs(night - 0.45) / 0.45;
  const blend = (i: number) => {
    const base = lerpColor(DAY_TOP[i], NIGHT_TOP[i], night);
    if (duskK <= 0) return base;
    return lerpColor(i === 0 ? DAY_TOP[0] : DAY_TOP[1], DUSK[i], Math.max(0, duskK) * 0.8);
  };
  return night > 0.2 && night < 0.75
    ? `linear-gradient(180deg, ${blend(0)} 0%, ${blend(1)} 100%)`
    : `linear-gradient(180deg, ${lerpColor(DAY_TOP[0], NIGHT_TOP[0], night)} 0%, ${lerpColor(DAY_TOP[1], NIGHT_TOP[1], night)} 100%)`;
}

/** Stars in screen space. */
export class Stars {
  readonly container = new Container({ label: 'stars' });
  private dots: Array<{ g: Graphics; phase: number }> = [];

  layout(width: number, height: number): void {
    this.container.removeChildren().forEach(c => c.destroy());
    this.dots = [];
    const count = Math.round((width * height) / 9000);
    for (let i = 0; i < count; i++) {
      const g = new Graphics().circle(0, 0, Math.random() < 0.1 ? 1.4 : 0.8).fill(0xffffff);
      g.position.set(Math.random() * width, Math.random() * height * 0.75);
      this.container.addChild(g);
      this.dots.push({ g, phase: Math.random() * 10 });
    }
  }

  update(t: number, night: number): void {
    this.container.visible = night > 0.05;
    for (const d of this.dots) d.g.alpha = night * (0.45 + 0.55 * Math.abs(Math.sin(t * 0.8 + d.phase)));
  }
}

/** Additive light sprites in world space (windows, fires, lanterns). */
export class LightLayer {
  readonly container = new Container({ label: 'lights' });
  private sprites: Array<{ s: Sprite; light: Light; getActive: () => number; phase: number }> = [];

  add(light: Light, getActive: () => number = () => 0): void {
    const s = new Sprite(softDot());
    s.anchor.set(0.5);
    s.position.set(light.x, light.y);
    s.tint = light.color;
    s.blendMode = 'add';
    s.width = s.height = light.radius * 2;
    s.scale.y *= 0.7;
    this.container.addChild(s);
    this.sprites.push({ s, light, getActive, phase: Math.random() * 10 });
  }

  clear(): void {
    this.container.removeChildren().forEach(c => c.destroy());
    this.sprites = [];
  }

  update(t: number, night: number): void {
    for (const { s, light, getActive, phase } of this.sprites) {
      const active = getActive() > 0 ? light.active : 0;
      const flicker = light.flicker ? 0.85 + Math.sin(t * 11 + phase) * 0.08 + Math.sin(t * 27 + phase) * 0.07 : 1;
      // lights still glow a little by day when something is happening
      s.alpha = Math.min(1, (night * (light.base + active) + active * 0.35) * flicker);
    }
  }
}
