# Remotion (React, frame-driven)

Every frame is a pure function of `useCurrentFrame()`: deterministic, scrubbable, renderable in CI. Best for templated or data-driven output (one composition, many renders from props) and for reusing React components.

## Core API

```tsx
import {useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Series, AbsoluteFill, Audio, staticFile, random} from 'remotion';

const frame = useCurrentFrame();
const {fps, durationInFrames, width, height} = useVideoConfig();

// Always clamp: default interpolate extrapolates linearly past the range.
const opacity = interpolate(frame, [0, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
const scale = spring({frame, fps, config: {damping: 200}}); // 200 = no bounce; lower = bouncier
```

- `frame / fps` converts to seconds.
- `<Sequence from durationInFrames>`: children see `frame` reset to 0 at `from`. Use `useVideoConfig().durationInFrames` for the composition length, not the sequence's.
- `<Series>` lays segments back to back; `offset={-15}` on a `Series.Sequence` overlaps the previous one (crossfade).
- `random('seed')` for stable randomness. Never `Math.random()` / `Date.now()` / timers.

## Composition with typed props

```tsx
import {Composition} from 'remotion';
import {z} from 'zod';

export const schema = z.object({title: z.string(), accent: z.string()});

<Composition id="Promo" component={Promo} durationInFrames={150} fps={30} width={1080} height={1920}
  schema={schema} defaultProps={{title: 'Launch', accent: '#5b8cff'}} />
```

Data-dependent length: use `calculateMetadata` to derive `durationInFrames` (and props) before render, never by hand.

## Audio and beats

`<Audio src={staticFile('track.mp3')} />`. Detect beats offline and bake timestamps into props; headless rendering has no realtime audio clock, so never analyse audio at render time.

## Assets and fonts

Use `staticFile()` for files in `public/`. Load fonts with `@remotion/google-fonts` or `@font-face`, and hold the render with `delayRender()` / `continueRender()` until loaded, or fonts pop in mid-render.

## Commands

```bash
npx remotion studio                                   # interactive preview
npx remotion compositions                             # ids, fps, durationInFrames
npx remotion still Promo out/f0.png --frame=0 --props='{"title":"Launch"}'
npx remotion render Promo out/promo.mp4 --props='{"title":"Launch"}'
npx remotion render Promo out/demo.gif --codec=gif
```

Last frame index = `durationInFrames - 1`. Render stills with the SAME props you ship.

## Batch rendering (Node)

Bundle once, render many with `@remotion/renderer`: `bundle()` then `selectComposition()` + `renderMedia()` per row, passing `inputProps`. Verify one row's stills first.

## Gotchas

- Clamp every `interpolate`.
- No state-driven animation (`useState` for motion); derive from the frame.
- `useCurrentFrame` inside a `Sequence` is local.
- Shaders/Three.js: `@remotion/three`; drive uniforms from the frame.
- Needs Node.js and FFmpeg available (Remotion bundles its own compositor; system ffmpeg is still useful for probing).
