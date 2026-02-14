// ── Client-side Dwarf Name Generator ─────────────────────
// Mirrors server/dwarfNames.mjs for demo mode.
// Generates epic Norse-inspired dwarf names from syllable combos.

const PREFIXES = [
  'Grim',   'Stein',  'Brok',   'Thar',   'Dun',
  'Gor',    'Hald',   'Krag',   'Vorn',   'Drak',
  'Mund',   'Narg',   'Bald',   'Ruk',    'Gund',
  'Thur',   'Dolg',   'Svar',   'Arn',    'Bran',
  'Hjal',   'Ragn',   'Fjol',   'Skjal',  'Brund',
  'Vald',   'Hrod',   'Grond',  'Durak',  'Tholg',
];

const SUFFIXES = [
  'in',     'dur',    'rik',    'mund',   'born',
  'gar',    'nar',    'rok',    'mir',    'din',
  'bor',    'grim',   'mar',    'vir',    'thak',
  'drin',   'gor',    'vald',   'stein',  'brak',
  'nir',    'thar',   'gruk',   'mord',   'rad',
];

function hashStr(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

const assigned = new Map<string, string>();
const usedNames = new Set<string>();

export function getDwarfName(agentId: string): string {
  if (assigned.has(agentId)) {
    return assigned.get(agentId)!;
  }

  const h = hashStr(agentId);
  let pi = h % PREFIXES.length;
  let si = (h >>> 8) % SUFFIXES.length;

  let name = PREFIXES[pi] + SUFFIXES[si];
  let attempts = 0;
  const max = PREFIXES.length * SUFFIXES.length;

  while (usedNames.has(name) && attempts < max) {
    si = (si + 1) % SUFFIXES.length;
    if (si === 0) pi = (pi + 1) % PREFIXES.length;
    name = PREFIXES[pi] + SUFFIXES[si];
    attempts++;
  }

  assigned.set(agentId, name);
  usedNames.add(name);
  return name;
}

export function releaseDwarfName(agentId: string): void {
  const name = assigned.get(agentId);
  if (name) {
    assigned.delete(agentId);
    usedNames.delete(name);
  }
}
