import { Container, Sprite, Texture } from 'pixi.js';

export type ParticleKind = 'smoke' | 'sparks' | 'fire' | 'bubbles' | 'magic' | 'confetti' | 'coin' | 'firefly' | 'portal' | 'rain';

interface Particle {
  sprite: Sprite;
  vx: number; vy: number;
  life: number; max: number;
  kind: ParticleKind;
  size: number;
  spin: number;
}

let softTexture: Texture | null = null;

/** A soft round dot used for every particle and light (generated once). */
export function softDot(): Texture {
  if (softTexture) return softTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  softTexture = Texture.from(c);
  return softTexture;
}

const CONFETTI = [0xf59e0b, 0xfb4f6b, 0x34d399, 0x60a5fa, 0xe879f9, 0xfde047];

/** Pooled particle system living in world space. */
export class Particles {
  readonly container = new Container({ label: 'particles' });
  private live: Particle[] = [];
  private pool: Sprite[] = [];

  emit(kind: ParticleKind, x: number, y: number, count = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.live.length > 1400) return;
      const sprite = this.pool.pop() || new Sprite(softDot());
      sprite.anchor.set(0.5);
      sprite.position.set(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 3);
      sprite.visible = true;
      sprite.blendMode = kind === 'smoke' ? 'normal' : 'add';
      const p = this.spawn(kind, sprite);
      this.container.addChild(sprite);
      this.live.push(p);
    }
  }

  private spawn(kind: ParticleKind, sprite: Sprite): Particle {
    const r = Math.random;
    const base = { sprite, kind, spin: 0, life: 0 };
    switch (kind) {
      case 'smoke':
        sprite.tint = 0xb8b4ae;
        return { ...base, vx: 4 + r() * 6, vy: -14 - r() * 8, max: 3.2 + r() * 1.5, size: 0.28 };
      case 'sparks':
        sprite.tint = r() < 0.5 ? 0xffb347 : 0xfff1a8;
        return { ...base, vx: (r() - 0.5) * 70, vy: -40 - r() * 50, max: 0.5 + r() * 0.4, size: 0.07 };
      case 'fire':
        sprite.tint = r() < 0.5 ? 0xff7a1a : 0xffc24a;
        return { ...base, vx: (r() - 0.5) * 10, vy: -26 - r() * 18, max: 0.6 + r() * 0.4, size: 0.3 };
      case 'bubbles':
        sprite.tint = 0xa3e635;
        return { ...base, vx: (r() - 0.5) * 8, vy: -16 - r() * 10, max: 1 + r() * 0.6, size: 0.1 };
      case 'magic':
        sprite.tint = r() < 0.5 ? 0x67e8f9 : 0xc4b5fd;
        return { ...base, vx: (r() - 0.5) * 16, vy: -20 - r() * 14, max: 1.4 + r(), size: 0.09 };
      case 'portal':
        sprite.tint = r() < 0.5 ? 0xc084fc : 0xf0abfc;
        return { ...base, vx: (r() - 0.5) * 30, vy: -50 - r() * 40, max: 1 + r() * 0.6, size: 0.1 };
      case 'confetti':
        sprite.tint = CONFETTI[Math.floor(r() * CONFETTI.length)];
        sprite.blendMode = 'normal';
        return { ...base, vx: (r() - 0.5) * 120, vy: -90 - r() * 80, max: 1.6 + r(), size: 0.09, spin: (r() - 0.5) * 10 };
      case 'coin':
        sprite.tint = 0xfcd34d;
        return { ...base, vx: (r() - 0.5) * 20, vy: -60 - r() * 20, max: 1.1, size: 0.12 };
      case 'rain':
        sprite.tint = 0xdfeaff;
        sprite.blendMode = 'normal';
        sprite.rotation = 0.22;
        return { ...base, vx: -150, vy: 720 + r() * 160, max: 0.55 + r() * 0.35, size: 0.04 };
      case 'firefly':
        sprite.tint = 0xd9f99d;
        return { ...base, vx: (r() - 0.5) * 10, vy: (r() - 0.5) * 6, max: 4 + r() * 3, size: 0.1 };
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) {
        p.sprite.visible = false;
        this.container.removeChild(p.sprite);
        this.pool.push(p.sprite);
        this.live.splice(i, 1);
        continue;
      }
      const gravity = p.kind === 'sparks' || p.kind === 'confetti' || p.kind === 'coin' ? 160 : 0;
      p.vy += gravity * dt;
      if (p.kind === 'firefly') { p.vx += (Math.random() - 0.5) * 20 * dt; p.vy += (Math.random() - 0.5) * 20 * dt; }
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      const grow = p.kind === 'smoke' ? 1 + k * 2.2 : p.kind === 'fire' ? 1 - k * 0.7 : 1;
      if (p.kind === 'rain') { p.sprite.scale.set(0.035, 0.5); p.sprite.alpha = 0.85 * (1 - k * 0.6); continue; }
      p.sprite.scale.set(p.size * grow, p.kind === 'confetti' ? p.size * 0.5 : p.size * grow);
      const fade = p.kind === 'firefly' ? Math.sin(k * Math.PI) * (0.6 + 0.4 * Math.sin(p.life * 6)) : Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k);
      p.sprite.alpha = (p.kind === 'smoke' ? 0.38 : 1) * fade;
    }
  }
}
