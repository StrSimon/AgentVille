# AgentVille

Mission control for Claude Code + Codex agents, rendered as an isometric dwarf village.

## Layout

- `server/core/` — isomorphic village logic (no Node imports): classify, roster, profiles/stats, pricing, transcripts, approvals. Used by the bridge AND the browser demo (`src/state/demo.ts`).
- `server/http.mjs` — bridge (zero deps): `/api/hook`, `/events` (SSE), control endpoints (token in `x-agentville-token`), serves `dist/`.
- `server/setup.mjs` — installs the global hook launcher (`~/.agentville/hook/run.sh|cmd`) into `~/.claude/settings.json` and `~/.codex/hooks.json`, taps the Claude status line for plan limits.
- `hook/agentville-hook.mjs` — the only hook; `claude` | `codex` | `statusline` modes.
- `bin/agentville.mjs` — CLI (`npx agent-ville`).
- `desktop/` — Electron shell (tray, notifications).
- `src/world/` — PixiJS v8 world; `src/ui/` — React 19 + Tailwind 4 HUD.
- `.claude/hooks/agentville-hook.sh` — compatibility shim for pre-2.0 configs; forwards to the Node hook.

## Commands

- Tests: `npm test` (server `node --test`, client `vitest run`)
- Typecheck/build: `npm run build`
- Dev: `npm run bridge` + `npm run dev` (Vite proxies to :4242)
- Isolated manual testing: `AGENTVILLE_HOME=<tmp> node bin/agentville.mjs start --port=4311 --no-open --no-setup`, then `/?demo` or feed hooks with `AGENTVILLE_PORT=4311 node hook/agentville-hook.mjs claude < payload.json`

## Conventions

- Never let the hook block or fail an agent: exit 0 silently on any error.
- Hook outputs must match the Codex schemas exactly (`additionalProperties: false`).
- Production files < 300 lines (hard limit 500).
