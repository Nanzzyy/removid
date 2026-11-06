#!/usr/bin/env bash
# Scaffold a Remotion project from the bundled starter (60 fps, zoom, cursor, 3D narrator, checks).
#   new-project.sh <dir> [--no-install]
set -euo pipefail
dest="${1:-}"; [ -n "$dest" ] || { echo "usage: $0 <dir> [--no-install]"; exit 2; }
install=1; [ "${2:-}" = "--no-install" ] && install=0
here="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
tpl="$here/../templates/remotion-starter"
[ -f "$tpl/package.json" ] || { echo "starter template not found at $tpl" >&2; exit 1; }
if [ -e "$dest" ] && [ -n "$(ls -A "$dest" 2>/dev/null)" ]; then echo "refusing: $dest exists and is not empty" >&2; exit 1; fi
command -v node >/dev/null || { echo "Node.js 22.18+ is required" >&2; exit 1; }
mkdir -p "$dest"
# copy everything except build output and dependencies
(cd "$tpl" && tar --exclude=node_modules --exclude=out --exclude=.remotion -cf - .) | (cd "$dest" && tar -xf -)
echo "created $dest"
if [ "$install" -eq 1 ]; then (cd "$dest" && npm install --no-audit --no-fund 2>&1 | tail -2); fi
cat <<MSG

next:
  cd $dest
  npm run typecheck        # types
  npm run check            # zoom + cursor + pose rules (no browser)
  npm run check:cursor     # pixel proof the cursor lands on its targets
  npm run studio           # Remotion Studio (the editor)
Edit src/scenes/*.data.ts first: targets, cursor stops and zoom shots live there.
MSG
