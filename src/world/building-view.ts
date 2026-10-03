import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { iso, TW } from './iso';
import type { BuildingDef, BuildingId } from './layout';
import type { ArtCtx, ArtResult } from './art-types';
import { arena, campfire, forge, guild, library, tavern, townhall, well } from './art-a';
import { apothecary, gate, mine, observatory, post, scriptorium, tower } from './art-b';
import type { Particles } from './particles';
import { SPRITE_FIT, type SpriteSet } from './sprites';

const ART: Record<BuildingId, (ctx: ArtCtx) => ArtResult> = {
  townhall, campfire, guild, forge, arena, tavern, well, library,
  scriptorium, observatory, tower, post, mine, gate, apothecary,
};

const FONT = 'Geist Variable, system-ui, sans-serif';

export class BuildingView {
  readonly root = new Container({ label: 'building' });
  readonly extras: Container[] = [];
  art!: ArtResult;
  level = 0;
  active = 0;
  private plate = new Container();
  private plateText = new Text({ text: '', style: { fontFamily: FONT, fontSize: 12, fontWeight: '600', fill: 0xece6d6, letterSpacing: 0.3 } });
  private plateBg = new Graphics();
  private pulse = new Graphics();
  private lit = new Graphics();
  private acc: number[] = [];
  private hovered = false;

  private texture?: Texture;
  private glow?: Sprite;

  constructor(readonly def: BuildingDef, private onLayerChange: () => void, private sprites: SpriteSet = {}) {
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
    this.root.on('pointerover', () => { this.hovered = true; });
    this.root.on('pointerout', () => { this.hovered = false; });
    this.plateText.resolution = 2;
    this.plateText.anchor.set(0.5);
    this.plate.addChild(this.plateBg, this.plateText);
    this.plate.eventMode = 'none';
    this.setLevel(1);
  }

  setLevel(level: number): void {
    if (level === this.level) return;
    this.level = level;
    for (const child of this.root.removeChildren()) if (child !== this.pulse) child.destroy({ children: true });
    for (const e of this.extras) e.destroy({ children: true });
    this.extras.length = 0;
    const g = new Graphics();
    this.lit = new Graphics();
    // painted upgrade tiers: level 4+ and 7+ show a grander version of the building
    const tier = level >= 7 && this.sprites[`${this.def.id}-t3`] ? `${this.def.id}-t3`
      : level >= 4 && this.sprites[`${this.def.id}-t2`] ? `${this.def.id}-t2` : this.def.id;
    this.texture = this.sprites[tier];
    this.glow = undefined;
    if (this.texture) {
      // Painted sprite: keep the procedural art only for its lights, emitters and extras.
      this.art = ART[this.def.id]({ g: new Graphics(), lit: new Graphics(), b: this.def, level, add: () => {} });
      const painted = this.paintedSprite(level);
      this.root.addChild(this.pulse, painted);
      const glowTex = this.sprites[`${tier}-glow`];
      if (glowTex) {
        // lit windows and fires from the painted art, faded in at night
        this.glow = new Sprite(glowTex);
        this.glow.anchor.set(0.5, 1);
        this.glow.position.copyFrom(painted.position);
        this.glow.scale.set(painted.scale.x * (painted.texture.width / glowTex.width));
        this.glow.blendMode = 'add';
        this.glow.alpha = 0;
        this.root.addChild(this.glow);
      }
    } else {
      this.root.addChild(this.pulse, g, this.lit);
      this.art = ART[this.def.id]({ g, lit: this.lit, b: this.def, level, add: (c) => this.root.addChild(c) });
    }
    this.extras.push(...(this.art.extras || []));
    this.acc = this.art.emitters.map(() => Math.random());
    // Sort by footprint center: dwarves at the door (in front) draw over the building.
    this.root.zIndex = iso(this.def.gx + this.def.w / 2, this.def.gy + this.def.d / 2).y;
    const center = iso(this.def.gx + this.def.w / 2, this.def.gy + this.def.d / 2);
    this.plate.position.set(center.x, this.art.top);
    this.setPlate();
    this.onLayerChange();
  }

  private paintedSprite(level: number): Sprite {
    const d = this.def;
    const sprite = new Sprite(this.texture!);
    const fit = SPRITE_FIT[d.id] || { width: 1.25 };
    const footprint = (d.w + d.d) * (TW / 2);
    // buildings grow a little as they level up
    const scale = (footprint * fit.width * (1 + Math.min(level - 1, 9) * 0.015)) / sprite.texture.width;
    sprite.scale.set(scale);
    sprite.anchor.set(0.5, 1);
    const center = iso(d.gx + d.w / 2, d.gy + d.d / 2);
    const front = iso(d.gx + d.w, d.gy + d.d);
    sprite.position.set(center.x, front.y + 6 + (fit.lift ?? 0));
    this.art = { ...this.art, top: Math.min(this.art.top, sprite.y - sprite.height + 10) };
    return sprite;
  }

  /** The floating name plate lives in the label layer (above dwarves). */
  get label(): Container { return this.plate; }

  private setPlate(): void {
    this.plateText.text = `${this.def.name}  ·  ${this.level}`;
    const w = this.plateText.width + 18;
    this.plateBg.clear().roundRect(-w / 2, -10, w, 20, 10).fill({ color: 0x0b1020, alpha: 0.72 }).stroke({ width: 1, color: this.def.glow, alpha: 0.5 });
  }

  update(dt: number, t: number, particles: Particles, alert: boolean, zoom: number, night: number): void {
    this.art.animate?.(t, this.active);
    // windows glow at dusk/night, a little brighter while dwarves work inside
    this.lit.alpha = Math.min(1, night * 1.15 + (this.active ? 0.15 : 0)) * (0.92 + Math.sin(t * 3 + this.def.gx) * 0.04);
    if (this.glow) this.glow.alpha = Math.min(1, night * 1.3 + (this.active ? 0.12 : 0)) * (0.85 + Math.sin(t * 4 + this.def.gy) * 0.08);
    this.art.emitters.forEach((e, i) => {
      if (e.whenActive && !this.active) return;
      this.acc[i] += dt * e.rate * (e.whenActive ? Math.min(2, 0.6 + this.active * 0.4) : 1);
      while (this.acc[i] >= 1) { this.acc[i] -= 1; particles.emit(e.kind, e.x, e.y); }
    });
    // Plates fade when zoomed out, pop when hovered or busy
    const target = this.hovered ? 1 : this.active ? 0.95 : zoom > 0.75 ? 0.55 : 0;
    this.plate.alpha += (target - this.plate.alpha) * Math.min(1, dt * 8);
    this.plate.scale.set(Math.min(1.6, 1 / Math.max(zoom, 0.6)));
    // Town hall pulses red while someone waits for you
    this.pulse.clear();
    if (alert || (this.active && this.def.id !== 'campfire')) {
      const c = iso(this.def.gx + this.def.w / 2, this.def.gy + this.def.d / 2);
      const k = (t * (alert ? 1.2 : 0.6)) % 1;
      const color = alert ? 0xfb4f6b : this.def.glow;
      const r = (this.def.w + this.def.d) * 22 * (0.8 + k * 0.6);
      this.pulse.ellipse(c.x, c.y, r, r / 2).stroke({ width: 2.5, color, alpha: (1 - k) * (alert ? 0.9 : 0.35) });
    }
  }
}
