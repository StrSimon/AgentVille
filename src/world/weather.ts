// Weather driven by the "mood" (how close you are to your plan limits):
// rain thickens as the end approaches, lightning strikes right before it.
import { Graphics } from 'pixi.js';
import type { Particles } from './particles';
import { iso } from './iso';

export class WeatherFx {
  /** smoothed 0..1 */
  level = 0;
  private target = 0;
  private rainAcc = 0;
  private nextBolt = 0;
  private flashK = 0;
  readonly flash = new Graphics();
  onThunder: (strength: number) => void = () => {};

  setTarget(level: number): void { this.target = Math.max(0, Math.min(1, level)); }

  /** Rain intensity 0..1 (for sound and visuals). */
  get rain(): number { return Math.max(0, (this.level - 0.55) / 0.45); }

  update(dt: number, t: number, particles: Particles, screenW: number, screenH: number): void {
    // ease towards the target over a few seconds so changes feel like weather, not a switch
    this.level += (this.target - this.level) * Math.min(1, dt * 0.35);
    const center = iso(15.5, 15.5);
    const rate = this.rain * 520;
    this.rainAcc += rate * dt;
    while (this.rainAcc >= 1) {
      this.rainAcc -= 1;
      particles.emit('rain', center.x + (Math.random() - 0.5) * 2100, center.y - 700 + Math.random() * 1500);
    }
    // lightning in a storm
    if (this.level > 0.85 && t > this.nextBolt) {
      this.nextBolt = t + 5 + Math.random() * 9;
      this.flashK = 0.55 + Math.random() * 0.3;
      setTimeout(() => this.onThunder(this.flashK), 300 + Math.random() * 900);
    }
    this.flashK = Math.max(0, this.flashK - dt * 2.2);
    this.flash.clear();
    if (this.flashK > 0.01) {
      const flicker = this.flashK * (0.75 + Math.random() * 0.25);
      this.flash.rect(0, 0, screenW, screenH).fill({ color: 0xe8f0ff, alpha: flicker * 0.6 });
    }
  }
}
