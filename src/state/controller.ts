import type { Settings } from '../types';
import { store } from './store';

export interface SetupStatus {
  claude: { detected: boolean; installed: boolean; current: boolean };
  codex: { detected: boolean; installed: boolean; current: boolean };
}

export interface RequestAnswer {
  decision?: 'allow' | 'deny';
  message?: string;
  answers?: Record<string, string>;
  release?: boolean;
}

/** Everything the UI can ask the village to do. Live → HTTP, demo → in-browser village. */
export interface Controller {
  mode: 'live' | 'demo';
  respond(requestId: string, answer: RequestAnswer): Promise<boolean>;
  sendOrder(agentId: string, text: string): Promise<boolean>;
  setLeash(agentId: string, on: boolean): Promise<boolean>;
  dismiss(agentId: string): Promise<boolean>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  setupStatus(): Promise<SetupStatus | null>;
  setup(targets?: Array<'claude' | 'codex'>): Promise<{ installed: string[]; notes: string[] } | null>;
  stop(): void;
}

export type ConnectionState = 'connecting' | 'online' | 'offline';

const connListeners = new Set<() => void>();
let connection: ConnectionState = 'connecting';

export const connectionStore = {
  get: (): ConnectionState => connection,
  subscribe: (fn: () => void): (() => void) => { connListeners.add(fn); return () => connListeners.delete(fn); },
};

function setConnection(c: ConnectionState): void {
  connection = c;
  for (const fn of connListeners) fn();
}

function token(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="agentville-token"]')?.content || '';
}

async function call<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, body === undefined
      ? { headers: { 'x-agentville-token': token() } }
      : {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-agentville-token': token() },
        body: JSON.stringify(body),
      });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Is a bridge reachable from this page (served by it, or proxied in dev)? */
export async function bridgeAvailable(): Promise<boolean> {
  const health = await call<{ name: string }>('/api/health');
  return health?.name === 'agentville';
}

export function createLiveController(): Controller {
  store.reset();
  setConnection('connecting');
  const es = new EventSource('/events');
  es.onopen = () => setConnection('online');
  es.onerror = () => setConnection(es.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
  es.onmessage = (ev) => {
    try { store.dispatch(JSON.parse(ev.data)); } catch { /* ignore malformed frame */ }
  };

  return {
    mode: 'live',
    respond: async (id, answer) => !!(await call<{ ok: boolean }>(`/api/requests/${id}`, answer))?.ok,
    sendOrder: async (id, text) => !!(await call<{ ok: boolean }>(`/api/agents/${id}/orders`, { text }))?.ok,
    setLeash: async (id, on) => !!(await call<{ ok: boolean }>(`/api/agents/${id}/leash`, { on }))?.ok,
    dismiss: async (id) => !!(await call<{ ok: boolean }>(`/api/agents/${id}/dismiss`, {}))?.ok,
    saveSettings: async (patch) => { await call('/api/settings', patch); },
    setupStatus: () => call<SetupStatus>('/api/setup'),
    setup: (targets) => call('/api/setup', { targets }),
    stop: () => { es.close(); setConnection('offline'); },
  };
}
