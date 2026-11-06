---
title: {{slug}}
size: {{size}}
fps: 60
duration: {{duration}}
message: TODO
arc: TODO hook, proof, payoff
---
# Storyboard: {{slug}}

<!--
One "## Frame N — name" per shot, numbered 1..N, contiguous, global seconds. Keys (one per line):
- time: 0.00–3.00
- scene: what the viewer sees, concrete enough to build from
- engine: remotion | footage            (HyperFrames never authors a scene; "footage" = raw clip it cuts)
- asset: files or "kit shapes only"     (list what must exist before the build)
- vo: 0.30–2.60 "exact words"           (repeat the key for more lines; "- vo: none" for silence)
- text: 0.40–2.80 "ON SCREEN TEXT"      (visible >= max(1 s, 0.3 s per word))
- zoom: target 2.10–5.30 scale=1.6      (in=0.8 out=0.7 by default; window includes both ramps)
- cursor: target @1.20 click            (arrival time; click happens 0.12 s later)
- narrator: wave 0.05–1.60 | point 4.00–7.50 R at target | present 8.10–10.50
- sfx: impact @0.00 gain=0.8             (click | tick | whoosh | impact | chime; cursor clicks add a click automatically)
- reads: what the viewer takes from this frame
- sound: music notes (free text, never produced; use sfx: for effects)
After the last frame the video ends at `duration`. Run: project.mjs check storyboard <project>
-->

## Frame 1 — TODO name
- time: 0.00–TODO
- scene: TODO
- engine: remotion
- asset: TODO
- vo: none
- reads: TODO
