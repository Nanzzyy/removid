# HyperFrames (HTML + GSAP rendered by seeking a paused timeline)

Renders HTML to video by seeking a paused timeline frame by frame, so every render is identical. The person can keep editing the same files in the Studio preview. Needs Node.js 22+ and FFmpeg. Run `npx hyperframes <command>`; every command has `--help`, most take `--json`.

## Project shape

- `index.html`: root composition. Declares variables, mounts one scene per sub-composition.
- `compositions/*.html`: scenes. Everything lives inside `<template>`; style the root as `#root`.
- `assets/`: media, `assets/fonts/` for custom fonts.

New project: `npx hyperframes init <dir>`. Website as subject: `npx hyperframes capture <url> --json`. Before hand-writing a named effect, transition, caption style, chart or card: `npx hyperframes catalog --query "<what>" --json`, then `add`.

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="12" data-width="1920" data-height="1080">
  <div id="intro" data-composition-id="intro" data-composition-src="compositions/intro.html"
       data-start="0" data-duration="4" data-track-index="1" data-width="1920" data-height="1080"></div>
</div>
<script>window.__timelines["main"] = gsap.timeline({paused: true});</script>
```

## Contract (what `check` enforces)

1. Every timed element has `class="clip"`, `data-start`, `data-duration` (seconds); visible over `[start, start+duration)`. Land the end state just before the end. `data-track-index` is a Studio lane only; paint order is `z-index`.
2. Video length = root `data-duration`. Overrun is cut; early end holds the last frame.
3. Each composition builds ONE paused timeline and registers it after its tweens: `window.__timelines["<data-composition-id>"] = tl`.
4. No `Date.now()`, unseeded `Math.random()`, network fetches, timers, `repeat: -1`.
5. Never tween `display`, `visibility` or `autoAlpha` on a `.clip`; animate a child.
6. No CSS `transform` on an element GSAP also transforms. Animate transforms, not `left/top/width/height`.
7. Never `play()`/`pause()`/seek media. `<video>` keeps sound with `data-has-audio="true"`, else `muted`. Music/voice is a separate `<audio>` with an `id`. No `crossorigin` on media. Time a `<video>` or its wrapper, never both.
8. Only bundled fonts resolve by name; others need `@font-face` to `assets/fonts/`.
9. Asset paths: `assets/...`, no leading `/`, in sub-compositions too.
10. Grades, grain, blur, vignette on footage go through `npx hyperframes media-treatment`, not CSS filters.
11. Intended overflow/overlap: `data-layout-allow-overflow`, `data-layout-allow-overlap`.

## Keep it editable

One scene per sub-composition; timed elements written in HTML with stable `id`s (not created by script); copy, colours and swappable media as variables (`data-composition-variables`, `data-var-text`, `data-var-src`, `var(--id)`); one kind per track (`data-track-kind="graphics"`, `captions`).

## Loop

```bash
npx hyperframes lint                       # while writing
npx hyperframes check --json               # gate: lint, runtime, layout, contrast
npx hyperframes snapshot --at 1,5,9        # PNGs in .hyperframes/artifacts/snapshots/ ; read them
npx hyperframes preview --background       # give the user the URL, wait for approval
npx hyperframes render --quality draft --output sample.mp4     # iterate
npx hyperframes render --quality delivery --output out.mp4     # final
```

- While a lint error remains, layout and contrast audits do not run; "0 samples" means nothing was checked.
- A 3 s+ video with no visible change fails `sweep_static`.
- Existing project: `npx hyperframes timeline --json` shows what plays when. Timeline edits: `timeline move|trim|split|set|duplicate|delete <ref> --plan --json`.
- Render variants: `--docker --strict` (reproducible), `--batch rows.json --output "renders/{name}.mp4"`, `cloud render` (hosted).
- Failures: `doctor --json` (gate on `.ok`), `browser ensure` if Chrome is missing, raise `--timeout` for heavy pages, never delete `.hyperframes` (history).
- After render: file non-empty, `ffprobe` duration equals root `data-duration`, then look at decoded frames.

## Other sub-skills (if installed upstream)

`/media-use` (voice, music, footage, treatments), `/hyperframes-registry` (catalog), `/slideshow` (decks), `/figma`. Full docs: `npx hyperframes docs <topic>`.
