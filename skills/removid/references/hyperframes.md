# HyperFrames: cut and assemble

Role here: clipping and assembly of already-rendered clips and raw footage. Not for building scenes. Needs Node.js 22+ and FFmpeg. Run `npx hyperframes <command>`; every command has `--help`, most take `--json`.

**Default fps is 30. Always render with `--fps 60`.**

## What it does in this workflow

- Trim and split clips (`data-media-start`, `timeline trim|split`).
- Order, overlap and move clips on the timeline (`timeline move`, `apply`).
- Align cuts to music (`npx hyperframes beats`), mix music and voice, normalise (`normalize-audio`).
- Simple transitions and overlays between clips (opacity/translate on a wrapper).
- Check, snapshot, preview, final render.

## Project shape

- `index.html`: root composition mounting clips and audio.
- `assets/scenes/`: Remotion clips. `assets/footage/`, `assets/audio/`, `assets/fonts/`.

`npx -y hyperframes@<version> init <dir> --example blank --non-interactive --skip-skills --skip-transcribe` for a blank project (`HYPERFRAMES_SKIP_SKILLS=1` also stops it installing skills). In a removid project, `project.mjs assemble <proj>` writes the root below from `Storyboard/plan.json`: clip `data-start`/`data-duration` from the frame ranges plus handles, the crossfade `fromTo` per later clip, the voice and sfx `<audio>`; and it checks with ffprobe that every clip in `Asset/scenes/NN-*.mp4` has the planned size, 60 fps and exact frame count. Root:

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="18" data-width="1920" data-height="1080">
  <video id="s01" class="clip" src="assets/scenes/01-hook.mp4" data-start="0" data-duration="4" data-media-start="0.5" data-track-index="0" muted></video>
  <video id="s02" class="clip" src="assets/scenes/02-demo.mp4" data-start="3.6" data-duration="6" data-media-start="0.5" data-track-index="1" muted></video>
  <audio id="bed" src="assets/audio/track.mp3" data-start="0" data-duration="18" data-track-index="9"></audio>
</div>
<script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({paused: true});</script>
```

## Contract (enforced by `check`)

1. Timed elements: `class="clip"`, `data-start`, `data-duration` in seconds. `data-track-index` is only a Studio lane; paint order is `z-index`.
2. Video length = root `data-duration`. Overrun is cut; early end holds the last frame.
3. Each composition registers one paused timeline: `window.__timelines["<data-composition-id>"] = tl`.
4. No `Date.now()`, unseeded `Math.random()`, network fetches, timers, `repeat: -1`.
5. Never `play()`/`pause()`/seek media. A `<video>` keeps sound with `data-has-audio="true"`, else `muted`. Every `<audio>` has an `id`. No `crossorigin` on media. Time the `<video>` or its wrapper, never both.
6. Never tween `display`/`visibility`/`autoAlpha` on a `.clip`; animate a wrapper or child. No CSS `transform` on an element GSAP also transforms.
7. Asset paths `assets/...`, no leading `/`.
8. Grades, grain, blur on footage: `npx hyperframes media-treatment`, not CSS filters.

## Loop

```bash
npx hyperframes check --json                         # gate; fix every error
npx hyperframes snapshot --at 1,5,9                  # read the PNGs under .hyperframes/artifacts/snapshots/
npx hyperframes preview --background                 # give the user the URL, wait
npx hyperframes render --fps 60 --quality draft --start 0 --end 10 --output sample.mp4   # the 10 s sample; --start/--end need MP4 at 24/25/30/60 fps
npx hyperframes render --fps 60 --quality delivery --output out.mp4
```

- Existing project: `npx hyperframes timeline --json` shows what plays when. Edit: `timeline move|trim|split|set|duplicate|delete <ref> --plan --json`, then without `--plan`. Edits are refused on overlap (`--overwrite` or move the neighbour) or when ending past the composition.
- After render: file non-empty, `probe-mp4.sh` (with `FFMPEG=` a full build it also prints loudness: target -14 LUFS ± 2, true peak ≤ -1 dBFS), `ffprobe` duration equals root `data-duration`, `r_frame_rate` is `60/1`.
- Variants: `--docker --strict` (reproducible), `--batch rows.json --output "renders/{name}.mp4"`.
- Failures: `doctor --json` (gate on `.ok`), `browser ensure` if Chrome is missing, raise `--timeout` for heavy pages.
- **Minimal ffmpeg breaks the render.** Verified: with a minimal ffmpeg on PATH, `render` fails at "Extracting video frames" with `VIDEO_SOURCE_UNRENDERABLE ... ffmpeg_failed` (the build lacks `setparams` and the frame-image muxer). Fix: `export HYPERFRAMES_FFMPEG_PATH=/path/to/full/ffmpeg`, then render again. `scripts/doctor.sh` warns about it. (`npx hyperframes check` passes either way; only the render needs ffmpeg.)
- Never delete `.hyperframes` (project history). Do not run `publish`, `cloud`, `usage` or billing commands without the user's go-ahead.

## Verified assembly

Tested end to end: two Remotion clips (a narrator clip with voice, then a UI-demo clip trimmed with `data-media-start="1"`, crossfaded for 0.3 s via a GSAP opacity tween on the second clip) gave `check` 0 errors and 0 warnings, rendered with `--fps 60`, and probed as 1920x1080, 60 fps, 16.7 s with audio. The trim landed exactly (see `handoff.md`, "Verify the cut").

## Transitions between clips

Overlap two clips by 0.3-0.5 s and animate a wrapper's opacity or x/y with GSAP (`power2.inOut`). A crossfade between two clips that both carry text at the same place shows the two layouts on top of each other for the whole overlap. Make the scene's CONTENT leave before the cut (`exitAlpha` in the starter fades it in the last 0.25 s of its range) so the overlap only blends the background and the identical narrator. Search `npx hyperframes catalog --query "<transition>" --json` before hand-writing a named transition. Scenes themselves stay in Remotion.
