#!/bin/bash
# AgentVille — connect a project in one command.
#
# Usage:  npm run connect /path/to/your/project
#    or:  ./bin/connect.sh /path/to/your/project

set -e

AGENTVILLE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_SRC="$AGENTVILLE_DIR/.claude/hooks/agentville-hook.sh"

TARGET="${1:-.}"
TARGET="$(cd "$TARGET" 2>/dev/null && pwd)" || { echo "Error: directory '$1' not found."; exit 1; }

echo ""
echo "  AgentVille — connecting project"
echo "  Target: $TARGET"
echo ""

# 1. Create hook directory
mkdir -p "$TARGET/.claude/hooks"

# 2. Copy hook script (skip if same file)
if [ "$(realpath "$HOOK_SRC" 2>/dev/null)" != "$(realpath "$TARGET/.claude/hooks/agentville-hook.sh" 2>/dev/null)" ]; then
  cp "$HOOK_SRC" "$TARGET/.claude/hooks/agentville-hook.sh"
fi
chmod +x "$TARGET/.claude/hooks/agentville-hook.sh"

# 3. Create or merge settings.local.json
SETTINGS="$TARGET/.claude/settings.local.json"
HOOK_CONFIG='{
  "hooks": {
    "PreToolUse": [
      { "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/agentville-hook.sh", "timeout": 5 }] }
    ],
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/agentville-hook.sh", "timeout": 5 }] }
    ],
    "SubagentStart": [
      { "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/agentville-hook.sh", "timeout": 5 }] }
    ],
    "SubagentStop": [
      { "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/agentville-hook.sh", "timeout": 5 }] }
    ]
  }
}'

if [ -f "$SETTINGS" ]; then
  # Merge: if jq is available, deep merge; otherwise warn
  if command -v jq &>/dev/null; then
    EXISTING=$(cat "$SETTINGS")
    echo "$EXISTING" | jq --argjson new "$HOOK_CONFIG" '. * $new' > "$SETTINGS"
    echo "  Updated existing $SETTINGS"
  else
    echo "  Warning: $SETTINGS already exists and jq is not installed."
    echo "  Please manually add the hook config. See README.md."
  fi
else
  echo "$HOOK_CONFIG" > "$SETTINGS"
  echo "  Created $SETTINGS"
fi

echo "  Copied hook to .claude/hooks/agentville-hook.sh"
echo ""
echo "  Done! Start a new Claude Code session in your project."
echo "  Every tool use will automatically show up in the village."
echo ""
