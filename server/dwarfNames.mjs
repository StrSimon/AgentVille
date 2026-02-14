// ── Dwarf Name Generator ─────────────────────────────────
// Generates epic-sounding fantasy dwarf names from Norse-inspired
// syllable combinations. All original — no copyrighted names.
//
// Uses deterministic hashing so the same agentId always gets
// the same name within a server session.

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

// Simple string hash → stable number
function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Track assigned names to avoid duplicates in a session
const assigned = new Map();   // agentId → dwarfName
const usedNames = new Set();

/**
 * Get a dwarf name for an agent. Same agentId always returns
 * the same name within a server session.
 */
export function getDwarfName(agentId) {
  if (assigned.has(agentId)) {
    return assigned.get(agentId);
  }

  const h = hashStr(agentId);
  let pi = h % PREFIXES.length;
  let si = (h >>> 8) % SUFFIXES.length;

  // Try to find an unused combination, stepping through options
  let name = PREFIXES[pi] + SUFFIXES[si];
  let attempts = 0;
  const maxAttempts = PREFIXES.length * SUFFIXES.length;

  while (usedNames.has(name) && attempts < maxAttempts) {
    si = (si + 1) % SUFFIXES.length;
    if (si === 0) pi = (pi + 1) % PREFIXES.length;
    name = PREFIXES[pi] + SUFFIXES[si];
    attempts++;
  }

  assigned.set(agentId, name);
  usedNames.add(name);
  return name;
}

/**
 * Release a name when an agent despawns so it can be reused.
 */
export function releaseName(agentId) {
  const name = assigned.get(agentId);
  if (name) {
    assigned.delete(agentId);
    usedNames.delete(name);
  }
}

/**
 * Get total possible unique combinations.
 */
export function totalNames() {
  return PREFIXES.length * SUFFIXES.length;
}

// Export lists for testing
export { PREFIXES, SUFFIXES, hashStr };
