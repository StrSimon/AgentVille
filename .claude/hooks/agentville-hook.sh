#!/bin/bash
# AgentVille Hook — automatically sends heartbeats to the bridge
# when Claude Code uses tools. No manual curl needed.
#
# Receives JSON on stdin from Claude Code with:
#   hook_event_name, session_id, tool_name, tool_input, cwd, etc.

BRIDGE="${AGENTVILLE_BRIDGE:-http://localhost:4242}"

# Read hook input from stdin
INPUT=$(cat)

# Silently exit if jq is not available
command -v jq &>/dev/null || exit 0

EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // ""')
SESSION=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // ""')

# Derive agent name from project directory
PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")

# ── Resident roster — persistent dwarf pool per project ─────
# Each project has a roster of known dwarves (.claude/agent-roster).
# When a session starts, it claims the first free dwarf in order.
# If all are busy (parallel sessions), a new dwarf is created and
# added to the roster. Lock files go stale after 3 min of inactivity,
# so a returning session reclaims the same dwarf (typically #1).
ROSTER_FILE="$CWD/.claude/agent-roster"
LOCKS_DIR="$CWD/.claude/agent-locks"
mkdir -p "$LOCKS_DIR" 2>/dev/null

# ── Sub-agent roster — same concept for sub-agents ──────────
# Sub-agents get their own roster so they persist across invocations
# and accumulate XP over time. Lock staleness is 10 min (matches
# the bridge despawn timeout). Reverse-mapping files (_map_*) let
# SubagentStop find which roster dwarf to release.
SUB_ROSTER_FILE="$CWD/.claude/agent-roster-sub"
SUB_LOCKS_DIR="$CWD/.claude/agent-locks-sub"
mkdir -p "$SUB_LOCKS_DIR" 2>/dev/null

claim_sub_dwarf() {
  local CLAUDE_AGENT_ID="$1"
  local CLAIMED=""

  if [ -f "$SUB_ROSTER_FILE" ]; then
    while IFS= read -r RESIDENT_ID; do
      [ -z "$RESIDENT_ID" ] && continue
      LOCK="$SUB_LOCKS_DIR/$RESIDENT_ID"
      if [ ! -f "$LOCK" ] || [ -n "$(find "$LOCK" -mmin +10 2>/dev/null)" ]; then
        # Free or stale — claim it
        echo "$CLAUDE_AGENT_ID" > "$LOCK" 2>/dev/null
        CLAIMED="$RESIDENT_ID"
        break
      fi
    done < "$SUB_ROSTER_FILE"
  fi

  # No free resident — recruit new dwarf
  if [ -z "$CLAIMED" ]; then
    CLAIMED="${CLAUDE_AGENT_ID:0:5}"
    echo "$CLAIMED" >> "$SUB_ROSTER_FILE" 2>/dev/null || true
    echo "$CLAUDE_AGENT_ID" > "$SUB_LOCKS_DIR/$CLAIMED" 2>/dev/null || true
  fi

  # Reverse mapping: Claude agent_id → roster ID
  echo "$CLAIMED" > "$SUB_LOCKS_DIR/_map_${CLAUDE_AGENT_ID:0:8}" 2>/dev/null || true

  echo "$CLAIMED"
}

release_sub_dwarf() {
  local CLAUDE_AGENT_ID="$1"
  local MAP_FILE="$SUB_LOCKS_DIR/_map_${CLAUDE_AGENT_ID:0:8}"
  local ROSTER_ID=""

  if [ -f "$MAP_FILE" ]; then
    ROSTER_ID=$(cat "$MAP_FILE" 2>/dev/null | tr -d '\n')
    rm -f "$SUB_LOCKS_DIR/$ROSTER_ID" 2>/dev/null
    rm -f "$MAP_FILE" 2>/dev/null
  fi

  echo "$ROSTER_ID"
}

CLAIMED_ID=""

# Walk the roster and claim the first available resident
if [ -f "$ROSTER_FILE" ]; then
  while IFS= read -r RESIDENT_ID; do
    [ -z "$RESIDENT_ID" ] && continue
    LOCK="$LOCKS_DIR/$RESIDENT_ID"
    LOCK_SESSION=$(cat "$LOCK" 2>/dev/null | tr -d '\n')
    if [ "$LOCK_SESSION" = "$SESSION" ]; then
      # We already own this dwarf — refresh the lock
      touch "$LOCK" 2>/dev/null
      CLAIMED_ID="$RESIDENT_ID"
      break
    elif [ ! -f "$LOCK" ] || [ -n "$(find "$LOCK" -mmin +3 2>/dev/null)" ]; then
      # Free or stale — claim it
      echo "$SESSION" > "$LOCK" 2>/dev/null
      CLAIMED_ID="$RESIDENT_ID"
      break
    fi
    # This dwarf is busy — try the next one
  done < "$ROSTER_FILE"
fi

# No free resident found — recruit a new dwarf
if [ -z "$CLAIMED_ID" ]; then
  CLAIMED_ID="${SESSION:0:5}"
  echo "$CLAIMED_ID" >> "$ROSTER_FILE" 2>/dev/null || true
  echo "$SESSION" > "$LOCKS_DIR/$CLAIMED_ID" 2>/dev/null || true
fi

AGENT_NAME="Agent-${CLAIMED_ID}"

