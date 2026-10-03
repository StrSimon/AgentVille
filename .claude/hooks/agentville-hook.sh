#!/bin/sh
# Compatibility shim for pre-2.0 installs that point at this path.
# Forwards to the new Node hook; run `npx agent-ville setup` to switch to the new launcher.
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
command -v node >/dev/null 2>&1 || exit 0
exec node "$DIR/hook/agentville-hook.mjs" claude
