#!/bin/bash
# AgentVille installer for macOS — no Apple signing needed.
# Downloads with curl (no quarantine flag), so Gatekeeper does not block the app.
#   curl -fsSL https://github.com/StrSimon/AgentVille/releases/latest/download/install-mac.sh | bash
set -euo pipefail

REPO="StrSimon/AgentVille"
DEST="${AGENTVILLE_DEST:-/Applications}"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"

case "$(uname -m)" in
  arm64) PATTERN='/AgentVille-[0-9.]*-arm64-mac\.zip"' ;;
  *) PATTERN='/AgentVille-[0-9.]*-mac\.zip"' ;;
esac

echo "⛏  Looking up the latest AgentVille release…"
URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -o '"browser_download_url": *"[^"]*'"$PATTERN" | head -1 | sed 's/.*"\(https[^"]*\)"/\1/')
[ -n "$URL" ] || { echo "Could not find a macOS download for $(uname -m)." >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "⬇  Downloading $(basename "$URL")…"
curl -fL --progress-bar "$URL" -o "$TMP/AgentVille.zip"
ditto -x -k "$TMP/AgentVille.zip" "$TMP/app"

[ -n "${AGENTVILLE_DEST:-}" ] || osascript -e 'quit app "AgentVille"' >/dev/null 2>&1 || true
rm -rf "$DEST/AgentVille.app"
ditto "$TMP/app/AgentVille.app" "$DEST/AgentVille.app"
xattr -dr com.apple.quarantine "$DEST/AgentVille.app" 2>/dev/null || true

echo "✅ Installed to $DEST/AgentVille.app — starting…"
[ -n "${AGENTVILLE_NO_OPEN:-}" ] || open "$DEST/AgentVille.app"
