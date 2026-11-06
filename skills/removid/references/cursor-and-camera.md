# Cursor, click and zoom-highlight (Remotion)

Implemented and tested in `templates/remotion-starter` (`src/lib/camera.ts`, `src/lib/cursor.ts`, `src/components/`). Copy it with `scripts/new-project.sh`; do not re-derive the maths.

Failures this prevents: a cursor that does not land on what it points at (guessed coordinates, the cursor box positioned instead of its tip, a camera zoom moving the target after the cursor was placed, teleporting or fading cursors, click rings in empty space) and zooms that start or stop with a jolt.

## Model

- **Canvas coordinates** hold the content and every target.
- **Camera** `{s, tx, ty}`: `screen = canvas * s + (tx, ty)`. Wrap content in `<Camera cam={cam}>`.
- The **cursor path is planned in canvas coordinates** and mapped through the camera when drawn, so the tip stays glued to the content during any zoom.
- UI elements are positioned FROM the target table (`TargetBox` / `rectStyle`), and the cursor aims AT the same table. One source of truth.

## Scene data (the only thing you normally edit)

```ts
// src/scenes/<scene>.data.ts
export const T = {                       // canvas px
  search: {x: 360, y: 190, w: 1200, h: 96},
  buy:    {x: 1060, y: 760, w: 420, h: 104},
} as const satisfies Targets;

export const CURSOR: CursorPlan = {
  start: {x: 300, y: 700},               // on canvas; never off-screen
  stops: [
    {target: 'search', at: 1.2, click: true},   // `at` = ARRIVAL time in seconds
    {target: 'buy',    at: 3.6, click: true, aim: {fx: 0.5, fy: 0.5}},
  ],
};

export const SHOTS: ZoomShot[] = [
  {focus: {x: 1000, y: 720, w: 540, h: 184}, start: 2.1, inDur: 0.8, hold: 1.7, outDur: 0.7, fill: 0.4, maxScale: 1.6},
];
```

The library derives departure from distance, holds `dwell` (0.12 s) on the target, then clicks. Do not type coordinates from a screenshot.

## Cursor rules (enforced by `npm run check`)

- Tip is the arrow's origin (the SVG is drawn with its tip at 0,0); translate that origin to the point. Never centre the cursor box on the target.
- Size at least 56 px on a 1440 px canvas (72 px at 1920).
- Peak speed at most 35 px per frame at 60 fps; longer distance means start earlier, not faster. No teleport, no fade-and-reappear.
- x and y use different easings so the path curves; it slows into the target and holds at least 2 frames before the click.
- Click: cursor scales to 0.82, ring expands at the tip, the target presses to 0.95 and springs back. The UI responds AFTER the click time (`legs[i].clickAt`).
- Never leaves the canvas. Camera still for at least 0.1 s before the tip arrives.
- Two stops are at least 0.64 s apart: 0.4 s minimum travel + 0.12 s dwell + 0.12 s click release (`planCursor` frees the cursor 0.6 × `CLICK_RELEASE` after the click). A long move needs distance ÷ 900 px/s instead. `check storyboard` enforces the same number.

## Zoom-highlight rules (enforced by `npm run check`)

- `camAt(t, SHOTS, W, H)`: scale interpolated in log space, focus point drifts to its anchor (default screen centre), smootherstep in and out (zero velocity and acceleration at both ends), view clamped inside the canvas.
- Zoom in 0.6-0.9 s for a big zoom (at least 0.4 s for a small one), hold at least 0.5 s so it can be read, zoom out 0.6-0.7 s.
- `fill` = fraction of the canvas width the focus should fill; `maxScale` caps it (default 1.8; above 2 bitmaps go soft, vector DOM stays sharp).
- Gap between two shots at least 0.15 s (no zoom in-out-in). Focus must be inside the canvas, so pad a rect near the edge only as far as the canvas allows.
- Highlight, do not hide: `anchor` moves the focus off-centre when something else (a narrator) occupies the screen. The narrator and its resting arms cover x 0 to about 870 on a 1920 canvas (measured: 137..873 px), so the starter declares `KEEP_CLEAR = {x: 0, w: 880}` and the Narrator scene uses `anchor: {x: 0.70, y: 0.5}`.
- **Framing at full zoom is checked** (`checkFraming` in `npm run check`): the highlighted rect must be completely on screen (FAIL if clipped), should sit inside the 90% safe box (WARN: a target in a canvas corner cannot be centred), and must not overlap the keep-clear zone (FAIL). A promo scene once passed every other check with its zoomed card clipped 32 px by the screen edge and overlapped by the narrator; only a still showed it. Size the focus rect so that `focus.w × scale` fits the free width (here 1920 − 880 − margin ≈ 940 px, so a 600 px card at 1.5×).
- `<Spotlight rect cam strength>` dims everything outside the focus (strength = `zoomProgress`). Keep the dim light (0.32): heavy dimming muddies saturated colours.
- Loops: the first and last framing are identical.

## Verification

```bash
npm run check          # numeric: smoothness at both ends of every move, gaps, speed, hold, camera stillness, arrival inside target
npm run check:cursor   # PIXELS: renders debug stills at every arrival and click and measures them
```

`check:cursor` renders with `debug=true`. Debug draws, from independent sources: a magenta crosshair at the cursor tip, a lime outline drawn by the visible element itself (`TargetBox`), and a cyan outline from the table (outside the element). It passes only when (1) the tip is within 3 px of the planned aim point, (2) the tip is inside the visible element, and (3) that element sits where the table says. Check (1) matters: "inside the element" alone lets a 90 px miss pass on a wide button.

For a new scene pass its data module: `node scripts/check-click-stills.mjs Promo3 src/scenes/promo.data.ts` (the module exports `T`, `CURSOR`, `SHOTS`; set the `check:cursor` script in `package.json` to that command). A clip rendered from `startFrame` is handled: the times in the data are global. Give the scene's `TargetBox`es the `debug` prop. Targets can sit as close as you like: each lime box is searched only just outside its own expected rect.

`npm run stills -- 0.8,9.9,10.9 --prefix Promo` renders stills at global times (bundles once, picks the clip from `plan.json`, applies `startFrame`; `--debug` shows the target outlines). Also look at the stills yourself: one inside each zoom hold (text sharp, focus framed, nothing important cropped) and the frames around each click (ring at the tip, response after the press).

## Pitfalls found while testing

- A debug outline drawn over the element's own outline hides it and makes the check pass by accident; draw the table outline outside the element.
- Focusing on something at a canvas edge: the camera clamps, so the focus cannot reach the centre. Expect the highlight to sit at the edge; do not pad the focus outside the canvas.
- A zoom factor that enlarges one element over another (a card growing behind a character) hides content; use `anchor`.
- The lime-outline scan used a fixed 60 px search margin: two targets 40 px apart were read as one box and the (correct) cursor was reported as misaligned. The margin now follows each target's tolerance.
- Emoji in scenes render as empty boxes on machines without an emoji font; use SVG icons.
