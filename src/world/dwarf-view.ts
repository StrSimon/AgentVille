import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { Agent } from '../types';
import { buildDwarf, TOOL_FOR, type DwarfParts, type Tool } from './dwarf-art';
import { hash, type Pt } from './iso';
import { SOURCE_COLOR } from './layout';
import { bored, clock, needs, speak, story } from './phrases';

const FONT = 'Geist Variable, system-ui, sans-serif';
type Pose = 'walk' | 'work' | 'alert' | 'bored' | 'idle' | 'sleep';

function label(size: number, weight = '600', fill = 0xece6d6): Text {
  const t = new Text({ text: '', style: { fontFamily: FONT, fontSize: size, fontWeight: weight as '600', fill } });
  t.resolution = 2;
  return t;
}

export class DwarfView {
  parts: DwarfParts;
  readonly overlay = new Container({ label: 'dwarf-overlay' });
  pos: Pt;
  private route: Pt[] = [];
  private pose: Pose = 'idle';
  private seed: number;
  private speed: number;
  private tag = label(11);
  private tagBg = new Graphics();
  private bubble = new Container();
  private bubbleBg = new Graphics();
  private bubbleText = label(11, '500', 0x1c1917);
  private bubbleUntil = 0;
  private marker = new Container();
  private markerBg = new Graphics();
  private markerTimer = label(11, '700');
  private nextChatter = 0;
  private builtLevel: number;
  private builtSource: string;
  hovered = false;

  constructor(public agent: Agent, start: Pt, onSelect: (id: string) => void) {
    this.seed = hash(agent.id);
    this.speed = agent.kind === 'sub' ? 92 : 74;
    this.pos = { ...start };
    this.builtLevel = agent.level;
    this.builtSource = agent.source;
    this.parts = buildDwarf(agent.id, agent.source, agent.level, agent.kind === 'sub');
    this.wire(onSelect);
    this.tag.anchor.set(0.5, 0);
    this.bubbleText.anchor.set(0.5);
    this.bubbleText.style.wordWrap = true;
    this.bubbleText.style.wordWrapWidth = 180;
    this.bubble.addChild(this.bubbleBg, this.bubbleText);
    const bang = label(15, '800');
    bang.text = '!';
    bang.anchor.set(0.5);
    this.markerTimer.anchor.set(0.5, 0);
    this.markerTimer.style.stroke = { color: 0x0b1020, width: 3.5, join: 'round' };
    this.markerTimer.position.set(0, 12);
    this.marker.addChild(this.markerBg, bang, this.markerTimer);
    this.overlay.addChild(this.tagBg, this.tag, this.bubble, this.marker);
    this.overlay.eventMode = 'none';
    this.bubble.visible = false;
    this.marker.visible = false;
  }

  private wire(onSelect: (id: string) => void): void {
    const r = this.parts.root;
    r.eventMode = 'static';
    r.cursor = 'pointer';
    r.hitArea = new Rectangle(-12, -46, 24, 50);
    r.on('pointertap', (e) => { e.stopPropagation(); onSelect(this.agent.id); });
    r.on('pointerover', () => { this.hovered = true; });
    r.on('pointerout', () => { this.hovered = false; });
  }

  /** Rebuild the sprite if level/source changed (new helmet trim, cape…). */
  setAgent(agent: Agent, onSelect: (id: string) => void): boolean {
    const prev = this.agent;
    this.agent = agent;
    if (agent.level !== this.builtLevel || agent.source !== this.builtSource) {
      const parent = this.parts.root.parent;
      const z = this.parts.root.zIndex;
      this.parts.root.destroy({ children: true });
      this.parts = buildDwarf(agent.id, agent.source, agent.level, agent.kind === 'sub');
      this.wire(onSelect);
      this.parts.root.zIndex = z;
      parent?.addChild(this.parts.root);
      this.builtLevel = agent.level;
      this.builtSource = agent.source;
    }
    if (agent.detail !== prev.detail || agent.activity !== prev.activity) {
      if (agent.online && agent.activity !== 'idle' && agent.activity !== 'waiting') {
        this.say(speak(agent.activity, agent.detail, hash(agent.detail) + this.seed), 4500);
      }
    }
    if (agent.failure && agent.failure.at !== prev.failure?.at) this.say(`Blast! ${agent.failure.text}`, 5000, true);
    return true;
  }

  walkTo(route: Pt[]): void {
    this.route = route;
  }

  get destination(): Pt {
    return this.route.length ? this.route[this.route.length - 1] : this.pos;
  }

  private say(text: string, ms: number, danger = false): void {
    this.bubbleUntil = performance.now() + ms;
    this.drawBubble(text, danger ? 0xfecdd3 : 0xfdf6e3);
  }

