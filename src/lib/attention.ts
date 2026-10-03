// Make waiting dwarves impossible to miss: tab title badge, favicon dot,
// optional desktop notifications and a sound — even when the tab is in the background.
import type { Agent } from '../types';
import { sound } from './sound';

const BASE_TITLE = 'AgentVille';
let seen = new Map<string, string>();
let faviconHref: string | null = null;

function setFavicon(count: number): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  faviconHref ||= link.href;
  if (!count) { link.href = faviconHref; return; }
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const img = new Image();
  img.onload = () => {
    if (!x) return;
    x.drawImage(img, 0, 0, 64, 64);
    x.fillStyle = '#fb4f6b';
    x.beginPath();
    x.arc(48, 16, 15, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#fff';
    x.font = 'bold 22px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(count > 9 ? '9+' : String(count), 48, 17);
    link.href = c.toDataURL('image/png');
  };
  img.src = faviconHref;
}

export function notificationsAllowed(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function requestNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** Call whenever the list of dwarves needing the user changes. */
export function announce(waiting: Agent[], onClick: (id: string) => void): void {
  const blocked = waiting.filter(a => a.attention?.kind !== 'done').length;
  document.title = waiting.length ? `(${waiting.length}) ${blocked ? '❗' : '💤'} ${BASE_TITLE}` : BASE_TITLE;
  setFavicon(waiting.length);

  const next = new Map<string, string>();
  for (const a of waiting) {
    const key = `${a.attention?.kind}:${a.attention?.since}`;
    next.set(a.id, key);
    if (seen.get(a.id) === key) continue;
    const blocking = a.attention?.kind !== 'done';
    if (blocking) sound.attention(); else sound.done();
    if (notificationsAllowed() && document.hidden) {
      const n = new Notification(blocking ? `${a.name} needs you` : `${a.name} is done`, {
        body: blocking ? (a.attention?.text || 'Waiting for your approval') : `Waiting for your next task${a.project ? ` · ${a.project}` : ''}`,
        tag: `agentville-${a.id}`,
        silent: true,
      });
      n.onclick = () => { window.focus(); onClick(a.id); n.close(); };
    }
  }
  seen = next;
}
