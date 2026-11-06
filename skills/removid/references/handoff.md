# Handoff: Remotion clips into HyperFrames

Remotion is the source of truth for every scene. HyperFrames only reads the rendered files. Do not translate Remotion code to HyperFrames HTML.

## Render the scene clip (Remotion)

```bash
npx remotion render Hook out/scenes/01-hook.mp4 --props='{"headline":"..."}'
```

- The composition's `fps={60}` decides the clip's fps (`render` has no `--fps` flag). A 30 fps clip in a 60 fps timeline looks stepped, so confirm with `probe-mp4.sh`.
- Give each clip about 0.5 s of handle at head and tail beyond what the cut needs (the scene holds its first and last pose), so HyperFrames can trim without running out of picture.
- Name clips `NN-name.mp4` in order. Keep the Remotion project and its props; the clip is a build output.
- Probe: `scripts/probe-mp4.sh out/scenes/01-hook.mp4 1920x1080 60`.
- Need a transparent overlay? Render with alpha (ProRes 4444 or VP8/VP9 WebM, with `--image-format=png`; exact flags in the Remotion "transparent videos" docs) and layer it as a clip.

## Import into HyperFrames

Copy clips into `assets/scenes/` of the HyperFrames project and mount each as a timed clip (trim with `data-media-start`, the source in-point in seconds):

```html
<video id="s02" class="clip" src="assets/scenes/02-demo.mp4"
       data-start="3.0" data-duration="6.0" data-media-start="0.5"
       data-track-index="0" data-has-audio="false" muted></video>
```

Then `npx hyperframes check --json`. Edit with `timeline trim|split|move` (preview with `--plan --json`). Cuts land on frame boundaries (multiples of 1/60 s) and, when there is music, on measured beats.

## Verify the cut

A trim that is off by a second still plays, so measure. Compare a frame of the final video with the frame of the source clip it should come from (final time minus clip `data-start` plus `data-media-start`), with a full ffmpeg build:

```bash
ffmpeg -ss 14.0 -i final.mp4 -frames:v 1 a.png            # final at 14.0 s (clip starts at 10.7, media-start 1.0)
ffmpeg -ss 4.3  -i assets/scenes/02-demo.mp4 -frames:v 1 b.png   # source at 14.0 - 10.7 + 1.0 = 4.3 s
ffmpeg -i a.png -i b.png -lavfi psnr -f null - 2>&1 | grep average
```

Pick a moment where the picture changes (camera moving, cursor travelling). Measured: the right offset gave about 36 dB, an offset wrong by one second gave 16 dB and 8 dB. Also compare audio levels of the final against the narrator clip (`volumedetect`).

## Rules

- Revision of one scene: re-render only that clip into the same filename, keep `data-start`/`data-duration`, re-run `check`. Other clips are untouched.
- If a revision changes a scene's length, update that clip's duration and shift later clips with `timeline move`, and raise the root `data-duration` first if needed.
- Audio: music and extra voice go in a separate `<audio id=...>`. A narrator clip carries its own voice: keep `data-has-audio="true"` on it; mute the others.
- Raw footage goes in the same way as a clip; cut it in HyperFrames. Cleanup of footage (grades, grain) goes through `npx hyperframes media-treatment`.
- Final render is always from HyperFrames with `--fps 60`.
