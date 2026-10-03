// Makes working dwarves readable at a glance: an activity badge over the head,
// activity-colored motes and tool sparks timed to the swing.
import { Container, Graphics, Text } from 'pixi.js';
import type { Activity } from '../types';
import { ACTIVITY_META } from '../ui/activity-meta';
import type { ParticleKind, Particles } from './particles';

const FONT = 'Geist Variable, system-ui, sans-serif';

export const WORK_ICON: Record<Activity, string> = {
  planning: '🗺️', delegating: '📯', coding: '⚒️', writing: '🪶', testing: '⚔️', debugging: '🧪',
  researching: '📖', browsing: '🔭', reviewing: '👁️', committing: '📜', installing: '⛏️',
  deploying: '🚀', waiting: '⏳', remembering: '💭', idle: '🔥',
};

/** Activities animated as a hammer-like swing (effects burst on each strike). */
export const SWING = new Set<Activity>(['coding', 'installing', 'testing']);

/** Strike effect per swinging activity; everything else streams colored motes. */
const STRIKE: Partial<Record<Activity, ParticleKind>> = { coding: 'sparks', testing: 'sparks', installing: 'smoke' };

export const activityColor = (a: Activity): number => parseInt(ACTIVITY_META[a].color.slice(1), 16);

/** Pill over a working dwarf's head: icon + what it is doing, in the activity color. */
export class WorkBadge {
  readonly container = new Container({ label: 'work-badge' });
  private bg = new Graphics();
  private icon = new Text({ text: '', style: { fontSize: 13 } });
  private text = new Text({ text: '', style: { fontFamily: FONT, fontSize: 10.5, fontWeight: '700', fill: 0xfdf6e3 } });
  private key = '';

  constructor() {
    this.icon.anchor.set(0.5);
    this.icon.resolution = this.text.resolution = 2;
    this.text.anchor.set(0, 0.5);
    this.container.addChild(this.bg, this.icon, this.text);
  }

  /** `compact`: icon only (another dwarf at the same building shows the label). */
  draw(activity: Activity, compact = false): void {
    const key = `${activity}|${compact}`;
    if (key === this.key) return;
    this.key = key;
    const color = activityColor(activity);
    this.icon.text = WORK_ICON[activity];
    this.text.text = ACTIVITY_META[activity].label;
    this.text.visible = !compact;
    const w = compact ? 22 : this.text.width + 34, h = 20;
    this.bg.clear()
      .roundRect(-w / 2, -h / 2, w, h, 10).fill({ color: 0x0b1020, alpha: 0.82 }).stroke({ width: 1.5, color, alpha: 0.95 })
      .circle(-w / 2 + 11, 0, 8).fill({ color, alpha: 0.35 });
    this.icon.position.set(-w / 2 + 11, 0.5);
    this.text.position.set(-w / 2 + 23, 0);
  }
}

/** Emits a dwarf's work effects; `strike` is true on the frame the tool lands. */
export function emitWork(particles: Particles, activity: Activity, x: number, y: number, dt: number, strike: boolean): void {
  const color = activityColor(activity);
  const kind = STRIKE[activity];
  if (kind && strike) {
    particles.emit(kind, x, y, kind === 'smoke' ? 2 : 6);
    particles.emit('mote', x, y, 2, color);
    return;
  }
  if (!kind && Math.random() < dt * 5) particles.emit('mote', x + (Math.random() - 0.5) * 10, y, 1, color);
}
