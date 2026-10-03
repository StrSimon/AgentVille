import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { Agent, FxEvent } from '../types';
import type { VillageState } from '../state/reducer';
import { BuildingView } from './building-view';
import { Camera } from './camera';
import { DwarfView } from './dwarf-view';
import { buildGround, buildWater } from './ground';
import { iso, type Pt } from './iso';
import {
  ACTIVITY_HOME, BUILDINGS, BUILDING_BY_ID, PLAZA, doorOf, pathTiles, props, slotPos, type BuildingId,
} from './layout';
import { Particles } from './particles';
import { drawProp, lanternLight, propHeight, type PropView } from './props';
import { ShadowLayer, type TreeCaster } from './shadows';
import { Clouds, LightGrade } from './atmosphere';
import { loadSprites, type SpriteSet } from './sprites';
import { usePaintedGround } from './textures';
import { WeatherFx } from './weather';
import { LightLayer, nightFactor, skyGradient, Stars, type TimeMode } from './sky';

export interface WorldCallbacks {
  onSelectAgent: (id: string | null) => void;
  onSelectBuilding: (id: BuildingId) => void;
}

const MAX_OFFLINE = 22;

export class World {
  private app = new Application();
  private camera!: Camera;
  private world = new Container({ label: 'world' });
  private entities = new Container({ label: 'entities', sortableChildren: true });
  private particles = new Particles();
  private lights = new LightLayer();
  private labels = new Container({ label: 'labels' });
  private night = new Graphics();
  private stars = new Stars();
  private water!: Graphics;
  private buildings = new Map<BuildingId, BuildingView>();
  private dwarves = new Map<string, DwarfView>();
  private homes = new Map<string, BuildingId>();
  private trees: Pt[] = [];
  private sway: PropView[] = [];
  private treeCasters: TreeCaster[] = [];
  private shadows = new ShadowLayer();
  private clouds = new Clouds();
  private grade = new LightGrade();
  private tethers = new Graphics();
  readonly weather = new WeatherFx();
  private sprites: SpriteSet = {};
  private lanterns: Array<{ x: number; y: number }> = [];
  private selected: string | null = null;
  private timeMode: TimeMode = 'auto';
  private nightK = 0;
  private t = 0;
  private alert = false;
  private destroyed = false;

  private constructor(private el: HTMLElement, private cb: WorldCallbacks) {}

  static async create(el: HTMLElement, cb: WorldCallbacks): Promise<World> {
    const w = new World(el, cb);
    await w.init();
    return w;
  }

  private async init(): Promise<void> {
    await document.fonts?.ready;
    await this.app.init({
      resizeTo: this.el, antialias: true, backgroundAlpha: 0,
      resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
    });
    if (this.destroyed) { this.app.destroy(true); return; }
    this.el.appendChild(this.app.canvas);
    const sprites: SpriteSet = await loadSprites();
    this.sprites = sprites;

    usePaintedGround(sprites['ground-grass'], sprites['ground-cobble']);
    const paths = pathTiles();
    this.world.addChild(buildGround(paths, sprites.mountains));
    this.water = buildWater();
    this.world.addChild(this.water, this.shadows.container, this.clouds.ground, this.entities, this.tethers, this.particles.container, this.clouds.sky);

    for (const def of BUILDINGS) {
      const view = new BuildingView(def, () => this.onBuildingRebuilt(), sprites);
      view.root.on('pointertap', (e) => {
        e.stopPropagation();
        if (!this.camera.dragged) this.cb.onSelectBuilding(def.id);
      });
      this.buildings.set(def.id, view);
      this.entities.addChild(view.root, ...view.extras);
      this.labels.addChild(view.label);
    }
    props(paths).forEach((p, i) => {
      const view = drawProp(p, i + 1, sprites);
      this.entities.addChild(view.root);
      if (view.canopy) this.sway.push(view);
      if (p.kind === 'lantern') this.lanterns.push(lanternLight(p));
      if (p.kind === 'pine' || p.kind === 'oak') this.trees.push(iso(p.gx, p.gy));
      const h = propHeight(p);
      if (h) {
        const pos = iso(p.gx, p.gy);
        this.treeCasters.push({ kind: 'tree', x: pos.x, y: pos.y, size: p.kind === 'lantern' ? 3 : 15 * p.s, height: h });
      }
    });
    this.onBuildingRebuilt();

    this.app.stage.addChild(this.stars.container, this.world, this.night, this.grade.container, this.lights.container, this.labels, this.weather.flash);
    this.camera = new Camera(this.app, [this.world, this.lights.container, this.labels]);
    this.app.stage.on('pointertap', () => { if (!this.camera.dragged) this.cb.onSelectAgent(null); });
    this.fit(true);
    this.app.renderer.on('resize', () => { this.stars.layout(this.app.screen.width, this.app.screen.height); });
    this.stars.layout(this.app.screen.width, this.app.screen.height);
    this.app.ticker.add((ticker) => this.tick(Math.min(0.05, ticker.deltaMS / 1000)));
  }

