// ── Transcript watcher: tokens & cost per dwarf ──────────

import { parseClaudeLine, parseCodexLine, parseCodexLimits } from './usage.mjs';
import { recordUsage, statsDTO } from './profiles.mjs';

const INGEST_THROTTLE_MS = 4000;

/**
 * @param {{ data: any, rts: Map<string, any>, now: () => number, emit: Function,
 *   pushAgent: (id: string) => void, getPrices: () => any,
 *   readTranscript: (path: string, cursor: { offset: number }) => any[],
 *   onLimits?: (source: string, limits: any) => void }} ctx
 */
export function createTranscriptWatcher(ctx) {
  /** path → { owner, seen, codex, lastIngest, source } */
  const transcripts = new Map();

  function watch(path, owner) {
    const t = transcripts.get(path);
    if (t) { t.owner = owner; return; }
    // The cursor is persisted so a bridge restart never counts tokens twice.
    const cursors = (ctx.data.cursors ||= {});
    const cursor = (cursors[path] ||= { offset: 0, codex: {} });
    transcripts.set(path, { owner, seen: new Set(), cursor, lastIngest: 0, source: ctx.data.agents[owner]?.source });
  }

  function ingest(path, force = false) {
    const t = path && transcripts.get(path);
    if (!t || !ctx.data.agents[t.owner]) return;
    if (!force && ctx.now() - t.lastIngest < INGEST_THROTTLE_MS) return;
    t.lastIngest = ctx.now();
    let lines;
    t.cursor.lastRead = ctx.now();
    try { lines = ctx.readTranscript(path, t.cursor) || []; } catch { return; }
    let added = 0;
    const rt = ctx.rts.get(t.owner);
    let limits = null;
    for (const entry of lines) {
      if (t.source === 'codex') limits = parseCodexLimits(entry) || limits;
      const rec = t.source === 'codex' ? parseCodexLine(entry, t.cursor.codex ||= {}) : parseClaudeLine(entry, t.seen);
      if (!rec) continue;
      // Book usage at the time it happened (backfilled sessions keep an honest burn history)
      const at = rec.at && rec.at <= ctx.now() ? rec.at : ctx.now();
      added += recordUsage(ctx.data, t.owner, { model: rec.model, usage: rec.usage, project: rt?.project, now: at, prices: ctx.getPrices() });
      if (rt) rt.model = rec.model;
    }
    if (limits) ctx.onLimits?.('codex', limits);
    if (added > 0) {
      ctx.pushAgent(t.owner);
      ctx.emit({ type: 'stats', stats: statsDTO(ctx.data, ctx.now()) });
    }
  }

  function ingestFor(id, force) {
    for (const [path, t] of transcripts) if (t.owner === id) ingest(path, force);
  }

  return { watch, ingest, ingestFor };
}
