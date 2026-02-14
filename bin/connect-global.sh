#!/bin/bash
# AgentVille — install hook globally so ALL Claude Code sessions report to the village.
#
# Usage:  npm run connect:global
#    or:  ./bin/connect-global.sh
#
# To uninstall:  npm run connect:global -- --uninstall

set -e

AGENTVILLE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_SRC="$AGENTVILLE_DIR/.claude/hooks/agentville-hook.sh"
GLOBAL_HOOKS_DIR="$HOME/.claude/hooks"
GLOBAL_HOOK="$GLOBAL_HOOKS_DIR/agentville-hook.sh"
GLOBAL_SETTINGS="$HOME/.claude/settings.json"

# ── Uninstall mode ───────────────────────────────────────
if [ "$1" = "--uninstall" ]; then
  echo ""
  echo "  AgentVille — removing global hook"
  echo ""

  if [ -f "$GLOBAL_HOOK" ]; then
    rm "$GLOBAL_HOOK"
    echo "  Removed $GLOBAL_HOOK"
  fi

  if [ -f "$GLOBAL_SETTINGS" ] && command -v jq &>/dev/null; then
    # Remove agentville hook entries (keep other hooks intact)
    CLEANED=$(cat "$GLOBAL_SETTINGS" | jq '
      if .hooks then
        .hooks |= with_entries(
          .value |= map(select(.hooks | all(.command | test("agentville") | not)))
        ) | .hooks |= with_entries(select(.value | length > 0))
        | if .hooks == {} then del(.hooks) else . end
      else . end
    ')
    echo "$CLEANED" > "$GLOBAL_SETTINGS"
    echo "  Cleaned hooks from $GLOBAL_SETTINGS"
  fi

  echo ""
  echo "  Done! Global hook removed."
  echo ""
  exit 0
fi

# ── Install mode ─────────────────────────────────────────
echo ""
echo "  AgentVille — installing global hook"
echo "  Every Claude Code session on this machine will report to the village."
echo ""

# 1. Ensure jq is available
if ! command -v jq &>/dev/null; then
  echo "  Error: jq is required. Install it with: brew install jq"
  exit 1
fi

# 2. Create global hooks directory
mkdir -p "$GLOBAL_HOOKS_DIR"

# 3. Copy hook script
cp "$HOOK_SRC" "$GLOBAL_HOOK"
chmod +x "$GLOBAL_HOOK"
echo "  Copied hook to $GLOBAL_HOOK"

# 4. Configure global settings.json
HOOK_CMD="$GLOBAL_HOOK"
HOOK_CONFIG=$(cat <<ENDJSON
{
  "hooks": {
    "PreToolUse": [
      { "hooks": [{ "type": "command", "command": "$HOOK_CMD", "timeout": 5 }] }
    ],
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "$HOOK_CMD", "timeout": 5 }] }
    ],
    "SubagentStart": [
      { "hooks": [{ "type": "command", "command": "$HOOK_CMD", "timeout": 5 }] }
    ],
    "SubagentStop": [
      { "hooks": [{ "type": "command", "command": "$HOOK_CMD", "timeout": 5 }] }
    ]
  }
}
ENDJSON
)

if [ -f "$GLOBAL_SETTINGS" ]; then
  # Merge with existing settings, preserving user's other config
  EXISTING=$(cat "$GLOBAL_SETTINGS")
  MERGED=$(echo "$EXISTING" | jq --argjson new "$HOOK_CONFIG" '
    # Deep merge hooks: append AgentVille entries without duplicating
    .hooks //= {} |
    .hooks.PreToolUse //= [] |
    .hooks.PostToolUse //= [] |
    .hooks.SubagentStart //= [] |
    .hooks.SubagentStop //= [] |
    # Remove any existing agentville hooks first
    .hooks.PreToolUse |= map(select(.hooks | all(.command | test("agentville") | not))) |
    .hooks.PostToolUse |= map(select(.hooks | all(.command | test("agentville") | not))) |
    .hooks.SubagentStart |= map(select(.hooks | all(.command | test("agentville") | not))) |
    .hooks.SubagentStop |= map(select(.hooks | all(.command | test("agentville") | not))) |
    # Then add new ones
    .hooks.PreToolUse += $new.hooks.PreToolUse |
    .hooks.PostToolUse += $new.hooks.PostToolUse |
    .hooks.SubagentStart += $new.hooks.SubagentStart |
    .hooks.SubagentStop += $new.hooks.SubagentStop
  ')
  echo "$MERGED" > "$GLOBAL_SETTINGS"
  echo "  Updated $GLOBAL_SETTINGS (merged with existing config)"
else
  mkdir -p "$(dirname "$GLOBAL_SETTINGS")"
  echo "$HOOK_CONFIG" | jq '.' > "$GLOBAL_SETTINGS"
  echo "  Created $GLOBAL_SETTINGS"
fi

echo ""
echo "  Done! Global hook installed."
echo "  All Claude Code sessions will now appear in AgentVille."
echo ""
echo "  Make sure the bridge is running:  npm run bridge"
echo "  Dashboard:                        npm run dev"
echo ""
echo "  To uninstall:  npm run connect:global -- --uninstall"
echo ""
