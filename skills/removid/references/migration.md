# Port into HyperFrames (Remotion first; also Lottie, Three.js, canvas, p5, CSS/GSAP, rendered media)

HyperFrames is the container. Bring each part in at the highest level it supports and record which level you used.

| Level | For | How | Editable afterwards |
| --- | --- | --- | --- |
| Native | Remotion, HTML/CSS/GSAP animation, simple Motion Canvas | translate to HTML + GSAP, verify frame by frame | every element, variables |
| Hosted | canvas, p5.js, Three.js, Lottie, WebGL | keep code, drive it from HyperFrames time (seek protocol in HyperFrames docs: `npx hyperframes docs runtimes`) | timing, position, parameters |
| Media | Manim, After Effects, Blender, moviepy | render to a file, use as a `<video class="clip">` | cut, place, layer |

Code that depends on wall-clock time, live physics or the network can only come in as media.

## Native steps (Remotion)

1. **Triage**. Blockers do not translate; host or refactor, never approximate: `useState`, `useReducer`, `useEffect` with deps, async `calculateMetadata`, React UI kits (MUI, Chakra, Mantine, antd, shadcn, Radix). Dropped with a note: `@remotion/lambda` config, `delayRender`, `useMemo`, custom hooks.
2. **Translate** to the HyperFrames contract (`hyperframes.md`): one sub-composition per scene, seconds = `frame / fps`, root-relative asset paths. Add `* { box-sizing: border-box; }` once in root `<style>` (Remotion's render page does this; without it bordered elements grow).
3. **Keep editable**: props become `data-composition-variables`; each `Sequence` becomes a timed clip or sub-composition; a reused component becomes one sub-composition mounted several times with `data-variable-values`.
4. **Compare frame by frame**: `npx hyperframes snapshot --at <t,...> --against <original.mp4>`. Sample every scene and both sides of every cut; look for one late or recoloured element. Render the Remotion side with `Config.setVideoImageFormat("png")` and `Config.setColorSpace("bt709")` or the diff measures encoders.
5. **Write `TRANSLATION_NOTES.md`**: dropped volume ramps, approximated presentations, substituted fonts.

## API map (Remotion to HyperFrames)

| Remotion | HyperFrames |
| --- | --- |
| `Composition` + `defaultProps` | root `data-*` + `data-composition-variables` |
| `Sequence from/durationInFrames` | `class="clip" data-start data-duration` (seconds) |
| `Series` | consecutive clips; overlap = earlier `data-start` |
| `interpolate` / `spring` | GSAP tween + ease (`power3.out`, `back.out`, `elastic.out`) |
| `AbsoluteFill` | absolutely positioned full-size `div` |
| `Audio` / `Video` | `<audio id>` / `<video data-has-audio>` |
| `staticFile('x')` | `assets/x` |
| `@remotion/transitions` | catalog transitions (`hyperframes catalog`) |

## Final message

List each imported part with its level, what a person can change in Studio, and how the frame comparison came out.
