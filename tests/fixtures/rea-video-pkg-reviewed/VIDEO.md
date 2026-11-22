---
videomd: 1
name: ref
description: 'Made with (inferred): code / template render 100%'
source:
  file: ref.mp4
  sha256: ae4f402198fd84e71873915b8c2c9347540673ecec80e807ac37e546c57b8645
  duration: 9.0
  size: 640x360
  fps: 30.0
  aspect: '16:9'
shots: 3
lang: en
made_mix:
  code_render: 1.0
confidence: 0.905
readers:
- tools
- agent
open_questions: 1
generator:
  name: rea-video
  version: 0.1.0
---

# ref.mp4

**Verdict** (inferred): code / template render 100%
**Narrative**: #01 grab attention → #02 add information → #03 deliver the conclusion
**Made with** (inferred, by duration): code / template render 100%
**Remake**: code render / screen capture 3 shots → 1 code project

## Next steps

- Remake: `rea-video remake <this dir>` does what can be done automatically and keeps the original elsewhere; `remake/status.md` says per shot what is left. Add incoming clips to `remake/mine.json` and run it again
- Code-rendered shots are redrawn by `rea-video code-remake <this dir>` (the step above runs it): edit `code/spec.json` and rerun, do not write one from scratch

## Open questions

- No AI listened to the soundtrack (the review covered the picture only): real voice versus TTS is inferred from the waveform; the effects were picked off the mix…

## Map

Read this page first; for detail, open only the file you need. Each line is `path | ~tokens | what is in it · when to read it`; paths are relative to this directory.

```videomd-map
video/timeline.md | 389 | Timeline: one line per shot · what a stretch says, which shots need review, how a shot was made
video/content.md | 179 | Content and structure · what it says, the narrative line, structure, the script
video/cast.md | 32 | Cast, scenes and props · reference images for characters, first-frame prompts
video/sound.md | 126 | Sound · voice, music, sound effects, beats and sources
video/look.md | 139 | Camera, lighting and editing · for filmed shots: framing, camera, lighting, kit
video/remake.md | 1872 | Remake plan · generation units, shoots, code builds, real material to collect, acting and emotion
video/shots/*.md | 377 | Per-shot detail, tokens per file on average · checking one shot: what is seen, the inference and its basis, prompts, frames
breakdown.json | 9862 | Full raw data · for programs; a model rarely needs it
shots/ | - | contact sheet, first and last frame of each shot · checking by eye
storyboard.jpg | - | storyboard of the whole video · the whole video at a glance
frames/ | - | picture scenes: full-size frames, the drawn layer cut out and sampled, measurements · remaking rendered pictures
audio.png | - | waveform and beat chart · seeing the rhythm
```

## How to read

- One shot per line: `#<n> start-end (s) | key value | …`. A key ending in `~` is the tools' inference; keys without it are visible on screen or measured directly.
- `story` job in the story and the point · `seen` what is on screen · `act` acting (emotion, strength, face) · `camera` camera move · `overlay` overlays · `made~` how it was made (inferred) · `material~` where the material came from (inferred) · `remake` remake route · `flag` needs a second look
- Full detail for a shot is in `video/shots/<n>.md` (e.g. `video/shots/07.md`).
- What is “seen” can be checked against the frames; what is “inferred” is the tools' and image readers' judgement, with the basis in each shot file. When they disagree, trust the frames.
