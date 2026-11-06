---
name: removid
description: Make programmatic video (MP4/GIF/WebM) at 60 fps. Remotion (React) authors every scene: UI demos, cursor that lands exactly on its target, smooth zoom-to-highlight, a 3D Claude-style narrator character with lip sync, data-driven batches. HyperFrames cuts and assembles the rendered clips (trim, split, order, transitions, music, final render). Use for /removid, launch films, explainers, UI-interaction demos, narrated videos, social clips, motion graphics, beat-synced edits and cutting raw footage.
argument-hint: "[brief | path-to-project | 'doctor' | 'new <dir>']"
---

# removid

Two tools, two jobs. Do not blur them.

| Stage | Tool | Does |
| --- | --- | --- |
| **Author** | **Remotion** | Builds and edits every scene: layout, text, UI, cursor, zoom, narrator character, charts, data-driven props. Remotion Studio is the editor. Renders each scene to a clip. |
| **Cut + assemble** | **HyperFrames** | Takes rendered clips and raw footage: trim, split, reorder, overlap, transitions, music/VO mix, beat-aligned cuts, final render. |

Never author scenes in HyperFrames HTML, and never port Remotion work into HyperFrames HTML. Hand clips over as video files (`references/handoff.md`).

## Defaults

- **60 fps.** HyperFrames renders at 30 unless told otherwise, and Remotion takes whatever the composition says. Set `fps={60}` in Remotion and `--fps 60` on the HyperFrames render, then verify with `scripts/probe-mp4.sh`. Use 30 only if the user or platform asks.
- 1920x1080 (vertical 1080x1920).
- No voiceover, captions or extra aspect ratios nobody asked for. Narration is the one thing you must ask about (below).

## Ask first (before planning)

Ask only what the brief leaves open, in one short batch (use the agent's question tool if it has one):

1. **Narration?** Does the video need a spoken narrator?
2. If yes, **a character?** Offer: the built-in **Claude-style 3D character** (default; coral body, spark badge, lip sync), voice only with no character, or the user's own character/art.
3. If yes, **voice**: the user's audio file, or text-to-speech (which language and voice). Never invent a voice or send the script to a service the user has not accepted.
4. **Highlights**: which things should the camera zoom into and spotlight? Propose 1-3 from the script and let the user correct.
5. Platform/size/fps if it changes the defaults.

No narration means no character: skip 2-3. Details: `references/character-and-narration.md`.

## Route

| Need | Read |
| --- | --- |
| Any new video | `references/workflow.md` (start here), then `references/remotion.md` |
| Cursor, click, zoom highlight, UI demo | `references/cursor-and-camera.md` (mandatory) |
| Narrator character, voice, lip sync | `references/character-and-narration.md` |
| Cutting, trimming, assembling, raw footage, music | `references/hyperframes.md`, `references/handoff.md` |
| Easing, durations, stagger, framing, beat sync | `references/motion-design.md` |

Start a new Remotion project with `scripts/new-project.sh <dir>`: it copies a tested starter (60 fps, zoom, cursor, narrator, checks) from `templates/remotion-starter`. Existing project: detect it (`remotion.config.*` or `remotion` in `package.json` = Remotion scenes; `index.html` with `data-composition-id` = HyperFrames assembly) and continue in place. `$ARGUMENTS` = `doctor` runs `scripts/doctor.sh`, reports, stops; `new <dir>` runs `new-project.sh`.

HyperFrames is skipped only when the result is one Remotion scene with no cuts, footage or audio assembly.

## Workflow

1. **Ask**, then **brief and plan (gate 1)**: shots in seconds, cut points, cursor targets, zoom highlights, narrator cues, fps. Wait for approval unless told "no stops".
2. **Remotion**: build scenes, run `npm run check` (numeric rules), render **stills** (start, mid, end, every click frame, one frame per zoom hold) and look at them.
3. **Cursor proof**: `npm run check:cursor` must say ALL OK.
4. **Render scene clips** at 60 fps with handle frames; probe each.
5. **HyperFrames**: import clips, cut and arrange, mix audio, `check`, snapshot.
6. **Sample (gate 2)**: about 10 s at draft quality. Wait.
7. **Final render** at `--fps 60`, then `scripts/probe-mp4.sh out.mp4 1920x1080 60 <seconds>` must say OK.

Revising one scene means re-rendering that clip only.

## Hard rules

- Every frame is a pure function of time: no `Date.now()`, unseeded `Math.random()`, timers or render-time network fetches.
- Cursor targets come from one shared rect table and the check scripts pass; never aim by eye.
- Zoom is smooth (eased in and out, no stiff start), never zoom in and straight back out, never zoom while the cursor lands.
- Fonts and assets are local files with relative paths. No emoji or system-font symbols in scenes (they render as empty boxes on machines without those fonts); use SVG.
- Content inside the 90% action-safe box, key text inside 80% title-safe.
- A failed check or a bad still is not a pass. Report what failed, with output.
- Do not publish, upload or send a render anywhere without the user's go-ahead.

Condensed references. For exhaustive detail: `npx hyperframes docs <topic>`, https://www.remotion.dev/docs.
