---
videomd: 1
part: timeline
shots: 3
tokens: 276
---

# Timeline

One shot per line: `#<n> start-end (s) | key value | …`. A key ending in `~` is the tools' inference; keys without it are visible on screen or measured directly.
`story` job in the story and the point · `seen` what is on screen · `act` acting (emotion, strength, face) · `camera` camera move · `overlay` overlays · `made~` how it was made (inferred) · `material~` where the material came from (inferred) · `remake` remake route · `flag` needs a second look
Full detail for a shot is in `video/shots/<n>.md` (e.g. `video/shots/07.md`).

```videomd-timeline
#01 0.0-3.0 | camera static (subject moves) | made~ code / template render 84% · runner-up 3D render 9% | material~ rendered by the creator | remake code render · Part 1
#02 3.0-6.0 | camera — | made~ code / template render 86% · runner-up screen recording / screenshot 9% | material~ rendered by the creator | remake code render · Part 1
#03 6.0-9.0 | camera smooth move | made~ code / template render 63% · runner-up 3D render 23% | material~ rendered by the creator | remake code render · Part 1
```