  private bubbleKey = '';
  private markerKey = '';

  private drawBubble(text: string, fill: number): void {
    this.bubble.visible = true;
    const key = `${text}|${fill}`;
    if (key === this.bubbleKey) return;
    this.bubbleKey = key;
    this.bubbleText.text = text;
    const w = Math.min(196, this.bubbleText.width + 16), h = this.bubbleText.height + 10;
    this.bubbleBg.clear()
      .roundRect(-w / 2, -h / 2, w, h, 8).fill(fill).stroke({ width: 1, color: 0x000000, alpha: 0.2 })
      .poly([-5, h / 2 - 1, 5, h / 2 - 1, 0, h / 2 + 6]).fill(fill);
  }

  private drawMarker(color: number, timer: string): void {
    this.marker.visible = true;
    const key = `${color}|${timer}`;
    if (key === this.markerKey) return;
    this.markerKey = key;
    this.markerBg.clear().circle(0, 0, 10).fill(color).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
    this.markerTimer.text = timer;
    this.markerTimer.style.fill = color;
  }

  /** `spotlight`: this dwarf may show its speech bubble now (waiting dwarves take turns). */
  update(dt: number, t: number, zoom: number, selected: boolean, spotlight = true): void {
    const a = this.agent;
    const p = this.parts;
    const now = Date.now();

    // movement
    let moving = false;
    if (this.route.length) {
      const next = this.route[0];
      const dx = next.x - this.pos.x, dy = next.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt * (a.online ? 1 : 0.5);
      if (dist <= step) { this.pos = { ...next }; this.route.shift(); } else {
        this.pos.x += (dx / dist) * step;
        this.pos.y += (dy / dist) * step;
        p.body.scale.x = dx < 0 ? -1 : 1;
      }
      moving = true;
    }
    p.root.position.set(this.pos.x, this.pos.y);
    p.root.zIndex = this.pos.y;

    const attention = a.online ? a.attention : null;
    this.pose = moving ? 'walk'
      : !a.online ? 'sleep'
        : attention && attention.kind !== 'done' ? 'alert'
          : attention?.kind === 'done' || a.activity === 'waiting' ? 'bored'
            : a.activity === 'idle' ? 'idle' : 'work';

    this.animate(t, now);
    p.root.alpha += ((a.online ? 1 : 0.62) - p.root.alpha) * Math.min(1, dt * 4);

    // ground ring: red pulse when blocked, amber when selected, soft when bored
    p.ring.clear();
    if (this.pose === 'alert') {
      const k = (t * 1.4) % 1;
      p.ring.ellipse(0, 0, 12 + k * 16, (12 + k * 16) / 2).stroke({ width: 2.5, color: 0xfb4f6b, alpha: 1 - k });
      p.ring.ellipse(0, 0, 11, 5.5).fill({ color: 0xfb4f6b, alpha: 0.35 });
    } else if (this.pose === 'bored') {
      p.ring.ellipse(0, 0, 13, 6.5).stroke({ width: 1.5, color: 0xfbbf24, alpha: 0.5 + Math.sin(t * 2) * 0.25 });
    }
    if (selected) p.ring.ellipse(0, 0, 15, 7.5).stroke({ width: 2, color: 0xf59e0b, alpha: 0.95 });

    this.updateOverlay(t, now, zoom, selected, attention, spotlight);
  }

