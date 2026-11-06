# GSAP for video (HyperFrames and any seekable HTML)

In video the timeline is the clock: build one paused timeline, never rely on real time.

## Core

```js
const tl = gsap.timeline({paused: true, defaults: {duration: 0.6, ease: 'power3.out'}});
tl.from('#title', {y: 40, opacity: 0})                 // appended after previous
  .from('#sub', {y: 24, opacity: 0}, '<0.15')          // 0.15 s after previous START
  .to('#card', {x: 200}, 2.0)                          // absolute time 2.0 s
  .to('#card', {opacity: 0}, '+=0.5')                  // 0.5 s after timeline end
  .addLabel('outro', 5).to('#logo', {scale: 1.1}, 'outro');
window.__timelines['intro'] = tl;                      // HyperFrames: register after all tweens
```

- Methods: `to`, `from`, `fromTo`, `set`. Prefer `fromTo` when start state matters for seeking.
- Position parameter: number = absolute; `"+=0.5"`/`"-=0.2"` relative to end; `"<"` start of previous, `">"` end of previous, `"<0.2"` offset from previous start; `"label"`, `"label+=0.3"`.
- `stagger: 0.06` (or `{each, from: 'center'}`) on multi-target tweens.
- Eases: entrance `power3.out` / `expo.out`; exit `power2.in`; reposition `power2.inOut`; playful `back.out(1.7)`; physical `elastic.out(1, 0.4)`.
- Nest timelines for scenes; do not tween the same property on the same target from two overlapping tweens (use `overwrite: 'auto'` or restructure).

## Video-specific rules

- Animate `x, y, scale, rotation, opacity`, not `left/top/width/height`.
- Never use `repeat: -1`; compute the repeat count for the clip length (`repeat: Math.ceil(dur / cycle) - 1`).
- No `onComplete` side effects that depend on playback; seeking skips callbacks.
- Do not tween `display`/`visibility`/`autoAlpha` on a `.clip` container; animate a child.
- Do not put CSS `transform` on an element GSAP also transforms.
- ScrollTrigger/Draggable are for interactive pages, not video.

## Plugins commonly useful in video

`SplitText` (kinetic type: chars/words/lines), `DrawSVGPlugin` (stroke draw), `MorphSVGPlugin`, `MotionPathPlugin`. Check the licence/CDN availability in the project before relying on them.

Upstream detail: https://gsap.com/docs/v3/ and the `gsap-core`, `gsap-timeline`, `gsap-plugins` skills if installed.
