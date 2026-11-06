#!/usr/bin/env bash
# removid doctor: check the tools the workflow needs. Exit 0 always; read the output.
set -u
ok=0; warn=0
check() { # name, command, hint
  if command -v "$2" >/dev/null 2>&1; then
    printf '  ok    %-10s %s\n' "$1" "$("$2" --version 2>&1 | head -n1)"
  else
    printf '  MISS  %-10s %s\n' "$1" "$3"; warn=$((warn+1))
  fi
}
echo "removid doctor"
check node    node    "install Node.js 22+ (https://nodejs.org)"
check npm     npm     "ships with Node.js"
check npx     npx     "ships with Node.js"
check ffmpeg  ffmpeg  "install FFmpeg (apt install ffmpeg / brew install ffmpeg)"
check ffprobe ffprobe "ships with FFmpeg"

if command -v ffmpeg >/dev/null 2>&1 && ! ffmpeg -hide_banner -filters 2>/dev/null | grep -q ' setparams '; then
  if [ -n "${HYPERFRAMES_FFMPEG_PATH:-}" ] && [ -x "$HYPERFRAMES_FFMPEG_PATH" ] && "$HYPERFRAMES_FFMPEG_PATH" -hide_banner -filters 2>/dev/null | grep -q ' setparams '; then
    echo "  ok    HYPERFRAMES_FFMPEG_PATH points to a full ffmpeg (PATH ffmpeg is a minimal build)"
  else
    echo "  WARN  ffmpeg on PATH is a minimal build (no setparams filter). HyperFrames renders FAIL with it"
    echo "        (VIDEO_SOURCE_UNRENDERABLE). export HYPERFRAMES_FFMPEG_PATH=/path/to/full/ffmpeg"
    warn=$((warn+1))
  fi
fi

if command -v node >/dev/null 2>&1; then
  minor=$(node -p 'process.versions.node.split(".")[1]'); major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 18 ]; }; then
    echo "  WARN  node $(node -v): HyperFrames needs Node 22+ and the starter's check scripts run .ts directly (22.18+)"; warn=$((warn+1))
  fi
fi

echo "engines (checked lazily via npx; first run downloads them):"
if [ -f remotion.config.ts ] || [ -f remotion.config.js ] || grep -qs '"remotion"' package.json 2>/dev/null; then
  echo "  here: Remotion project"
fi
if [ -f index.html ] && grep -qs 'data-composition-id' index.html; then
  echo "  here: HyperFrames project"
  command -v npx >/dev/null 2>&1 && npx --no-install hyperframes doctor --json 2>/dev/null | head -c 600
fi
echo
[ "$warn" -eq 0 ] && echo "all required tools present" || echo "$warn issue(s) above"
exit 0
