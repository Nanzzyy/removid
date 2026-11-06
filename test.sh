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
run_fail() { if "$@" >"$tmp/last.log" 2>&1; then echo "  FAIL  should have been rejected: $*" | cut -c1-110; fails=$((fails+1)); else echo "  ok    rejected: $*" | cut -c1-110; fi; }
run()  { if "$@" >"$tmp/last.log" 2>&1; then echo "  ok    $*" | cut -c1-110; else echo "  FAIL  $*" | cut -c1-110; tail -5 "$tmp/last.log" | sed 's/^/        /'; fails=$((fails+1)); fi; }

step "shell syntax"
for f in "$root"/install.sh "$root"/test.sh "$root"/skills/removid/scripts/*.sh; do run bash -n "$f"; done

step "project tool: script, storyboard and gate tests (mutants must be rejected)"
run node --check "$root/skills/removid/scripts/project.mjs"
run node --test "$root/tests/project.test.mjs"

step "install / uninstall into a throwaway project"
run "$root/install.sh" --project "$tmp/proj"
run test -f "$tmp/proj/.claude/skills/removid/SKILL.md"
run test -f "$tmp/proj/.agent/skills/removid/templates/remotion-starter/package.json"
run "$root/install.sh" --project "$tmp/proj" --uninstall
run test ! -e "$tmp/proj/.claude/skills/removid"

step "scaffold a project from the starter and audit it"
run "$root/skills/removid/scripts/new-project.sh" "$tmp/app"
( cd "$tmp/app" && run npx tsc --noEmit && run node scripts/check-logic.mjs )

step "character contract must FAIL on a broken character (mutant)"
( cd "$tmp/app" && cp src/characters/voxel.ts "$tmp/vx.bak" \
  && sed -i 's/eyeMeshes.push(eye, glint);/ /' src/characters/voxel.ts \
  && run_fail node scripts/check-logic.mjs; cp "$tmp/vx.bak" src/characters/voxel.ts )

step "numeric checks must FAIL on a broken scene (mutant)"
( cd "$tmp/app" && cp src/scenes/narrator.data.ts "$tmp/nd.bak" \
  && sed -i 's/anchor: {x: 0.7, y: 0.5}/anchor: {x: 0.5, y: 0.5}/' src/scenes/narrator.data.ts \
  && run_fail node scripts/check-logic.mjs; cp "$tmp/nd.bak" src/scenes/narrator.data.ts; run node scripts/check-logic.mjs )

if [ "$full" -eq 1 ]; then
  step "pixel cursor check (renders stills with debug=true)"
  ( cd "$tmp/app" && run node scripts/check-click-stills.mjs UiDemo )
  step "the pixel check must FAIL when the cursor is drawn 90 px off (mutant)"
  ( cd "$tmp/app" && cp src/components/CursorLayer.tsx "$tmp/cl.bak" \
    && sed -i 's/const tip = toScreen(cam, cursorPos(t, legs, start));/const tip0 = toScreen(cam, cursorPos(t, legs, start)); const tip = {x: tip0.x + 90, y: tip0.y};/' src/components/CursorLayer.tsx \
    && run_fail node scripts/check-click-stills.mjs UiDemo; cp "$tmp/cl.bak" src/components/CursorLayer.tsx )
  step "character sheets: every character renders, is not clipped, has a sensible size"
  ( cd "$tmp/app" && run node scripts/character-sheet.mjs --all )
  step "stills at global times"
  ( cd "$tmp/app" && run node scripts/stills.mjs 1.0,5.0 --id UiDemo && run test -s out/stills/UiDemo-t5.00.png )
  step "render both scenes at 60 fps and probe"
  ( cd "$tmp/app" && run npx remotion render src/index.ts UiDemo out/ui.mp4 \
    && run bash "$root/skills/removid/scripts/probe-mp4.sh" out/ui.mp4 1920x1080 60 10 \
    && run npx remotion render src/index.ts Narrator out/nar.mp4 \
    && run bash "$root/skills/removid/scripts/probe-mp4.sh" out/nar.mp4 1920x1080 60 11 )
fi

printf '\n'; [ "$fails" -eq 0 ] && echo "ALL OK" || echo "$fails FAIL"
exit $(( fails > 0 ))