  /** Frame the whole island. */
  fit(instant = false): void {
    const { width, height } = this.app.screen;
    const zoom = Math.max(0.5, Math.min(1.25, Math.min(width / 1900, height / 1150)));
    this.camera.focus({ x: 0, y: iso(15.5, 15.5).y - 40 }, zoom, instant);
  }

  setTimeMode(mode: TimeMode): void { this.timeMode = mode; }

  /** Swap the town hall's procedural benches for the painted bench sprite. */
  private paintBenches(view: BuildingView): void {
    const tex = this.sprites.bench;
    if (!tex || view.def.id !== 'townhall') return;
    const { gx, gy, d } = view.def;
    view.extras.forEach((bench, row) => {
      if (!(bench instanceof Graphics) || bench.label === 'painted') return;
      bench.clear();
      bench.label = 'painted';
      const by = gy + d + 1.05 + row * 1.1;
      for (const x of [gx + 0.2, gx + 2.3]) {
        const s = new Sprite(tex);
        s.anchor.set(0.5, 0.85);
        s.scale.set(78 / tex.width);
        const p = iso(x + 0.6, by + 0.2);
        s.position.set(p.x, p.y);
        bench.addChild(s);
      }
    });
  }

  /** A building changed level: re-attach its sortable extras and refresh lights. */
  private onBuildingRebuilt(): void {
    for (const view of this.buildings.values()) {
      this.paintBenches(view);
      for (const e of view.extras) if (!e.parent) this.entities.addChild(e);
    }
    this.rebuildLights();
    if (this.sway.length || this.treeCasters.length) {
      this.shadows.build(
        [...this.buildings.values()].map(v => {
          const c = iso(v.def.gx + v.def.w / 2, v.def.gy + v.def.d / 2);
          return { kind: 'building' as const, def: v.def, height: Math.max(8, c.y - v.art.top - 30) };
        }),
        this.treeCasters,
      );
    }
  }

  private rebuildLights(): void {
    this.lights.clear();
    for (const view of this.buildings.values()) {
      for (const l of view.art.lights) this.lights.add(l, () => view.active);
    }
    for (const p of this.lanterns) this.lights.add({ ...p, radius: 34, color: 0xffd27a, base: 0.75, active: 0, flicker: true });
  }

  /** Reconcile dwarves and buildings with the latest state. */
  sync(state: VillageState): void {
    if (this.destroyed || !this.camera) return;
    for (const b of Object.values(state.buildings)) this.buildings.get(b.id as BuildingId)?.setLevel(b.level);

    const all = Object.values(state.agents);
    const online = all.filter(a => a.online);
    const offline = all.filter(a => !a.online).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_OFFLINE);
    const show = new Set([...online, ...offline].map(a => a.id));

