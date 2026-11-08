# Storyboard

`Storyboard/STORYBOARD.md` is the build plan and the contract the user approves (Gate 2). Everything in it is a number or a named thing, so two agents building from it get the same video. Check: `project.mjs check storyboard <proj>`.

## Format

Front matter: `size`, `fps: 60`, `duration`, `message`, `arc`. Then one `## Frame N — name` per shot, numbered 1..N, contiguous, **global seconds**. Keys, one per line (repeat a key for several entries):

```
- time: 14.00–21.00     # global seconds, the same numbers the Remotion scene uses
- scene: dashboard with tabs toko, kasir, laporan; the cursor visits each and clicks; camera zooms into the report chart
- engine: remotion                       # remotion | footage (HyperFrames never authors a scene)
- asset: dashboard from kit shapes       # name every file that must exist before the build
- vo: 14.20–20.60 "exact words"          # or "- vo: none"; the words must equal SCRIPT.md
- text: 0.40–2.80 "ON SCREEN TEXT"       # visible at least max(1 s, 0.3 s × words)
- cursor: tab-toko @15.00 click          # arrival time; the click lands 0.12 s later
- zoom: laporan-chart 18.40–20.90 scale=1.5   # window includes the ramps (in=0.8, out=0.7 by default)
- narrator: point 4.00–6.50 R at headline     # wave | point | present, arm L|R
- sfx: impact @0.00 gain=0.8             # click | tick | whoosh | impact | chime; every cursor click adds a click at click time
- transition: slide 0.4                  # into this frame: cut | fade | slide | wipe, up to 0.5 s; default = the style's
- reads: what the viewer takes from this frame
- sound: music notes; free text, never produced (use sfx: for effects)
```

`scene` is concrete enough to build from: what is where, what moves, what the camera does. "Dynamic", "modern" and "clean" are not descriptions; give a duration, a position or a named element instead. Target names (`tab-toko`, `laporan-chart`, `headline`) become the keys of the rect table in the scene's `*.data.ts` (`cursor-and-camera.md`).

## What the checker computes

| Rule | Why |
| --- | --- |
| Frames start at 0, follow each other with no gap or overlap, add up to `duration` | the video is exactly as long as planned |
| Every frame is `round(seconds × 60)` frames; the sum equals the video's frames; `plan.json` gets `startFrame`, `durationFrames`, and `clipFrames` (+0.5 s handle each side) | Remotion compositions take their length from it, not from a guess |
| fps is 60 | a different fps needs `fps_reason` with the user's words |
| `engine` is `remotion` or `footage` | Remotion authors, HyperFrames cuts |
| Every frame has `scene`, `engine`, `asset`, `vo`, `reads` | nothing left to improvise |
| `vo` text equals SCRIPT.md word for word, windows do not overlap, each is inside its frame | the script cannot drift |
| Each `vo` window holds its words at `wps` (estimate), or contains the measured speech (± 0.05 s) | the window is real |
| Audio ends at least 0.3 s before the video ends; the video holds 0.5 s+ after the last word | no clipped ending |
| On-screen text readable: max(1 s, 0.3 s × words) | viewers can read it |
| Zoom: ramps ≥ 0.4 s (≥ 0.6 s in-ramp at scale > 1.3), hold ≥ 0.5 s advised, scale ≤ 2, gap to the next zoom ≥ 0.15 s (0.5 s advised) | smooth, no zoom-in-out-in |
| Cursor: stops ≥ 0.64 s apart (0.4 s travel + 0.12 s dwell + 0.12 s release; long moves need distance ÷ 900 px/s) | no teleporting; the same rule `planCursor` enforces |
| Cursor arrives ≥ 0.1 s after a zoom-in ends and clicks before a zoom-out starts, or happens entirely outside a zoom | never zoom while the cursor lands |
| Sound effects: `sfx:` kinds are known, times fall inside the frame; a `sound:` note with no `sfx:` line is flagged because nothing would be produced | sound cues are part of the plan, not wishes |
| Narrator cues: one arm at a time, `point` has a target, a narrator exists in PROJECT.md | the pose can be built |

| Style (`styles.md`): decided; text words ≤ the style's (error at twice), held reading time + its `holdMin`; zoom ≤ its `zoomMax`; effect kinds it uses; frames average its `shotSec` | the video stays in one family |
| Structure: every beat boundary of STRUCTURE.md is a frame boundary (a frame may split a beat, never straddle one) | the storyboard realises the approved structure |
| Emotion: each tag becomes a face segment in `plan.json` (0.2 s before its first word, ≥ 0.8 s long); a narrator cue that contradicts the delivery (a wave while `sad`), more cues per 10 s than the style allows, a cue over 4.5 s, or gesturing over 70% of the time is a warning | face, voice and gestures say the same thing |
| `transition:` is one of cut, fade, slide, wipe and at most 0.5 s (the overlap the clip handles give) | `assemble` can build it |

Also: frames under 1 s, voice-less stretches over 4 s and zoom scale ≤ 1.05 are warnings to justify in `reads`.

## Worked example

`tests/fixtures/prvtech-30s/` is a 30 s narrated promo: six frames that follow the six script blocks (hook 3 s, problem 5 s, solution 6 s, demo 7 s, payoff 4 s, CTA 5 s = 1800 frames at 60 fps). Frame 4 has three cursor stops (15.00, 16.40, 17.80 s), a zoom into the report chart at 18.40–20.90 s (hold 1.0 s) and one vo line; the checker passes it, and fails each of 16 deliberate mistakes (a gap, a vo line outside its frame, a changed word, a zoom ramp under the cursor, ...). The same folder holds the user's first draft (`SCRIPT.original.md`), which the script check rejects: 73 words (the domain counts as three) need about 37.5 s at 2 words/s in a 30 s video, and "puluhan", "gratis" and the domain have no `## Claims` row.

## Gate 2 message

Show the user the frame table (`check` prints it), the warnings, the assets still needed from them, and the measured or estimated voice timing. Then stop.

## Sound effects

`check storyboard` puts every `sfx:` line and every cursor click (a `click` at arrival + 0.12 s) into `plan.json` under `sfx`. `node scripts/sfx.mjs Storyboard/plan.json --out Asset/agen/sfx.wav` synthesizes the track (default -16 dB under full scale, so the voice leads; no sample files), and HyperFrames mounts it as its own `<audio>`. Music is separate: measure its tempo first (`hyperframes.md`).

## Timing for the build

`plan.json` gives each frame `startFrame`, `durationFrames` and `clipFrames` (range ± 15 frames). The Remotion scene for frame N is rendered from `startFrame − 15` and uses global time (`remotion.md`, "Scenes as clips"). Zoom `scale` and cursor times in the storyboard are the numbers the scene's data file repeats. The starter's `npm run check` then verifies the part the storyboard cannot: that the zoomed rect is fully on screen and clear of the narrator (`cursor-and-camera.md`).

## After approval

`project.mjs gate build <proj>`, then `project.mjs scaffold <proj>` copies the starter into `Source/remotion` and puts `plan.json` at `src/plan.json`. After `check storyboard` re-writes `plan.json` (an approved revision), copy it there again. Set each composition's `durationInFrames` from `frames[n].durationFrames` (or `clipFrames` when rendering a clip with handles). Put the `cursor`, `zoom` and `narrator` lines into the scene's `*.data.ts`, then `npm run check`. A scene that needs a different time than the storyboard says is a storyboard change: stop and re-submit.