case "$EVENT" in
  PreToolUse)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
    DETAIL=""

    case "$TOOL" in
      Edit|Write|NotebookEdit)
        ACTIVITY="coding"
        # Extract filename from file_path
        FILEPATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')
        if [ -n "$FILEPATH" ]; then
          DETAIL=$(basename "$FILEPATH" 2>/dev/null || echo "")
        fi
        ;;
      Read)
        ACTIVITY="researching"
        FILEPATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
        if [ -n "$FILEPATH" ]; then
          DETAIL=$(basename "$FILEPATH" 2>/dev/null || echo "")
        fi
        ;;
      Glob)
        ACTIVITY="researching"
        DETAIL=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')
        ;;
      Grep)
        ACTIVITY="researching"
        DETAIL=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')
        # Truncate long patterns
        DETAIL="${DETAIL:0:30}"
        ;;
      WebFetch|WebSearch)
        ACTIVITY="researching"
        DETAIL=$(echo "$INPUT" | jq -r '.tool_input.query // .tool_input.prompt // ""')
        DETAIL="${DETAIL:0:30}"
        ;;
      Bash)
        CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
        if echo "$CMD" | grep -qiE '(test|spec|jest|pytest|vitest|mocha|bun test|npm test)'; then
          ACTIVITY="testing"
          # Extract test command name
          DETAIL=$(echo "$CMD" | head -c 30)
        elif echo "$CMD" | grep -qiE '(heartbeat|api/event)'; then
          # Don't report our own heartbeat curls
          exit 0
        else
          ACTIVITY="coding"
          DETAIL=$(echo "$CMD" | head -c 30)
        fi
        ;;
      Task|EnterPlanMode)
        ACTIVITY="planning"
        DETAIL=$(echo "$INPUT" | jq -r '.tool_input.description // ""')
        DETAIL="${DETAIL:0:30}"
        ;;
      TodoWrite)
        # Skip — TodoWrite is internal bookkeeping, not a real activity.
        # Sending a heartbeat here races with Edit/Read heartbeats and
        # causes the agent to appear stuck on "planning".
        exit 0
        ;;
      *)
        ACTIVITY="coding"
        ;;
    esac
    ;;

  PostToolUse)
    # Track token usage by measuring payload sizes
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
    # Skip our own heartbeat curls
    if [ "$TOOL" = "Bash" ]; then
      CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
      if echo "$CMD" | grep -qiE '(heartbeat|api/event)'; then
        exit 0
      fi
    fi
    INPUT_BYTES=$(echo "$INPUT" | jq -r '.tool_input // {}' | wc -c | tr -d ' ')
    OUTPUT_BYTES=$(echo "$INPUT" | jq -r '.tool_output // ""' | wc -c | tr -d ' ')
    (curl -s -X POST "$BRIDGE/api/heartbeat" \
      -H "Content-Type: application/json" \
      -d "{\"agent\":\"$AGENT_NAME\",\"inputBytes\":${INPUT_BYTES:-0},\"outputBytes\":${OUTPUT_BYTES:-0},\"project\":\"$PROJECT\",\"busy\":false}" \
      --connect-timeout 1 2>/dev/null || true) &
    exit 0
    ;;

  SubagentStart)
    # Register sub-agent via roster — reuses persistent dwarf identities
    SUBAGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // ""')
    if [ -n "$SUBAGENT_ID" ]; then
      SUB_CLAIMED=$(claim_sub_dwarf "$SUBAGENT_ID")
      SUB_NAME="Agent-${SUB_CLAIMED}"
      (curl -s -X POST "$BRIDGE/api/heartbeat" \
        -H "Content-Type: application/json" \
        -d "{\"agent\":\"$SUB_NAME\",\"activity\":\"planning\",\"parentAgent\":\"$AGENT_NAME\",\"detail\":\"starting\",\"project\":\"$PROJECT\",\"newSpawn\":true}" \
        --connect-timeout 1 2>/dev/null || true) &
    fi
    exit 0
    ;;

  SubagentStop)
    # Sub-agent finished — release roster lock, send idle (don't despawn)
    # The dwarf goes to campfire and auto-despawns after 10 min of inactivity
    SUBAGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // ""')
    if [ -n "$SUBAGENT_ID" ]; then
      SUB_ROSTER_ID=$(release_sub_dwarf "$SUBAGENT_ID")
      if [ -n "$SUB_ROSTER_ID" ]; then
        SUB_NAME="Agent-${SUB_ROSTER_ID}"
        (curl -s -X POST "$BRIDGE/api/heartbeat" \
          -H "Content-Type: application/json" \
          -d "{\"agent\":\"$SUB_NAME\",\"activity\":\"idle\",\"detail\":\"\",\"project\":\"$PROJECT\",\"busy\":false}" \
          --connect-timeout 1 2>/dev/null || true) &
      fi
    fi
    exit 0
    ;;

  SessionEnd)
    # Session terminated — despawn immediately and release lock
    # curl runs synchronously here (no &) to ensure it completes before process exits
    AGENT_ID=$(echo "$AGENT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    curl -s -X POST "$BRIDGE/api/event" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"agent:despawn\",\"agentId\":\"$AGENT_ID\"}" \
      --connect-timeout 2 --max-time 3 2>/dev/null || true
    rm -f "$LOCKS_DIR/$CLAIMED_ID" 2>/dev/null
    exit 0
    ;;

  *)
    exit 0
    ;;
esac

# Escape detail for JSON (replace quotes and backslashes)
DETAIL=$(echo "$DETAIL" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n')

# Send heartbeat (non-blocking) — busy=true because tool is about to execute
(curl -s -X POST "$BRIDGE/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"$AGENT_NAME\",\"activity\":\"$ACTIVITY\",\"detail\":\"$DETAIL\",\"project\":\"$PROJECT\",\"busy\":true}" \
  --connect-timeout 1 2>/dev/null || true) &

exit 0
