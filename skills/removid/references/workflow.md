# Workflow: folder, script, storyboard, Remotion, HyperFrames

```
ask -> project folder -> references -> SCRIPT (gate 1) -> voice measured -> STORYBOARD (gate 2)
    -> Remotion scenes -> check + stills -> cursor proof -> clips (60 fps)
    -> HyperFrames cut + assemble -> SAMPLE (gate 3) -> full render -> FINAL (gate 4) -> deliver
```

Every arrow after the storyboard depends on numbers fixed before it. If a later step needs a different time, word or element than the plan says, that is a plan change: stop, edit the script or storyboard, submit again.

`project.mjs` = `node <skill dir>/scripts/project.mjs`. Gates, hashes and the folder: `project-folder.md`.

## 0. Ask

See `SKILL.md` "Ask first". Record the answers in PROJECT.md (fields and `## Final decisions`) so a later revision does not re-ask.

## 1. Project and brief

`project.mjs new <Brand> <slug> --brief "<the user's own words>" --format landscape|portrait|square --duration N --narration yes|no [--voice ...] [--character claude|none|custom]`

| Field | Default |
| --- | --- |
| Size and **fps** | 1920x1080 @ **60** (portrait 1080x1920, square 1440x1440) |
| Length | 15-30 s promos, shorter for social; a narrated video is its voice plus 1 s |
| Brand (logo, colours, fonts) | ask for files; never invent a logo |
| Audio | music only if asked (measure a song's real tempo before planning cuts) |

Show real things (product screens, logo, imagery). Draw only what has no source. Put the user's files in `Asset/owner/`, list every asset in `Asset/ASSETS.md`. Analyse each reference (`project-folder.md`).

## 2. Script (Gate 1 when narrated)

Write `Storyboard/SCRIPT.md` (`script.md`). `check script` until clean, `submit script`, show the user the table (window, words, seconds needed, words that fit) and the warnings, stop. `approve script --evidence "<their words>"` only after their answer.

## 3. Voice

Narrated only. Recording or TTS from `Asset/agen/vo.txt`. One file per line: `project.mjs vo-place <proj>`; one recording: `project.mjs vo <proj> <audio>`. Either measures segments and the real pace into `Asset/agen/vo-report.json`. No audio yet and the user will record later: you may draft the storyboard, you may not submit it without `--estimate "<their reason>"`.

## 3b. Character (narrated, with a character)

Design it before the storyboard (`character-and-narration.md`): `project.mjs scaffold <proj> --preview` copies the starter (nothing is built), `npm install` in `Source/remotion`, add the character to `src/characters/index.ts`, `npm run character -- <id>`, look at the sheet, show the user, revise, then `project.mjs set-character <proj> <id>` (or `none` for a voice-only video). The storyboard cannot be submitted while the character is `undecided`.

## 4. Storyboard (Gate 2)

Write `Storyboard/STORYBOARD.md` (`storyboard.md`): frames in seconds, vo windows from the measured audio, on-screen text, cursor stops, zooms, narrator cues, assets. `check storyboard` prints the frame table and writes `plan.json`. `submit storyboard`, show the table, the warnings and the assets still needed from the user, stop.

## 5. Remotion (author and edit)

- `project.mjs gate build <proj>` must say open. `project.mjs scaffold <proj>` copies the starter to `Source/remotion` with `src/plan.json`. `npm install`.
- One scene = one `<Composition>`, `fps={60}`, `durationInFrames` from `plan.json`, typed props, text/colours/media as props.
- Scene data (target rects, cursor stops, zoom shots, narrator cues) lives in `src/scenes/<scene>.data.ts` and mirrors the storyboard lines. UI elements are positioned from it.
- Edit visually in `npm run studio`.

## 6. Check and stills

```bash
npm run typecheck
npm run check            # zoom smoothness, cursor speed/hold/arrival, pose + lip-sync rules
npx remotion compositions   # fps must read 60, durations must match plan.json
```

Render stills and look at them: start, mid and end of each scene, each click frame, one frame inside each zoom hold, one speaking and one silent frame for a narrator. Check overflow, off-canvas, safe area, fonts, clipped limbs, text covered by the character. `npm run check:cursor` must print ALL OK (`cursor-and-camera.md`).

## 7. Scene clips

`npx remotion render src/index.ts <Id> ../../Asset/scenes/NN-name.mp4` with 0.5 s handle at head and tail (`clipFrames` in `plan.json`). Probe: `scripts/probe-mp4.sh clip.mp4 1920x1080 60 <seconds>`.

## 8. HyperFrames (cut and assemble)

Sound effects: `node scripts/sfx.mjs Storyboard/plan.json --out Asset/agen/sfx.wav` (the storyboard's `sfx:` lines plus a click on every cursor click; full ffmpeg). The narrator's voice envelope is made once from the final `vo.wav`.

Once: `npx -y hyperframes@<version> init . --example blank --non-interactive --skip-skills --skip-transcribe` in `Source/hyperframes`. Then `project.mjs assemble <proj>` writes `index.html` from `plan.json` and rejects a clip with the wrong size, fps or frame count. By hand instead: import the clips, trim, split, order, overlap for transitions, align cuts to measured beats, mix the voice and music, `check`, `snapshot`, preview. Details in `hyperframes.md`, `handoff.md`.

## 9. Sample (Gate 3)

`gate sample` must say open. About 10 s (or the busiest part) at draft quality into `Result/sample/`: `npx hyperframes render --fps 60 --quality draft --start 0 --end 10`. It must not end mid-sentence. Show it, stop, then `approve sample --evidence ...`.

## 10. Final (Gate 4)

`gate full` (refuses while a claim is still a placeholder). `npx hyperframes render --fps 60 --quality delivery --output Result/vN/<name>.mp4`, then `FFMPEG=<full ffmpeg> scripts/probe-mp4.sh ... 1920x1080 60 <seconds>` (also prints loudness, target -14 LUFS ± 2, peak ≤ -1 dBFS). Decode six frames and look again (frames inside crossfades and zooms especially); for a trimmed clip confirm the offset (`handoff.md`). Archive `tar czf Result/vN/_source.tgz Source Storyboard`. Show it, stop, `approve final`, `gate deliver`.

## Report

File path, size, duration, fps, resolution; the version; what the user can change and where (script and storyboard first, then Remotion props and `*.data.ts`, then the HyperFrames timeline); anything approximated; failures stated plainly with output.

## Revisions and batches

See `project-folder.md`, "Revisions". Batch from rows: verify ONE row by stills before rendering all; name outputs from a field.
