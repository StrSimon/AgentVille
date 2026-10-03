// Which painted look a dwarf gets: stable per dwarf, apprentices for sub-agents.
import type { Agent } from '../types';

const LOOKS = {
  claude: ['claude', 'claude-b', 'claude-c'],
  codex: ['codex', 'codex-b', 'codex-c'],
} as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Sprite key, e.g. "claude-b" → dwarf-claude-b-stand.webp; "codex-apprentice" for Codex sub-agents. */
export function dwarfLook(agent: Pick<Agent, 'id' | 'source' | 'kind'>): string {
  const clan = agent.source === 'claude' ? 'claude' : 'codex';
  if (agent.kind === 'sub') return `${clan}-apprentice`;
  const looks = LOOKS[clan];
  return looks[hash(agent.id) % looks.length];
}

/** Portrait file for a dwarf (apprentices borrow their clan's first portrait). */
export function portraitUrl(agent: Pick<Agent, 'id' | 'source' | 'kind'>): string {
  const look = dwarfLook(agent);
  const clan = look.startsWith('claude') ? 'claude' : 'codex';
  const letter = look.endsWith('-b') ? 'b' : look.endsWith('-c') ? 'c' : 'a';
  return `/art/portraits/portrait-${clan}-${look.includes('apprentice') ? 'a' : letter}.webp`;
}