    for (const [id, view] of this.dwarves) {
      if (!show.has(id)) { view.destroy(); this.dwarves.delete(id); this.homes.delete(id); }
    }
    for (const agent of [...online, ...offline]) {
      let view = this.dwarves.get(agent.id);
      if (!view) {
        const start = agent.online ? this.spawnPoint(agent, state) : slotPos(BUILDING_BY_ID.tavern, this.dwarves.size);
        view = new DwarfView(agent, start, (id) => this.cb.onSelectAgent(id), this.sprites);
        this.dwarves.set(agent.id, view);
        this.entities.addChild(view.parts.root);
        this.labels.addChild(view.overlay);
      } else {
        view.setAgent(agent, (id) => this.cb.onSelectAgent(id));
      }
    }
    this.assignHomes();
    this.alert = online.some(a => a.attention && a.attention.kind !== 'done');
  }

  private spawnPoint(agent: Agent, state: VillageState): Pt {
    const parent = agent.parentId ? this.dwarves.get(agent.parentId) : null;
    if (parent) return { ...parent.pos };
    void state;
    return iso(doorOf(BUILDING_BY_ID.gate).gx, doorOf(BUILDING_BY_ID.gate).gy);
  }

  private homeOf(a: Agent): BuildingId {
    if (!a.online) return 'tavern';
    if (a.attention) return 'townhall';
    return ACTIVITY_HOME[a.activity] || 'campfire';
  }

  /** Give every dwarf a stable standing slot and route it there via the plaza. */
  private assignHomes(): void {
    const byHome = new Map<BuildingId, DwarfView[]>();
    for (const v of this.dwarves.values()) {
      const home = this.homeOf(v.agent);
      (byHome.get(home) || byHome.set(home, []).get(home)!).push(v);
    }
    for (const [home, views] of byHome) {
      views.sort((a, b) => a.agent.id.localeCompare(b.agent.id));
      const def = BUILDING_BY_ID[home];
      const alerts = views.filter(v => v.agent.attention && v.agent.attention.kind !== 'done');
      const rest = views.filter(v => !alerts.includes(v));
      alerts.forEach((v, i) => this.route(v, home, iso(def.gx + def.w / 2 + (i - (alerts.length - 1) / 2) * 1.15, def.gy + def.d + 0.75 + (i % 2) * 0.45)));
      rest.forEach((v, i) => this.route(v, home, slotPos(def, i)));
    }
  }

  private route(v: DwarfView, home: BuildingId, slot: Pt): void {
    const prevHome = this.homes.get(v.agent.id);
    const dest = v.destination;
    if (prevHome === home && Math.hypot(dest.x - slot.x, dest.y - slot.y) < 1) return;
    this.homes.set(v.agent.id, home);
    if (!prevHome || prevHome === home) { v.walkTo([slot]); return; }
    const from = doorOf(BUILDING_BY_ID[prevHome]);
    const to = doorOf(BUILDING_BY_ID[home]);
    const plaza = iso(PLAZA.gx + ((v.agent.id.length % 3) - 1) * 0.4, PLAZA.gy + 0.5);
    v.walkTo([iso(from.gx, from.gy), plaza, iso(to.gx, to.gy), slot]);
  }

  fx(e: FxEvent): void {
    if (this.destroyed || !this.camera) return;
    const v = e.agentId ? this.dwarves.get(e.agentId) : null;
    const at = v ? { x: v.pos.x, y: v.pos.y - 24 } : iso(15, 11);
    switch (e.kind) {
      case 'spawn': this.particles.emit('magic', at.x, at.y, 18); break;
      case 'level': this.particles.emit('confetti', at.x, at.y, 40); break;
      case 'achievement': this.particles.emit('confetti', at.x, at.y - 40, 70); break;
      case 'building-level': {
        const b = e.buildingId ? BUILDING_BY_ID[e.buildingId as BuildingId] : null;
        if (b) { const c = iso(b.gx + b.w / 2, b.gy + b.d / 2); this.particles.emit('confetti', c.x, c.y - 60, 60); }
        break;
      }
      case 'failure': this.particles.emit('sparks', at.x, at.y, 14); break;
      case 'order':
      case 'order-delivered': this.particles.emit('magic', at.x, at.y, 12); break;
      case 'decision': this.particles.emit(e.text === 'approved' ? 'coin' : 'sparks', at.x, at.y, 12); break;
      default: break;
    }
  }

  select(id: string | null): void { this.selected = id; }

  focusAgent(id: string): void {
    const v = this.dwarves.get(id);
    if (v) this.camera.focus({ x: v.destination.x, y: v.destination.y - 20 }, Math.max(1.4, this.camera.zoom));
  }

  private tick(dt: number): void {
    this.t += dt;
    const t = this.t;
    this.camera.update(dt);
    if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) {
      this.nightK = nightFactor(new Date(), this.timeMode);
      this.el.style.background = skyGradient(this.nightK, this.weather.level);
    }
    const { width, height } = this.app.screen;
    const storm = this.weather.level;
    const darkness = 1 - (1 - this.nightK * 0.52) * (1 - storm * 0.45);
    this.night.clear().rect(0, 0, width, height).fill({ color: storm > this.nightK ? 0x1c2433 : 0x0a1238, alpha: darkness });
    this.weather.update(dt, t, this.particles, width, height);
    this.stars.update(t, this.nightK);
    this.grade.layout(width, height);
    this.grade.update(this.nightK, storm);
    this.shadows.update(this.nightK);
    this.shadows.container.alpha *= 1 - storm * 0.75;
    this.clouds.update(dt, this.nightK, storm);
    const gust = Math.sin(t * 0.35) * 0.5 + 0.5;
    for (const v of this.sway) v.canopy!.skew.x = Math.sin(t * 1.3 + v.phase) * (0.02 + gust * 0.03);

    // Waiting dwarves take turns speaking so their bubbles never pile up.
    const waiting = [...this.dwarves.values()].filter(v => v.agent.online && v.agent.attention)
      .sort((a, b) => Number(a.agent.attention!.kind === 'done') - Number(b.agent.attention!.kind === 'done') || a.agent.id.localeCompare(b.agent.id));
    const speaker = waiting.length ? waiting[Math.floor(t / 4) % waiting.length] : null;
    const someoneFocused = waiting.some(v => v.hovered || v.agent.id === this.selected);

    const active = new Map<BuildingId, number>();
    for (const v of this.dwarves.values()) {
      const a = v.agent;
      if (a.online && a.activity !== 'idle' && a.activity !== 'waiting' && !a.attention) {
        const home = ACTIVITY_HOME[a.activity];
        active.set(home, (active.get(home) || 0) + 1);
      }
      v.update(dt, t, this.camera.zoom, this.selected === a.id, v === speaker && !someoneFocused);
    }
    for (const [id, view] of this.buildings) {
      view.active = active.get(id) || 0;
      view.update(dt, t, this.particles, id === 'townhall' && this.alert, this.camera.zoom, this.nightK);
    }
    this.drawTethers(t, this.camera.zoom);
    this.lights.update(t, this.nightK);
    this.water.alpha = 0.35 + Math.sin(t * 1.7) * 0.25;
    if (this.nightK > 0.4 && this.trees.length && Math.random() < dt * 3) {
      const tree = this.trees[Math.floor(Math.random() * this.trees.length)];
      this.particles.emit('firefly', tree.x + (Math.random() - 0.5) * 40, tree.y - 20 - Math.random() * 30);
    }
    this.particles.update(dt);
  }

  /** Glowing leash from every online sub-agent to its parent, with data motes flowing along it. */
  private drawTethers(t: number, zoom: number): void {
    const g = this.tethers.clear();
    const k = 1 / Math.max(0.55, Math.min(zoom, 1.4));
    const crew = new Map<string, number>();
    for (const v of this.dwarves.values()) {
      const a = v.agent;
      if (!a.online || a.kind !== 'sub' || !a.parentId) continue;
      const parent = this.dwarves.get(a.parentId);
      if (!parent?.agent.online) continue;
      crew.set(a.parentId, (crew.get(a.parentId) || 0) + 1);
      const from = { x: parent.pos.x, y: parent.pos.y - 30 }, to = { x: v.pos.x, y: v.pos.y - 24 };
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 40 - Math.hypot(to.x - from.x, to.y - from.y) * 0.15 };
      const color = a.source === 'codex' ? 0x34d399 : a.source === 'claude' ? 0xf0915f : 0x93c5fd;
      const bez = (k: number) => ({
        x: (1 - k) ** 2 * from.x + 2 * (1 - k) * k * mid.x + k ** 2 * to.x,
        y: (1 - k) ** 2 * from.y + 2 * (1 - k) * k * mid.y + k ** 2 * to.y,
      });
      g.moveTo(from.x, from.y).quadraticCurveTo(mid.x, mid.y, to.x, to.y).stroke({ width: 11 * k, color, alpha: 0.22 });
      g.moveTo(from.x, from.y).quadraticCurveTo(mid.x, mid.y, to.x, to.y).stroke({ width: 3 * k, color, alpha: 0.95 });
      g.moveTo(from.x, from.y).quadraticCurveTo(mid.x, mid.y, to.x, to.y).stroke({ width: 1 * k, color: 0xffffff, alpha: 0.55 });
      for (const end of [from, to]) g.circle(end.x, end.y, 3.5 * k).fill(color).stroke({ width: 1.2 * k, color: 0xffffff, alpha: 0.8 });
      for (let m = 0; m < 3; m++) {
        const p = bez(((t * 0.45 + m / 3) % 1));
        g.circle(p.x, p.y, 7 * k).fill({ color, alpha: 0.35 }).circle(p.x, p.y, 3.2 * k).fill({ color: 0xffffff, alpha: 0.95 });
      }
    }
    for (const v of this.dwarves.values()) v.crew = crew.get(v.agent.id) || 0;
  }

  destroy(): void {
    this.destroyed = true;
    if (!this.camera) return;
    this.camera.destroy();
    this.app.destroy(true, { children: true });
  }
}