  private animate(t: number, now: number): void {
    const p = this.parts;
    const s = this.seed % 100;
    const tool: Tool = this.pose === 'work' ? TOOL_FOR[this.agent.activity] : 'none';
    for (const [name, g] of Object.entries(p.tools)) g.visible = name === tool;
    p.legL.visible = p.legR.visible = true;
    p.body.y = 0;
    p.head.rotation = 0;
    p.head.y = 0;
    p.mouth.visible = false;
    p.armBack.rotation = 0;
    p.legL.rotation = p.legR.rotation = 0;

    switch (this.pose) {
      case 'walk': {
        const k = Math.sin(t * 14 + s);
        p.legL.rotation = k * 0.5;
        p.legR.rotation = -k * 0.5;
        p.armFront.rotation = -k * 0.4;
        p.armBack.rotation = k * 0.4;
        p.body.y = -Math.abs(Math.sin(t * 14 + s)) * 1.6;
        break;
      }
      case 'work': {
        const act = this.agent.activity;
        const swing = act === 'coding' || act === 'installing' || act === 'testing';
        const speed = act === 'testing' ? 12 : 9;
        p.armFront.rotation = swing ? -2.2 + Math.max(0, Math.sin(t * speed + s)) * 2 : -0.9 + Math.sin(t * 3 + s) * 0.15;
        p.body.y = swing ? -Math.max(0, Math.sin(t * speed + s)) : 0;
        p.head.rotation = act === 'researching' || act === 'writing' ? 0.12 : 0;
        break;
      }
      case 'alert': {
        // hand up, bouncing on the toes — clearly asking for you
        p.armFront.rotation = -2.8 + Math.sin(t * 8) * 0.35;
        p.body.y = -Math.abs(Math.sin(t * 5)) * 2.5;
        break;
      }
      case 'bored': {
        // sitting on the bench: legs out, foot tapping, looking around, yawning
        p.body.y = 4;
        p.legL.rotation = -1.3;
        p.legR.rotation = -1.3 + Math.max(0, Math.sin(t * 9 + s)) * 0.35;
        p.armFront.rotation = 0.5;
        p.armBack.rotation = -0.4;
        const cycle = (t + s) % 9;
        if (cycle < 1.4) { p.mouth.visible = true; p.head.rotation = -0.22; p.head.y = -0.8; }
        p.body.scale.x = Math.floor((t + s) / 4.5) % 2 ? -1 : 1;
        break;
      }
      case 'idle': {
        p.body.y = 3;
        p.legL.rotation = p.legR.rotation = -1.2;
        p.armFront.rotation = -0.7 + Math.sin(t * 1.5 + s) * 0.1;
        break;
      }
      case 'sleep': {
        p.body.y = 4;
        p.legL.rotation = p.legR.rotation = -1.25;
        p.head.rotation = 0.35;
        p.armFront.rotation = 0.3;
        break;
      }
    }
    if (this.pose === 'bored' && now > this.nextChatter) {
      this.nextChatter = now + 9000 + (this.seed % 5000);
      this.say(bored(Math.floor(now / 9000) + this.seed), 3800);
    }
    if (this.pose === 'idle' && now > this.nextChatter) {
      this.nextChatter = now + 16000 + (this.seed % 9000);
      if (Math.random() < 0.5) this.say(story(Math.floor(now / 7000) + this.seed), 4200);
    }
  }

  private updateOverlay(t: number, now: number, zoom: number, selected: boolean, attention: Agent['attention'], spotlight: boolean): void {
    const a = this.agent;
    const o = this.overlay;
    const scale = Math.min(1.7, Math.max(0.75, 1 / zoom));
    o.position.set(this.pos.x, this.pos.y);
    o.scale.set(scale);
    const headY = (this.parts.root.scale.y * -48) / scale;

    // name tag
    const showTag = a.online || this.hovered || selected;
    this.tag.visible = this.tagBg.visible = showTag;
    if (showTag) {
      const text = `${a.name} · ${a.level}`;
      if (this.tag.text !== text) this.tag.text = text;
      this.tag.position.set(0, 6 / scale);
      const w = this.tag.width + 16;
      this.tagBg.clear()
        .roundRect(-w / 2, 4 / scale - 1, w, 16, 8).fill({ color: 0x0b1020, alpha: 0.72 })
        .circle(-w / 2 + 7, 4 / scale + 7, 2.6).fill(SOURCE_COLOR[a.source] ?? 0xffffff);
      this.tag.x = 3;
    }

    // attention marker with live timer — always visible; the speech bubble takes
    // turns with other waiting dwarves (staggered by seed) so bubbles never pile up.
    if (attention && a.online) {
      const waited = clock(now - attention.since);
      const blocking = attention.kind !== 'done';
      this.drawMarker(blocking ? 0xfb4f6b : 0xf59e0b, waited);
      this.marker.children[1].visible = blocking;
      this.marker.position.set(0, headY - 30);
      this.marker.scale.set(1 + Math.sin(t * 6) * (blocking ? 0.1 : 0.03));
      if (this.hovered || selected || spotlight) {
        const text = !blocking
          ? (attention.leashed ? '⚓ Waiting for orders' : '💤 Done – waiting for you')
          : attention.kind === 'question'
            ? `❓ ${attention.text || 'has a question'}`
            : `${needs(this.seed)}${attention.text ? ` · ${attention.text}` : ''}`;
        this.drawBubble(text, blocking ? 0xffe4e6 : 0xfef3c7);
        this.bubble.position.set(0, headY - 58);
      } else {
        this.bubble.visible = false;
      }
      return;
    }
    this.marker.visible = false;
    if (this.bubble.visible && now > this.bubbleUntil) this.bubble.visible = false;
    if (this.bubble.visible) this.bubble.position.set(0, headY - 14);
    if (!a.online && this.hovered) this.drawBubble('Zzz… (resting)', 0xe5e7eb);
  }

  destroy(): void {
    this.parts.root.destroy({ children: true });
    this.overlay.destroy({ children: true });
  }
}
