---
name: removid
description: Make programmatic video (MP4/GIF/WebM) at 60 fps from a project folder, a calculated script and a storyboard, with approval gates. Remotion (React) authors every scene: UI demos, cursor that lands exactly on its target, smooth zoom-to-highlight, a 3D narrator character that Claude designs for the video (woman, man, pixel, mascot...) with lip sync, data-driven batches. HyperFrames cuts and assembles the rendered clips (trim, split, order, transitions, music, final render). Use for /removid, video scripts (naskah), storyboards, launch films, explainers, UI-interaction demos, narrated videos, social clips, motion graphics, beat-synced edits and cutting raw footage.
argument-hint: "[brief | project name or path | 'doctor' | 'new <Brand> <slug>']"
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

## Ask first (before creating anything)

Ask only what the brief leaves open, in one short batch (use the agent's question tool if it has one):

1. **Brand and name** of the video (they become the folder), and the **project root** if the user has one.
2. **Does the user already have a script?** If yes, it is theirs: keep every word.
3. **Narration?** If yes: **a character?** Claude designs a 3D character for the video: a woman, a man, a pixel figure, a mascot or another style (never the Claude logo turned 3D). Offer 2 or 3 options that fit the audience; or voice only; or the user's own art. And the **voice**: the user's recording, or text-to-speech (which engine, language, voice). Never invent a voice or send the script to a service the user has not accepted.
4. **Message, audience, platform, length, call to action**, and which **claims** can be proven (numbers, clients, testimonials, offers, the domain).
5. **Highlights**: what the camera zooms into. Propose 1-3 from the script; the user corrects.

No narration means no character and no script gate (on-screen copy still goes in the script file). Details: `references/script.md`, `references/character-and-narration.md` (how the character is designed, previewed and approved).

## Route

| Need | Read |
| --- | --- |
| Any new video | `references/workflow.md` (start here), `references/project-folder.md` |
| Script (naskah), voice timing, claims | `references/script.md` |
| Storyboard, frame/time budget | `references/storyboard.md` |
| Authoring scenes | `references/remotion.md` |
| Cursor, click, zoom highlight, UI demo | `references/cursor-and-camera.md` (mandatory) |
| Narrator character, voice, lip sync | `references/character-and-narration.md` |
| Cutting, trimming, assembling, raw footage, music | `references/hyperframes.md`, `references/handoff.md` |
| Easing, durations, stagger, framing, beat sync | `references/motion-design.md` |

Existing project: run `scripts/project.mjs status <name or path>` and read its `PROJECT.md` first; it is the truth, not the chat. `$ARGUMENTS` = `doctor` runs `scripts/doctor.sh` and stops; `new <Brand> <slug>` runs the first workflow step.

## Workflow: a gate is a hard stop, and `scripts/project.mjs` enforces it

`project.mjs` below means `node <this skill's directory>/scripts/project.mjs` (the directory holding this file; use the absolute path, the shell is usually elsewhere).

1. **Ask**, then `project.mjs new <Brand> <slug> --brief "the user's own words" ...` (folder schema: `references/project-folder.md`). Analyse the user's references.
2. **Script** in `Storyboard/SCRIPT.md`: timed blocks, claims table. `check script` computes words and seconds per window; fix every error. `submit script`, show the table, **stop (Gate 1)**. Silent video: the same file holds the on-screen copy and there is no Gate 1.
3. **Voice** (narrated): recording or TTS from `Asset/agen/vo.txt`, then `project.mjs vo <proj> <audio>` (one recording) or `vo-place <proj>` (one file per line) measures the real timing.
4. **Character** (narrated): Claude designs it (woman, man, pixel, mascot...), `scaffold --preview`, `npm run character -- <id>` renders its sheet, show the user, `set-character <proj> <id>` (or `none` = voice only).
5. **Storyboard** in `Storyboard/STORYBOARD.md`: frames, vo windows, text, cursor stops, zooms, narrator cues, assets, in numbers. `check storyboard` (writes `plan.json` with exact frame counts), `submit storyboard`, **stop (Gate 2)**.
6. `gate build`, `scaffold`, then **Remotion** builds the scenes from `plan.json`: `npm run check`, stills (start, mid, end, each click, each zoom hold), `npm run check:cursor`, scene clips at 60 fps with handles, `probe-mp4.sh`.
7. **HyperFrames** cuts and assembles the clips, mixes audio (skipped only when the result is one Remotion scene with no cuts, footage or audio mixing): `sfx.mjs` for effects, `project.mjs assemble` for `index.html`, `check`. Render the 10 s sample (`--start 0 --end 10`), **stop (Gate 3)**.
8. `gate full`, final render at `--fps 60`, `probe-mp4.sh` (size, fps, duration, loudness), look at six frames, **stop (Gate 4)**, then `gate deliver`.

Approval means the user's own words, passed to `approve --evidence "..."`. Changing the script or storyboard after approval makes that gate and every later one stale. Revising one scene means re-rendering that clip only.

## Hard rules

- No script, no storyboard, no build: do not write scene code or render before the matching `project.mjs gate` says open. Never skip a gate because the video is short or the user sounds in a hurry; a one-frame storyboard is still a storyboard.
- Timing is calculated by `check`, not guessed. A script window that cannot hold its words, a vo line that differs from the script, text on screen too briefly, or a zoom under a landing cursor is an error to fix.
- No invented proof: a number, client, testimonial, offer or domain nobody supplied is a `placeholder` claim and blocks the full render.
- Every frame is a pure function of time: no `Date.now()`, unseeded `Math.random()`, timers or render-time network fetches.
- Cursor targets come from one shared rect table and the check scripts pass; never aim by eye.
- Zoom is smooth (eased in and out, no stiff start), never zoom in and straight back out, never zoom while the cursor lands; the zoomed rect is fully on screen and clear of the narrator.
- A crossfade never mixes two text layouts: scene content leaves before the cut.
- Fonts and assets are local files with relative paths. No emoji or system-font symbols in scenes (they render as empty boxes on machines without those fonts); use SVG.
- Content inside the 90% action-safe box, key text inside 80% title-safe.
- A failed check or a bad still is not a pass. Report what failed, with output.
- Do not publish, upload or send a render anywhere without the user's go-ahead.

Condensed references. For exhaustive detail: `npx hyperframes docs <topic>`, https://www.remotion.dev/docs.
