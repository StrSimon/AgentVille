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

if [ -z "${AGENTVILLE_DEST:-}" ]; then
  osascript -e 'quit app "AgentVille"' >/dev/null 2>&1 || true
  # Older copies downloaded through a browser carry the quarantine flag and keep
  # getting blocked when started from the Dock — replace every copy.
  for old in /Applications/AgentVille.app "$HOME/Applications/AgentVille.app" "$HOME/Downloads/AgentVille.app"; do
    [ "$old" = "$DEST/AgentVille.app" ] || rm -rf "$old" 2>/dev/null || true
  done
  hdiutil info 2>/dev/null | grep -o '/Volumes/AgentVille[^	]*' | while read -r vol; do hdiutil detach "$vol" -quiet || true; done
fi
rm -rf "$DEST/AgentVille.app"
ditto "$TMP/app/AgentVille.app" "$DEST/AgentVille.app"
xattr -cr "$DEST/AgentVille.app" 2>/dev/null || true

if xattr -r "$DEST/AgentVille.app" 2>/dev/null | grep -q com.apple.quarantine; then
  echo "⚠  Could not clear the quarantine flag — run: sudo xattr -dr com.apple.quarantine \"$DEST/AgentVille.app\"" >&2
fi
codesign --verify --deep "$DEST/AgentVille.app" 2>/dev/null || echo "⚠  Signature check failed (macOS $(sw_vers -productVersion), $(uname -m))" >&2

echo "✅ Installed to $DEST/AgentVille.app — starting…"
[ -n "${AGENTVILLE_NO_OPEN:-}" ] || open "$DEST/AgentVille.app"
