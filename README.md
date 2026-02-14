# AgentVille

Watch your AI agents work as villagers in an isometric village. Like `htop`, but as a city-builder game.

## Quick Start

```bash
npm install
npm start
```

Dashboard: **http://localhost:5173** — Bridge: **http://localhost:4242**

Or start them separately:

```bash
npm run bridge   # Bridge server (port 4242)
npm run dev      # Dashboard (port 5173)
```

## Connect Your Project

```bash
npm run connect /path/to/your/project
```

That's it. Start a new Claude Code session in your project and every tool use automatically shows up as a villager in the village.

### Global Hook (all sessions)

```bash
npm run connect:global
```

Every Claude Code session on your machine will report to the village. Requires `jq`.

```bash
npm run connect:global -- --uninstall   # To remove
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

## Tech Stack

- **Frontend:** React 19 + Tailwind CSS 3 + Framer Motion 11 + PixiJS 8
- **Bridge:** Pure Node.js (zero dependencies)
- **Protocol:** HTTP + SSE
- **Tests:** `node --test server/bridge.test.mjs`
