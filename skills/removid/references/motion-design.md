# Motion design: how it should move

Settle three things before picking numbers: **emotional intent** (what should the viewer feel), **visual narrative** (setup, action, resolution), **craft** (weight, follow-through, arcs).

## Layers

Believable motion runs three layers: **Hero** (the move the eye follows), **Support** (shadows, icons, labels reacting late), **Texture** (slow ambient drift). Only the hero earns attention.

## Easing

| Action | Curve |
| --- | --- |
| Enter | ease-out `cubic-bezier(0.16, 1, 0.3, 1)` (GSAP `expo.out`/`power3.out`) |
| Exit | ease-in `cubic-bezier(0.7, 0, 0.84, 0)` (`power2.in`) |
| Move, stays on screen | ease-in-out `cubic-bezier(0.65, 0, 0.35, 1)` (`power2.inOut`) |
| Playful / branded | overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)` (`back.out`) |

`linear` only for continuous loops. Decelerate into rest; the eye forgives a slow end less than a slow start.

## Duration

| Element | Duration |
| --- | --- |
| Micro (hover, toggle, tap) | 0.1-0.2 s |
| Panel / UI transition | 0.2-0.4 s |
| Hero / full-screen | 0.4-0.8 s |
| Cinematic camera move | 0.8-2 s |

Add ~30-50% when distance or area doubles. Heavy objects start slowly and overshoot less.

## Stagger and rhythm

- Lists: 40-80 ms between items. Dense grids: 20-40 ms. Cap a group reveal near 0.6-0.8 s.
- Follow the eye: top-to-bottom, or radiating from a focal point.
- **1/3 rule**: nothing travels more than ~1/3 of the screen without an intermediate change; with 3+ elements, no more than ~1/3 move at once.
- Anticipation (60-120 ms counter-move) and follow-through (settle late) sell weight.

## Composition and colour

- Action-safe 90%, title-safe 80%. One focal point per shot. Hold the key frame long enough to read (about 0.3 s per 3 words of copy plus 0.5 s).
- Contrast: body text at least 4.5:1 against its background at every frame (including mid-fade).
- Keep a small palette (1 brand accent + neutrals); animate accent changes deliberately.

## Beat sync

Detect beats offline (HyperFrames: `npx hyperframes beats`), snap hero hits and cuts to beats, land accents on the beat not after it. Offset motion by 1-2 frames early so the perceived hit is on the beat. Bake timestamps; never analyse audio at render time.

## Quick diagnosis

| Symptom | Likely fix |
| --- | --- |
| Robotic | linear or symmetric easing; use asymmetric ease-out |
| Floaty / weightless | too short or too long for size; add settle, shorten ease tail |
| Noisy | too many things moving at once; apply 1/3 rule, hold the supports |
| Flat | only one layer moves; add Support and Texture |
| Cheap | everything bounces; keep overshoot for one hero element |
