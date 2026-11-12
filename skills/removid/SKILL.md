---
name: removid
description: "Make programmatic video (MP4/GIF/WebM) at 60 fps from a project folder, a calculated script and a storyboard, with approval gates. Remotion (React) authors every scene: UI demos, cursor that lands exactly on its target, smooth zoom-to-highlight, a 3D narrator character that Claude designs for the video (woman, man, pixel, mascot...) with lip sync and emotions, 36 video styles (clay, pixel, paper, blueprint, midnight, lantang...), data-driven batches. HyperFrames cuts and assembles the rendered clips (trim, split, order, transitions, music, final render). Use for /removid, video structure, scripts (naskah) with emotion tags, voiceover, storyboards, video styles, launch films, explainers, UI-interaction demos, narrated videos, social clips, motion graphics, beat-synced edits and cutting raw footage."
argument-hint: "[brief | project name or path | 'doctor' | 'new <Brand> <slug>']"
---

# removid

## Start here (in this order, before anything else)

1. `node <this skill's directory>/scripts/project.mjs version`. If the command does not exist, or it says BEHIND, stop and tell the user to update this skill (`git pull` in their clone, or `./install.sh` again): an old copy lacks the steps below and will produce the old, wrong flow.
2. **Draft nothing in chat**: no script, no plan, no shot list, no "stages". Everything lives in the project folder and is shown by the tool: `intake "<the user's words>" --json`, ask only what it returns, `new`, then `STRUCTURE.md`, then `script-init` (one tagged paragraph per spoken beat; you only replace each TODO with the words).
3. **At Gate 1 your message is the tool's two blocks**: the structure table, and the VO SCRIPT in a code block (only the lines, each opening with its emotion tag, a blank line between). `Storyboard/SCRIPT.md` itself has no seconds at all (`check script` rejects them): one paragraph per spoken beat, each opening with its emotion tag. The VO SCRIPT has no stage labels ("Tahap 1"), no shots, no zoom ideas, no length estimate: those are the storyboard, explained at Gate 2 with `explain`. Never ask where the user's audio is or how long it is: `vo` and `vo-split` measure the file. **The user's format wins:** whenever they ask for "the script" or "naskah" (in or out of a project), the answer is that one block and nothing timed or labelled beside it. Before sending, save your message and run `verify-reply <project> <file>` (`--format-only <file>` outside a project); an error means rewrite, not explain. `references/messages.md` says what to show at every stop.

Two tools, two jobs. Do not blur them: **Remotion** authors and edits every scene (layout, text, UI, cursor, zoom, narrator, charts) and renders each to a clip; **HyperFrames** only cuts and assembles rendered clips and raw footage (trim, order, transitions, music/VO mix, final render). Never author scenes in HyperFrames HTML (`references/handoff.md`).

## Defaults

- **60 fps.** HyperFrames renders at 30 unless told otherwise, and Remotion takes whatever the composition says. Set `fps={60}` in Remotion and `--fps 60` on the HyperFrames render, then verify with `scripts/probe-mp4.sh`. Use 30 only if the user or platform asks.
- 1920x1080 (vertical 1080x1920).
- No voiceover, captions or extra aspect ratios nobody asked for. Whether it is narrated, and who narrates, is settled at intake (below).

## The flow at a glance

