#!/usr/bin/env bash
# Install the removid skill for Claude Code, Codex and Antigravity.
#
#   ./install.sh                 # symlink into every agent's global skills dir
#   ./install.sh --copy          # copy instead of symlink
#   ./install.sh claude codex    # only these agents (claude | codex | antigravity)
#   ./install.sh --project DIR   # install into DIR's project-level skills dirs
#   ./install.sh --uninstall     # remove what this script installed
#
# Symlink mode: `git pull` in this repo updates every agent at once.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skills/removid"
NAME=removid
MODE=link; ACTION=install; PROJECT=""; AGENTS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --copy) MODE=copy ;;
    --uninstall) ACTION=uninstall ;;
    --project) PROJECT="${2:?--project needs a directory}"; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    claude|codex|antigravity) AGENTS+=("$1") ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done
[ ${#AGENTS[@]} -gt 0 ] || AGENTS=(claude codex antigravity)
[ -f "$SRC/SKILL.md" ] || { echo "missing $SRC/SKILL.md" >&2; exit 1; }

# Target skills directory per agent. Override with REMOVID_<AGENT>_DIR.
target_dir() {
  local agent="$1" base
  if [ -n "$PROJECT" ]; then
    case "$agent" in
      claude)      base="$PROJECT/.claude/skills" ;;
      codex)       base="$PROJECT/.agents/skills" ;;
      antigravity) base="$PROJECT/.agent/skills" ;;
    esac
  else
    case "$agent" in
      claude)      base="${REMOVID_CLAUDE_DIR:-$HOME/.claude/skills}" ;;
      codex)       base="${REMOVID_CODEX_DIR:-${CODEX_HOME:-$HOME/.codex}/skills}" ;;
      antigravity) base="${REMOVID_ANTIGRAVITY_DIR:-$HOME/.gemini/antigravity/skills}" ;;
    esac
  fi
  echo "$base"
}

for agent in "${AGENTS[@]}"; do
  dest="$(target_dir "$agent")/$NAME"
  if [ "$ACTION" = uninstall ]; then
    if [ -L "$dest" ] || [ -d "$dest" ]; then rm -rf "$dest"; echo "removed  [$agent] $dest"
    else echo "absent   [$agent] $dest"; fi
    continue
  fi
  mkdir -p "$(dirname "$dest")"
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    # Only replace our own install (a symlink to this repo or a dir with our SKILL.md).
    if [ -L "$dest" ] || grep -qs '^name: removid$' "$dest/SKILL.md" 2>/dev/null; then rm -rf "$dest"
    else echo "skipped  [$agent] $dest exists and is not removid" >&2; continue; fi
  fi
  if [ "$MODE" = link ]; then ln -s "$SRC" "$dest"; echo "linked   [$agent] $dest"
  else cp -R "$SRC" "$dest"; echo "copied   [$agent] $dest"; fi
done

[ "$ACTION" = install ] && cat <<'EOF'

Restart the agent session so it picks the skill up.
  Claude Code : /removid
  Codex       : $removid   (or /skills)
  Antigravity : describe a video task; the skill activates from its description
EOF
