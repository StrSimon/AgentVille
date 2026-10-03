// ── Dwarf Name Generator ─────────────────────────────────
// Norse-inspired syllable combinations. All original — no copyrighted names.
// Pure and deterministic: the same id always yields the same name unless
// that name is already taken, in which case we step to the next free combo.

export const PREFIXES = [
  'Grim',   'Stein',  'Brok',   'Thar',   'Dun',
  'Gor',    'Hald',   'Krag',   'Vorn',   'Drak',
  'Mund',   'Narg',   'Bald',   'Ruk',    'Gund',
  'Thur',   'Dolg',   'Svar',   'Arn',    'Bran',
  'Hjal',   'Ragn',   'Fjol',   'Skjal',  'Brund',
  'Vald',   'Hrod',   'Grond',  'Durak',  'Tholg',
];

export const SUFFIXES = [
  'in',     'dur',    'rik',    'mund',   'born',
  'gar',    'nar',    'rok',    'mir',    'din',
  'bor',    'grim',   'mar',    'vir',    'thak',
  'drin',   'gor',    'vald',   'stein',  'brak',
  'nir',    'thar',   'gruk',   'mord',   'rad',
];

/** djb2 string hash → unsigned 32-bit int */
export function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function totalNames() {
  return PREFIXES.length * SUFFIXES.length;
}

/**
 * Deterministic dwarf name for an id, avoiding names in `taken`.
 * @param {string} id
 * @param {Set<string>} [taken]
 */
export function dwarfName(id, taken = new Set()) {
  const h = hashStr(id);
  const total = totalNames();
  let idx = (h % PREFIXES.length) * SUFFIXES.length + ((h >>> 8) % SUFFIXES.length);
  for (let i = 0; i < total; i++) {
    const name = PREFIXES[Math.floor(idx / SUFFIXES.length)] + SUFFIXES[idx % SUFFIXES.length];
    if (!taken.has(name)) return name;
    idx = (idx + 1) % total;
  }
  // Every combination is taken — append a numeric suffix
  return PREFIXES[h % PREFIXES.length] + SUFFIXES[(h >>> 8) % SUFFIXES.length] + (h % 1000);
}
