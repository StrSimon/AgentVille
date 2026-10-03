# ⛏ AgentVille

[![Tests](https://github.com/StrSimon/AgentVille/actions/workflows/test.yml/badge.svg)](https://github.com/StrSimon/AgentVille/actions/workflows/test.yml)

**Mission control for your AI coding agents — as a living dwarf village.**

Every **Claude Code** and **Codex** session on your machine becomes a dwarf. You watch them forge code,
fight tests in the arena, dig dependencies out of the mine and send commits by raven — and when one of
them needs you, it walks to the town hall, raises its hand and waits. You approve it right there.

- 🏘 **Live isometric village** (PixiJS) — 15 buildings for 15 kinds of work, day/night by your clock, levels for dwarves *and* buildings
- 🙋 **Needs-you inbox** — approve/deny permission prompts, answer questions, send new orders — no more hunting through terminals
- 💸 **Spend, burn & limits** — real token usage from transcripts, cost per dwarf/model/project, 24 h burn rate, and your plan limits (5-hour & weekly) for Claude and Codex
- 🤝 **Claude Code + Codex together** — CLI, desktop app and IDE extensions; one hook for both
- 🖥 **Desktop app** for macOS, Windows & Linux with tray icon and native notifications — or one `npx` command

## Start in 10 seconds

**Option A — one command** (Node ≥ 20.19):

```bash
npx agent-ville
```

It starts the village at <http://localhost:4242>, asks once to connect Claude Code and Codex, and opens your browser.

**Option B — desktop app:** grab the installer for your OS from [GitHub Releases](https://github.com/StrSimon/AgentVille/releases)
(`.dmg`, `.exe`, `.AppImage`/`.deb`), launch it and click **Connect**. It lives in your tray/menu bar and notifies you when a dwarf needs you.

That's it — start a new Claude Code or Codex session anywhere and your dwarf arrives within seconds.

> **Codex:** after connecting, Codex asks once to trust the new hooks on its next start — choose *Trust all and continue*.
> **macOS:** builds are unsigned for now — right-click the app → *Open* the first time.

## The village

| Building | What the dwarf is doing | Triggered by |
| --- | --- | --- |
| 🏛 Town Hall | **Waiting for you** — permission, question, or done | permission prompts, `AskUserQuestion`, end of a turn |
| ⚒ The Forge | Writing & editing code | `Edit`, `Write`, `apply_patch`, most shell commands |
| 📜 Scriptorium | Writing docs | edits to `.md`, `.mdx`, `.rst`, `.txt` |
| ⚔ The Arena | Tests, type checks, linters, builds | `npm test`, `vitest`, `pytest`, `cargo test`, `tsc`, `eslint`… |
| 🧪 Apothecary | Debugging | failed tools, `lsof`, `ps`, logs |
| 📚 The Library | Reading & searching code | `Read`, `Grep`, `Glob`, `rg`, `cat`, `sed -n`… |
| 🔭 Observatory | Browsing the web & docs | `WebSearch`, `WebFetch`, `curl`, docs MCPs |
| 🗼 Watchtower | Reviewing | `git diff/log/status`, `gh pr view` |
| 🐦 Rune Post | Commits, pushes, PRs | `git commit/push/merge`, `gh pr create` |
| ⛏ The Mine | Installing dependencies | `npm i`, `pnpm add`, `pip install`, `uv`, `cargo add`, `brew`… |
| 🌀 Sky Gate | Deploying | `vercel`, `fly`, `kubectl`, `terraform apply`, `docker push`… |
| 📐 Architect Guild | Planning & delegating | plan mode, `update_plan`, skills, sub-agents (`Agent`/`Task`) |
| 💧 Well of Memory | Remembering | context compaction, memory MCPs |
| 🔥 Campfire | Idle | between tasks |
| 🍺 The Tavern | Resting residents | sessions that ended — they keep their XP |

Claude dwarves wear horned bronze helmets, Codex dwarves green hoods. Sub-agents are smaller and carry a backpack.

## Steering from the village

| Situation | What you can do |
| --- | --- |
| **Permission prompt** (Claude Code & Codex) | Allow / Deny in the inbox or a desktop notification. The hook holds the prompt while the village is open and falls back to the terminal after a configurable time (*Settings → Approvals*). |
| **Question** (`AskUserQuestion`, Claude Code) | Pick the answer in the inbox. |
| **Busy dwarf** | Send orders — delivered with its next tool call. |
| **Finished dwarf** | Turn on **Wait for orders** — it then waits in the village after each task and starts on whatever you send. |

Approvals mode *Terminal only* turns all of that off and just shows who is waiting.

## Costs & limits

AgentVille reads the session transcripts that Claude Code and Codex already write, so token counts are exact.
Costs use API list prices per model (editable in `~/.agentville/prices.json`). On a subscription (Claude Max,
ChatGPT Pro) that's the **API value** of your usage — what actually caps you are the plan limits:

- **Codex** reports its 5-hour/weekly windows and credits in every session log.
- **Claude Code** exposes 5-hour/weekly limits in its status line; AgentVille wraps your existing status line
  (it keeps rendering exactly as before) to pick them up.

## Commands

```bash
npx agent-ville            # start + open dashboard (default)
npx agent-ville demo       # open the demo village
npx agent-ville setup      # (re)connect Claude Code and Codex (--claude / --codex)
npx agent-ville status     # what's connected, is the village running
npx agent-ville uninstall  # remove all hooks and restore your status line
```

Options: `--port=4242` (or `AGENTVILLE_PORT`), `--no-open`, `--no-setup`.
Data lives in `~/.agentville` (override with `AGENTVILLE_HOME`).

## How it works

```
Claude Code ─┐                      ┌─ dashboard (browser / desktop app)
             ├─ hook ─▶ bridge :4242 ┤   SSE + REST, token-protected controls
Codex ───────┘   ▲                  └─ transcripts → tokens, cost, limits
                 └── approvals / answers / orders flow back through the hook
```

- One Node hook (`hook/agentville-hook.mjs`) is registered globally in `~/.claude/settings.json` and `~/.codex/hooks.json`.
  It never blocks your agent: if the village isn't running it exits silently in milliseconds.
- The bridge (zero runtime dependencies) listens on `127.0.0.1` only. Control endpoints need a per-install token
  that is injected into the dashboard, and foreign origins/hosts are rejected — other websites can't approve anything.
- The village logic (`server/core`) is isomorphic: the same code runs in the bridge and in the in-browser demo.

### Simple API for your own agents

```bash
curl -X POST http://localhost:4242/api/heartbeat \
  -H 'Content-Type: application/json' \
  -d '{"agent":"My Bot","activity":"testing","detail":"suite","project":"my-app"}'
```

## Develop

```bash
npm install
npm run bridge      # bridge on :4242 (uses your real ~/.agentville)
npm run dev         # Vite on :5173, proxies /api and /events to the bridge
npm test            # server (node:test) + client (Vitest)
npm run app         # desktop app (Electron) from source
npm run dist        # build installers into release/
```

Releases: push a tag `v*` — GitHub Actions builds macOS, Windows and Linux installers.

```
server/core/   village logic (classification, roster, XP, cost, approvals) — runs in Node and the browser
server/        bridge (http.mjs), persistence, setup/installer, Codex limit reader
hook/          the hook shared by Claude Code and Codex (+ status line tap)
bin/           the `agent-ville` CLI
desktop/       Electron shell: tray, notifications, single instance
src/world/     PixiJS village: terrain, buildings, dwarves, particles, day/night, camera
src/ui/        React HUD: inbox, dwarf panel, control center, residents, settings
```

## License

MIT
