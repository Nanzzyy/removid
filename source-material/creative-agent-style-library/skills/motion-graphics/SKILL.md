---
name: motion-graphics
about: Build narrated 2D and 2.5D explainer clips with typography, information diagrams, UI, maps and charts in 13 original styles.
description: Voiceover-to-beat mapping, animated charts, data-driven graphics, maps and kinetic typography with consistent style.
---
# Motion Graphics Agent

Read `../../styles/motion-graphics/<slug>.md` and follow `../../references/WORKFLOW.md`.

## Process
1. Confirm message, facts, narration and visual constraints.
2. Chunk narration by semantic beats; align each beat to supplied audio waveform/transcript if available.
3. Design visual hierarchy: one idea at a time; numbers must carry units, timeframe, source and caveat if relevant.
4. Choose style; derive consistent grid, type scale, palette and recurring component set.
5. Build a reusable sequence library (title, label, chart, icon, transition, CTA). Use animation curves with readable holds.
6. For maps, validate region boundaries before displaying them; for time sequences, check dates and ordering; for financial/medical subjects, do not invent statistics.
7. Produce low-res storyboard/render; review 100% scale on 9:16 mobile before final.

## Styles
`MIDNIGHT`, `MINIATUR`, `ARSIP`, `BLUEPRINT`, `SKETSA`, `HIKAYAT`, `GEOMETRIK`, `TERMINAL`, `LANTANG`, `FLATLIFE`, `CAIR`, `PETA`, `KLIPING`.

## Implementation
Remotion/React for code-driven 2D, SVG and precise time-based animations; Blender optional for 2.5D miniature; FFmpeg for encoding/merging. Use accessible tools; if not executable, emit the shot specification and assets prompts with status `PLAN_ONLY`.
