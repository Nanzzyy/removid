# Styles

36 styles, three categories. A style is **data** (`styles/styles.json`), not a mood board: palette, rhythm, transitions, camera limit, easing, text size, effects and what to avoid. `project.mjs` checks the storyboard against it and hands it to Remotion, so two videos in the same style look like the same family.

```bash
project.mjs style --list                 # the 36 with one line each
project.mjs style clay                   # the card: look, motion, camera, audio, palette, rhythm, avoid
project.mjs style --for "<brief>"        # the three that fit a topic, with the matching words
project.mjs set-style <proj> <name>      # fix it: Storyboard/style.json, then scaffold writes src/style.ts
```

A name or alias works ("clay", "tanah liat", "mograph"). Names that are ordinary words (system, peta, impact) count as named in a brief only after a cue such as "gaya" or "style".

| Category | How removid builds it | Typical use |
| --- | --- | --- |
| `motion-3d` (13) | Remotion + three.js: a 3D world and character in code (`remotion-three`) | stories, explainers with a character, product showcases |
| `motion-graphics` (13) | Remotion, SVG/CSS 2D and 2.5D (`remotion-2d`) | explainers, data, maps, kinetic type, app promos |
| `video-editor` (10) | the user's footage plus overlays (`footage-overlay`): HyperFrames trims, orders and mixes; the overlay text and graphics are authored in Remotion over the footage | talking heads, podcasts, creator clips |

The library these came from has Blender and NLE routes; removid keeps its own roles (Remotion authors, HyperFrames cuts). A look that needs a real 3D renderer (physically lit clay) is approximated in three.js: say so, and show the first frame before promising more.

## What the tokens mean, and who enforces them

| Token | Meaning | Enforced by |
| --- | --- | --- |
| `palette` bg, fg, accent, accent2, muted | the only colours of the video | tests: text 4.5:1 on the background; each accent readable (3:1) or able to carry text (4.5:1) |
| `shotSec` | a shot lasts this long on average | `check storyboard`: warning when frames average far outside it |
| `transition` kind + seconds | how one frame joins the next (`cut`, `fade`, `slide`, `wipe`; at most 0.5 s) | plan.json per frame; `assemble` writes it into HyperFrames (a `- transition:` line overrides one join) |
| `zoomMax` | the largest zoom | warning above it (LANTANG 1.0 = no camera moves) |
| `maxWords`, `holdMin` | words of on-screen text per frame, extra hold beyond the reading time | error at twice the words, warning above |
| `ease` enter / move | the easing curves (`outCubic`, `inOutSine`, `inOutQuad`, `smootherstep`, `outBack`) | `lib/ease.ts` names; `npm run check` rejects an unknown or broken curve |
| `stepFps` | poses held between steps (pixel 10, clay and paper 12; 0 = smooth) | `stepTime()` in the scene |
| `gestures` | most narrator gestures per 10 s | warning above |
| `sfx` | effect kinds the style uses | warning for another kind |

## In the Remotion project

`src/style.ts` exports `STYLE`. Scenes read colours from `STYLE.palette`, enter animations with `enter(STYLE, t, start)`, camera and slide moves with `move(STYLE, t, start)`, list items with `stagger(i)` and pose time with `stepTime(t, STYLE.stepFps)`. No raw hex colour and no `linear` interpolation in a scene: a linear move reads as mechanical in every style here. Every motion has an easing from the style, and a transition into view is `enter`, out of view is the same curve reversed.

## Choosing

Propose the three that fit (`style --for`), say in one line why each, recommend one. A style named by the user is used as named. Mix only on request: one style per video keeps the rules coherent. Provenance: the names and one-line intents come from the user's `creative-agent-style-library` (public catalogue names, interpreted); the tokens are removid's own and are a starting point the user's eye can change.
