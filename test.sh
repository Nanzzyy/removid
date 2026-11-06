#!/usr/bin/env bash
# Smoke test for the removid repo. Fast by default; --full also renders stills, clips and checks the cursor in pixels.
#   ./test.sh          syntax, install/uninstall, scaffold, typecheck, numeric audit
#   ./test.sh --full   + pixel cursor check, 60 fps clip render, probe
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
full=0; [ "${1:-}" = "--full" ] && full=1
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fails=0
step() { printf '\n== %s\n' "$1"; }
run()  { if "$@" >"$tmp/last.log" 2>&1; then echo "  ok    $*" | cut -c1-110; else echo "  FAIL  $*" | cut -c1-110; tail -5 "$tmp/last.log" | sed 's/^/        /'; fails=$((fails+1)); fi; }

step "shell syntax"
for f in "$root"/install.sh "$root"/test.sh "$root"/skills/removid/scripts/*.sh; do run bash -n "$f"; done

step "install / uninstall into a throwaway project"
run "$root/install.sh" --project "$tmp/proj"
run test -f "$tmp/proj/.claude/skills/removid/SKILL.md"
run test -f "$tmp/proj/.agent/skills/removid/templates/remotion-starter/package.json"
run "$root/install.sh" --project "$tmp/proj" --uninstall
run test ! -e "$tmp/proj/.claude/skills/removid"

step "scaffold a project from the starter and audit it"
run "$root/skills/removid/scripts/new-project.sh" "$tmp/app"
( cd "$tmp/app" && run npx tsc --noEmit && run node scripts/check-logic.mjs )

if [ "$full" -eq 1 ]; then
  step "pixel cursor check (renders stills with debug=true)"
  ( cd "$tmp/app" && run node scripts/check-click-stills.mjs UiDemo )
  step "render both scenes at 60 fps and probe"
  ( cd "$tmp/app" && run npx remotion render src/index.ts UiDemo out/ui.mp4 \
    && run bash "$root/skills/removid/scripts/probe-mp4.sh" out/ui.mp4 1920x1080 60 10 \
    && run npx remotion render src/index.ts Narrator out/nar.mp4 \
    && run bash "$root/skills/removid/scripts/probe-mp4.sh" out/nar.mp4 1920x1080 60 11 )
fi

printf '\n'; [ "$fails" -eq 0 ] && echo "ALL OK" || echo "$fails FAIL"
exit $(( fails > 0 ))