| # | Step | Command / file | Stop? |
| --- | --- | --- | --- |
| 1 | Intake: round 1 (type of video, format, voice), round 2 (style of that type, technical needs) | `intake "<brief>" --json`, then `--category <type>` | the questions, two short rounds |
| 2 | Project + style | `new ... --style X` or `style --for`, `set-style` | |
| 3 | Structure, then script with emotions | `Storyboard/STRUCTURE.md`, `SCRIPT.md`, `check script`, `submit script` | **Gate 1** |
| 4 | Voice (agent default, local server, or the user's audio) | `voice-check`, `vo-lines`, `vo-synth`, `vo-place` | |
| 5 | Character and its eighteen preset faces | `scaffold --preview`, `npm run character -- <id> [--emotions]`, `set-character` | the user sees the sheets |
| 6 | Storyboard | `STORYBOARD.md`, `check storyboard`, `submit storyboard` | **Gate 2** |
| 7 | Build scenes, clips, assemble | `gate build`, `scaffold`, Remotion, `assemble` | |
| 8 | 10 s sample | HyperFrames `render --start 0 --end 10` | **Gate 3** |
| 9 | Final | `gate full`, render `--fps 60`, `probe-mp4.sh`, listen | **Gate 4**, `gate deliver` |

`project.mjs status <proj>` always says where a project stands and what comes next. The numbered list below explains each step.

## Interview: two short rounds

Run `project.mjs intake "<the user's words>" --json` first. It reads the brief and returns what is **known** (never ask it again), what is **assumed** (say it in one line; the user corrects it at Gate 1) and the questions still worth asking, recommended answer first. **Round 1** (one call, at most four): the **type of video** (motion graphics, video editing from footage, or motion 3D), format and length, voice and character, proof (only when the brief has numbers, offers or a domain). **Round 2** (one call, after the type is known; `intake "<brief>" --category <type> --json`): the **style of that category** (three that fit, others by name) and its **technical needs** (footage, brand kit, captions, music, data). Questions the brief already answers are skipped; a named style fixes the type and skips the style question. Ask exactly those; if there are none, ask nothing. Never ask for the hook, structure, call to action, fonts, fps or voice engine: propose them in the structure, where the user judges a real table. A script the user already wrote is theirs: keep every word. Never invent a voice, a logo, a client or a number, and never send the script to a service the user has not accepted. Details: `references/intake.md`.

## Route

| Need | Read |
| --- | --- |
| Any new video | `references/workflow.md` (start here), `references/project-folder.md` |
| Short (≤45 s) motion graphics without narration (music and effects always included); ready scene and audio kit | `fast/FAST.md` (same intake, folder and gates; full starter for footage, narration, cursor or target zoom) |
| What the video is made of: beats, footage, one idea each | `references/structure.md` |
| Script (naskah), voice timing, claims | `references/script.md` |
| Emotion tags, voice engines, the voice after the script | `references/emotion-and-voice.md` |
| Pick or apply a style (36), palette, rhythm, transitions, easing | `references/styles.md` |
| The short interview | `references/intake.md` |
| Storyboard, frame/time budget | `references/storyboard.md` |
| Authoring scenes | `references/remotion.md` |
| Cursor, click, zoom highlight, UI demo | `references/cursor-and-camera.md` (mandatory) |
| Narrator character, voice, lip sync | `references/character-and-narration.md` |
| Cutting, trimming, assembling, raw footage, music | `references/hyperframes.md`, `references/handoff.md` |
| Easing, durations, stagger, framing, beat sync | `references/motion-design.md` |

Existing project: run `scripts/project.mjs status <name or path>` and read its `PROJECT.md` first; it is the truth, not the chat. If the user's argument is just the word `doctor`, run `scripts/doctor.sh`, report and stop; if it starts with `new`, run the first workflow step with the brand and slug that follow. Anything else is the brief for a new video.

## Workflow: a gate is a hard stop, and `scripts/project.mjs` enforces it

`project.mjs` below means `node <this skill's directory>/scripts/project.mjs` (the directory holding this file; use the absolute path, the shell is usually elsewhere).

1. **Intake** (above), then `project.mjs new <Brand> <slug> --brief "the user's own words" --style <name> ...` (folder schema: `references/project-folder.md`). Style: `style --for "<brief>"`, `set-style`. Analyse the user's references.
2. **Structure** in `Storyboard/STRUCTURE.md`: beats with time, purpose, what is shown, which footage, the ONE idea, the emotion (`references/structure.md`). Then **script** in `Storyboard/SCRIPT.md`: timed blocks inside those beats, each opening with an emotion tag (`[curious] ...`; any emotion word works, `[nostalgic]`, `[furious]`, `[gembira]`; delivery words after a comma), plus the claims table. `check script` computes words, seconds and the delivery arc; fix every error. `submit script`, show the table, **stop (Gate 1 = structure + script)**. Silent video: no Gate 1; the structure is checked with the storyboard.
3. **Voice, after Gate 1** (narrated): `voice-check` shows the routes; install nothing. (a) The agent's default voice: `vo-lines <proj> --engine edge` gives each line with rate/pitch/volume from its emotion (tags are never read aloud). (b) A local speech server the owner already runs: `vo-synth <proj>`. (c) The user's own audio, one file per line or one recording. Then `vo-place <proj> --fit --lufs -15` or `vo <proj> <audio>` measures the real timing.
4. **Character** (narrated): Claude designs it (woman, man, pixel, mascot...), `scaffold --preview`, `npm run character -- <id>` and `-- <id> --emotions` render its sheet and its eighteen preset faces, show the user, `set-character <proj> <id>` (or `none` = voice only).
5. **Storyboard** in `Storyboard/STORYBOARD.md`: frames (every beat boundary is a frame boundary), vo windows, text, cursor stops, zooms, narrator cues, transitions, assets, in numbers. `check storyboard` (checks the style, writes `plan.json` with frame counts, style and emotion segments), `submit storyboard`, **stop (Gate 2)**.
6. `gate build`, `scaffold`, then **Remotion** builds the scenes from `plan.json` and `src/style.ts`: `npm run check`, stills (start, mid, end, each click, each zoom hold), `npm run check:cursor`, scene clips at 60 fps with handles, `probe-mp4.sh`.
7. **HyperFrames** cuts and assembles the clips with the style's transitions, mixes audio (skipped only when the result is one Remotion scene with no cuts, footage or audio mixing): `sfx.mjs` for effects, `project.mjs assemble` for `index.html`, `check`. Render the 10 s sample (`--start 0 --end 10`), **stop (Gate 3)**.
8. `gate full`, final render at `--fps 60`, `probe-mp4.sh --require-audio` (size, fps, duration, loudness; a video without sound fails), look at six frames, listen on the player the user will use, **stop (Gate 4)**, then `gate deliver`.

Approval means the user's own words, passed to `approve --evidence "..."`. Changing the structure, the script (a word, a time, an emotion tag), the style or the storyboard after approval makes that gate and every later one stale. Revising one scene means re-rendering that clip only.

## Hard rules

- Say each thing once, at its own stop (`references/messages.md`).
- The folder schema is mandatory (`references/project-folder.md`): never work outside the project folder; if `status` says FOLDER INCOMPLETE, run `repair`. Every file the build uses is listed in `Asset/ASSETS.md`.
- No script, no storyboard, no build: do not write scene code or render before the matching `project.mjs gate` says open. Never skip a gate because the video is short or the user sounds in a hurry; a one-frame storyboard is still a storyboard.
- Order is fixed: intake, style, structure, script, voice, character, storyboard. The voice is never made before the script is approved.
- One emotion tag drives the voice, the narrator's face and the gestures; a gesture that contradicts the delivery (a wave while `sad`) is a defect. Movement is eased with the style's named curves, never linear, and stays consistent: the same emotion always looks the same.
- A style's palette, rhythm, transitions and limits come from `src/style.ts` / `plan.json`, not from memory; one style per video unless the user asks to mix.
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
