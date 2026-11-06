---
name: removid
description: Make, edit, port and render programmatic video (MP4/GIF/WebM) from code with Remotion (React) or HyperFrames (HTML+GSAP). Use for /removid, launch films, explainers, social clips, title cards, data-driven or per-record batch videos, motion graphics, beat-synced edits, and porting Remotion to HyperFrames. Routes to the right engine, runs a brief-to-render workflow with approval gates, and verifies frames before encoding.
argument-hint: "[brief | path-to-project | 'doctor']"
---

# removid

One entry point for code-made video. Pick the engine, follow the workflow, load only the reference you need.

## 1. Pick the engine

| Situation | Engine | Read |
| --- | --- | --- |
| New video, launch/explainer/social/music clip, person will keep editing it | **HyperFrames** (default) | `references/hyperframes.md` |
| Project already uses Remotion, React components must be reused, or one composition renders many outputs from rows/props (CSV, DB) | **Remotion** | `references/remotion.md` |
| Existing Remotion/Lottie/Three.js/canvas work should become HyperFrames | **Port** | `references/migration.md` |
| Needs GSAP timelines (inside HyperFrames) or web animation | GSAP | `references/gsap.md` |
| Unsure how it should feel/move: easing, durations, stagger, colour, framing, beat sync | Motion design | `references/motion-design.md` |

Existing project: detect the engine from the files (`remotion.config.*` or `remotion` in `package.json` = Remotion; `index.html` with `data-composition-id` = HyperFrames) and stay in it. Do not switch engines unless asked.

If `$ARGUMENTS` is `doctor`, run `scripts/doctor.sh` and report; stop.

## 2. Workflow (all engines)

Read `references/workflow.md` for details. Short form:

1. **Brief**: goal, audience, length, aspect/size/fps, brand assets, copy, music or voice. Defaults: 1920x1080, 30 fps. Do not add voiceover, captions or extra aspect ratios nobody asked for. Ask only what blocks the work.
2. **Plan (gate 1)**: shot list with seconds, engine choice, assets needed. Show it and wait for approval unless the user said "no stops".
3. **Build**: scenes as separate units; text, colours and media as variables/props, not hard-coded.
4. **Check**: engine linter/validator, then render **stills** at start, mid and end of every scene. Look at them (text overflow, off-canvas, safe area, fonts, wrong data).
5. **Sample (gate 2)**: render a short sample (about 10 s, or the busiest scene) at draft quality and show it. Wait for approval.
6. **Deliver**: full render, then `scripts/probe-mp4.sh out.mp4 WxH fps` to assert size, fps, duration and non-empty file. Tell the user where the file is and what is editable.

## 3. Hard rules

- Every frame is a pure function of time. No `Date.now()`, unseeded `Math.random()`, timers, network fetches at render time, or infinite repeats.
- Fonts and assets are local files referenced by relative path; wait for them before rendering.
- Keep content inside the 90% action-safe box and key text inside 80% title-safe.
- Never pass a render if the check or the stills fail. Say what failed, with output.
- Do not publish, upload or send a render anywhere without the user's go-ahead.

## 4. Authoritative sources

These references are condensed. For exhaustive or version-specific detail use the engine's own docs: `npx hyperframes docs <topic>`, `npx remotion --help`, https://www.remotion.dev/docs. If the full upstream skills are installed (`/hyperframes`, `/hyperframes-cli`, `/remotion-to-hyperframes`), defer to them on conflicts.
