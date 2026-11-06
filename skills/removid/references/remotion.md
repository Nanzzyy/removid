# Remotion: author and edit scenes

Every frame is a pure function of `useCurrentFrame()`: deterministic, scrubbable, renderable in CI. Remotion owns every scene in this workflow (layout, text, UI, cursor, camera, charts, data-driven props). Remotion Studio is the editor. Rendered clips then go to HyperFrames (`handoff.md`).

## Start from the starter

`scripts/new-project.sh <dir>` copies `templates/remotion-starter`: two sample scenes (`UiDemo` with cursor and zoom, `Narrator` with the 3D character), the camera/cursor/pose libraries, and the check scripts. Pinned: Remotion 4.0.541, React 19, three 0.186, zod 4.6.7 (all `remotion` and `@remotion/*` packages must share one exact version, and Remotion requires a specific zod: `npx remotion versions` says if they drift). Node 22.18+ (the check scripts run `.ts` directly).

## fps: 60

Set `fps={60}` on every `<Composition>`. Plan in seconds, convert once:

```tsx
const {fps} = useVideoConfig();
const s = (sec: number) => Math.round(sec * fps);   // 0.5 s -> 30 frames at 60 fps
```

Durations written as raw frame counts (`[0, 30]`) silently halve in time when fps doubles, so always go through `s()`.

## Core API

```tsx
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing, Sequence, Series, AbsoluteFill, Audio, staticFile, random} from 'remotion';

const frame = useCurrentFrame();
const {fps, durationInFrames, width, height} = useVideoConfig();

// Always clamp: default interpolate extrapolates linearly past the range.
const opacity = interpolate(frame, [0, s(0.5)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
const pop = spring({frame, fps, config: {damping: 200}}); // 200 = no bounce; lower = bouncier
```

- `frame / fps` converts to seconds.
- `<Sequence from durationInFrames>`: children see `frame` reset to 0 at `from`.
- `<Series>` lays segments back to back; `offset={-s(0.25)}` overlaps for a crossfade.
- `random('seed')` for stable randomness. Never `Math.random()` / `Date.now()` / timers.
- Animate `transform` and `opacity`; avoid animating `left/top/width/height` on small inner elements (pixel snapping looks stepped at 60 fps).
- No GSAP in Remotion scenes; use `interpolate`/`spring`.

## Composition with typed props

```tsx
import {Composition} from 'remotion';
import {z} from 'zod';

export const schema = z.object({title: z.string(), accent: z.string(), debug: z.boolean().default(false)});

<Composition id="Promo" component={Promo} durationInFrames={300} fps={60} width={1920} height={1080}
  schema={schema} defaultProps={{title: 'Launch', accent: '#5b8cff', debug: false}} />
```

Data-dependent length: `calculateMetadata` derives `durationInFrames` (and props) before render. `calculateMetadata` can also set `fps`.

## Audio

`<Audio src={staticFile('track.mp3')} />` is for previewing a scene against its track. Final music and voice are mixed in HyperFrames. Detect beats offline and bake timestamps into props; never analyse audio at render time.

## Assets and fonts

`staticFile()` for files in `public/`. Load fonts with `@remotion/google-fonts` or `@font-face` and hold the render with `delayRender()` / `continueRender()` until loaded.

## Commands

```bash
npx remotion studio                                   # the editor
npx remotion compositions                             # ids, fps (must read 60), durationInFrames
npx remotion still Promo out/f0.png --frame=0 --props='{"title":"Launch"}'
npx remotion render Promo out/scenes/01-promo.mp4 --props='{"title":"Launch"}'
```

Last frame index = `durationInFrames - 1`. Render stills with the props you ship.

## Batch rendering (Node)

Bundle once, then `selectComposition()` + `renderMedia()` per row with `inputProps`. Verify one row's stills first.

## Gotchas

- Clamp every `interpolate`.
- No state-driven animation (`useState` for motion); derive from the frame.
- `useCurrentFrame` inside a `Sequence` is local.
- Shaders/Three.js: `@remotion/three`; drive uniforms from the frame.
- Cursor and zoom: `cursor-and-camera.md`. Narrator character: `character-and-narration.md`.
- WebGL/three.js: `remotion.config.ts` must set `Config.setChromiumOpenGlRenderer('swangle')` (plain `'angle'` failed on Chrome 158).
- No emoji or system-font symbols in scenes; they render as empty boxes where the font is missing. Use SVG.
- Keep `debug` as a composition prop for any scene with a cursor, so debug stills are one `--props` away.
- The ffmpeg on PATH can be a minimal build: Remotion renders fine with it, HyperFrames does not (see `hyperframes.md`).
