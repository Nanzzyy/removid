---
videomd: 1
part: timeline
shots: 3
tokens: 375
---

# Timeline

One shot per line: `#<n> start-end (s) | key value | …`. A key ending in `~` is the tools' inference; keys without it are visible on screen or measured directly.
`story` job in the story and the point · `seen` what is on screen · `act` acting (emotion, strength, face) · `camera` camera move · `overlay` overlays · `made~` how it was made (inferred) · `material~` where the material came from (inferred) · `remake` remake route · `flag` needs a second look
Full detail for a shot is in `video/shots/<n>.md` (e.g. `video/shots/07.md`).

```videomd-timeline
#01 0.0-3.0 | story grab attention, An attention-grabbing test patte… | seen A colour-bar test pattern with a moving diagonal ramp and a … | camera static (subject moves) | made~ code / template render 90% · runner-up 3D render 14% | material~ rendered by the creator | remake code render · Part 1
#02 3.0-6.0 | story add information, A blank card where a title woul… | seen A flat navy background with one white rectangle: a plain lay… | camera — | made~ code / template render 93% · runner-up screen recording / screenshot 7% | material~ rendered by the creator | remake code render · Part 1
#03 6.0-9.0 | story deliver the conclusion, A computed visual closes… | seen A Mandelbrot fractal in pink, green and grey, slowly zooming… | camera smooth move | made~ code / template render 89% · runner-up 3D render 32% | material~ rendered by the creator | remake code render · Part 1
```
