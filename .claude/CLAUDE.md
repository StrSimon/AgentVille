# AgentVille

## Automatic Activity Tracking

This project uses **Claude Code hooks** to automatically track agent activity.
You do NOT need to send manual heartbeats — everything is handled by `.claude/hooks/agentville-hook.sh`.

The hook fires on every tool use and maps tools to activities:
- `Edit`, `Write`, `NotebookEdit` → **coding** (Forge)
- `Read`, `Glob`, `Grep`, `WebFetch`, `WebSearch` → **researching** (Library)
- `Bash` with test commands → **testing** (Arena)
- `Task`, `EnterPlanMode`, `TodoWrite` → **planning** (Guild)
- Everything else → **coding** (Forge)

Sub-agents are automatically registered when spawned via `SubagentStart` hooks.
Finished sub-agents despawn immediately via `SubagentStop` hooks.
Agents auto-despawn after 2 minutes of inactivity as a fallback.

**Dashboard:** http://localhost:5173
**Bridge API:** http://localhost:4242

## Project

- **Runtime:** Node.js (npm)
- **Frontend:** React 19 + Tailwind CSS 3 + Framer Motion 11
- **Bridge server:** Pure Node.js, zero dependencies (`server/bridge.mjs`)
- **Dev:** `npm run dev` (Vite on port 5173), `npm run bridge` (port 4242)
- **Tests:** `node --test server/bridge.test.mjs`
