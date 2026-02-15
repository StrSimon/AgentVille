# AgentVille

[![Tests](https://github.com/StrSimon/AgentVille/actions/workflows/test.yml/badge.svg)](https://github.com/StrSimon/AgentVille/actions/workflows/test.yml) ![Coverage](https://img.shields.io/badge/coverage-98%25-brightgreen) ![Node.js](https://img.shields.io/badge/node-%3E%3D18-blue)

Watch your AI agents work as villagers in an isometric village. Like `htop`, but as a city-builder game.

**Live demo:** [agent-ville.vercel.app](https://agent-ville.vercel.app/)

## Quick Start

Three steps to see your agents in the village:

### 1. Clone & install

```bash
git clone https://github.com/StrSimon/AgentVille.git
cd AgentVille
npm install
```

### 2. Start the bridge

```bash
npm run bridge
```

The bridge is a tiny local server (port 4242) that receives heartbeats from Claude Code and pushes them to the dashboard.

### 3. Connect your Claude Code sessions

**Option A — per project:**

```bash
npm run connect /path/to/your/project
```

**Option B — all sessions globally:**

```bash
npm run connect:global
```

Every Claude Code session on your machine will report to the village. Requires `jq`.

```bash
npm run connect:global -- --uninstall   # To remove
```

### 4. Open the dashboard

Use the hosted version at **[agent-ville.vercel.app](https://agent-ville.vercel.app/)** — it connects to your local bridge automatically.

Or run it locally:

```bash
npm run dev      # http://localhost:5173
```

Or start both bridge and dashboard at once:

```bash
npm start        # Bridge (4242) + Dashboard (5173)
```

## Activities & Buildings

| Activity      | Building        | Triggered by                          |
| ------------- | --------------- | ------------------------------------- |
| `planning`    | Architect Guild | Task, TodoWrite, EnterPlanMode        |
| `coding`      | The Forge       | Edit, Write, most Bash commands       |
| `testing`     | The Arena       | Bash with test/jest/pytest/vitest/... |
| `researching` | The Library     | Read, Glob, Grep, WebFetch, WebSearch |
| `reviewing`   | Watchtower      | (future: PR review tools)             |
| `idle`        | Town Square     | Agent waiting between tasks           |

## Features

- **Isometric village** with animated dwarf agents moving between buildings
- **PixiJS-powered pixel art view** — toggle with `V` for a hardware-accelerated dwarf village with forests, fireflies, and particle effects
- **Dwarf-themed speech bubbles** showing what each agent is working on
- **Level system** — agents gain XP from tool calls and earn titles (Apprentice, Journeyman, Smith, ... Mythical)
- **Persistent profiles** — agent stats, XP, and activity history survive bridge restarts
- **Resident directory** — view all agents that have ever visited the village
- **Activity timeline** — bottom panel showing recent events
- **Agent stats panel** — click an agent for detailed stats (token usage, activity breakdown)
- **Sub-agent tracking** — agents spawned via the Task tool appear as linked child villagers
- **Day/night cycle** — atmospheric lighting that changes with activity level
- **Sound effects** — optional synth sounds for spawn, despawn, and movement
- **Demo mode** — simulated agents for testing without a running Claude Code session

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Toggle classic / pixel village view |
| `M` | Toggle sound |
| `T` | Toggle activity timeline |
| `D` | Toggle Demo/Live mode |

## Demo Mode

Click **Demo** in the top-right corner to see simulated village activity without a running Claude Code session.

## How It Works

```
Claude Code hooks ──heartbeat──> Bridge (4242) ──SSE──> Dashboard (5173)
```

A small shell hook fires on every Claude Code tool use, classifies it as an activity, and sends a heartbeat to the bridge server. The bridge pushes events to the dashboard via Server-Sent Events. No heartbeat for 2 minutes = villager despawns.

Sub-agents (via the Task tool) are automatically registered as separate villagers linked to their parent.

## API

For custom integrations beyond Claude Code:

```bash
# Simple heartbeat
curl -s -X POST http://localhost:4242/api/heartbeat \
  -H 'Content-Type: application/json' \
  -d '{"agent":"My Agent","activity":"coding","detail":"App.tsx"}'
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/heartbeat` | POST | Agent check-in (`{ agent, activity, detail }`) |
| `/api/event` | POST | Raw lifecycle events (spawn, work, despawn) |
| `/events` | GET | SSE stream (dashboard subscribes here) |
| `/api/status` | GET | Current agent state |
| `/api/leaderboard` | GET | All-time agent profiles sorted by XP |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTVILLE_PORT` | `4242` | Bridge server port |
| `VITE_BRIDGE_URL` | `http://localhost:4242` | Bridge URL for the dashboard |

## Project Structure

```
src/                          # React frontend (Vite + Tailwind + Framer Motion)
  App.tsx                     # Main orchestrator
  components/                 # Village, Building, AgentAvatar, ThoughtBubble, ...
  pixi/                       # PixiJS village view (sprites, particles, animations)
  hooks/                      # useBridge (SSE), useSound, useKeyboard
  simulator.ts                # Demo mode event generator
server/
  bridge.mjs                  # HTTP server (zero deps) — SSE + REST API
  agentStore.mjs              # Persistent JSON store for agent profiles
  dwarfNames.mjs              # Deterministic dwarf name generator
  data/agents.json            # Agent database (auto-created)
.claude/
  hooks/agentville-hook.sh    # Claude Code hook script
  settings.local.json         # Hook configuration
bin/
  connect.sh                  # Per-project hook installer
  connect-global.sh           # Global hook installer
public/sprites/               # Pixel art assets (buildings, dwarves, props)
```

## Testing

```bash
npm test                # Run all 147 tests (server + client)
npm run test:server     # Server tests only (Node.js native runner)
npm run test:client     # Frontend tests only (Vitest)
npm run test:coverage   # Full suite with server coverage report
```

**Server tests** use Node.js native test runner (`node:test`) — zero external deps. **Frontend tests** use Vitest + testing-library.

| Layer | Module | Lines | Branches |
|-------|--------|-------|----------|
| Server | `agentStore.mjs` | 98% | 95% |
| Server | `bridge.mjs` | 93% | 69% |
| Server | `dwarfNames.mjs` | 100% | 100% |
| Client | `simulator.ts`, `types.ts`, `dwarfNames.ts` | tested | — |
| Client | `useKeyboard` hook | tested | — |
| Client | `SessionStats`, `ThoughtBubble` | tested | — |

## Tech Stack

- **Frontend:** React 19 + Tailwind CSS 3 + Framer Motion 11 + PixiJS 8
- **Bridge:** Pure Node.js (zero dependencies)
- **Protocol:** HTTP + SSE
- **Tests:** Node.js native runner (server) + Vitest (client)
- **Hosting:** Vercel (frontend only — bridge always runs locally)

## Browser Notes

The hosted dashboard at [agent-ville.vercel.app](https://agent-ville.vercel.app/) connects to your local bridge over `http://localhost:4242`. This works out of the box in most browsers. If you use **Brave**, you may need to disable Shields for the site (the shield icon in the address bar) to allow the connection.

## Contributing

AgentVille is an open-source side project and contributions are very welcome! Whether it's a bug report, feature request, or pull request — we'd love to hear from you.

- **Found a bug?** [Open an issue](https://github.com/StrSimon/AgentVille/issues)
- **Have an idea?** [Start a discussion](https://github.com/StrSimon/AgentVille/issues) or open a feature request
- **Want to contribute?** PRs are welcome — fork, branch, and submit

## License

MIT
