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
# Use short session suffix to distinguish parallel agents
SHORT_ID="${SESSION:0:5}"
AGENT_NAME="Agent-${SHORT_ID}"

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
        ACTIVITY="planning"
        DETAIL="updating tasks"
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
      -d "{\"agent\":\"$AGENT_NAME\",\"inputBytes\":${INPUT_BYTES:-0},\"outputBytes\":${OUTPUT_BYTES:-0},\"project\":\"$PROJECT\"}" \
      --connect-timeout 1 2>/dev/null || true) &
    exit 0
    ;;

  SubagentStart)
    # Register sub-agent with parent relationship
    SUBAGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // ""')
    if [ -n "$SUBAGENT_ID" ]; then
      SUB_SHORT="${SUBAGENT_ID:0:5}"
      SUB_NAME="Agent-${SUB_SHORT}"
      (curl -s -X POST "$BRIDGE/api/heartbeat" \
        -H "Content-Type: application/json" \
        -d "{\"agent\":\"$SUB_NAME\",\"activity\":\"planning\",\"parentAgent\":\"$AGENT_NAME\",\"detail\":\"starting\",\"project\":\"$PROJECT\"}" \
        --connect-timeout 1 2>/dev/null || true) &
    fi
    exit 0
    ;;

  SubagentStop)
    # Sub-agent finished — despawn immediately
    SUBAGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // ""')
    if [ -n "$SUBAGENT_ID" ]; then
      SUB_SHORT="${SUBAGENT_ID:0:5}"
      SUB_NAME="Agent-${SUB_SHORT}"
      SUB_ID=$(echo "$SUB_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
      (curl -s -X POST "$BRIDGE/api/event" \
        -H "Content-Type: application/json" \
        -d "{\"type\":\"agent:despawn\",\"agentId\":\"$SUB_ID\"}" \
        --connect-timeout 1 2>/dev/null || true) &
    fi
    exit 0
    ;;

  *)
    exit 0
    ;;
esac

# Escape detail for JSON (replace quotes and backslashes)
DETAIL=$(echo "$DETAIL" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n')

# Send heartbeat (non-blocking)
(curl -s -X POST "$BRIDGE/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"$AGENT_NAME\",\"activity\":\"$ACTIVITY\",\"detail\":\"$DETAIL\",\"project\":\"$PROJECT\"}" \
  --connect-timeout 1 2>/dev/null || true) &

exit 0
