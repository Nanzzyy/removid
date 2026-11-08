# What to say at each stop

The tools print the facts; the agent says them once, to the right audience, at the stop where they matter. Mixing them is the commonest defect: a voice script that carries scene directions and time marks cannot be pasted into a TTS, and a storyboard explained inside the script review leaves nothing to say at Gate 2.

| Stop | Show | Never |
| --- | --- | --- |
| **Intake** | the assumptions in one line; only the questions `intake` returns, in two rounds (`intake.md`) | questions the brief answers; hook, CTA, fps, engine |
| **Gate 1** (structure + script) | (1) the structure table: beat, time, purpose, one idea, emotion, what is shown; (2) **the clean VO script in its own code block, exactly as `submit script` prints it**; the warnings; then how the voice will be made (agent default voice, or the user's own audio) | scene or camera directions, "(Australopithecus walks...)", time marks or labels inside the VO script; zoom highlights; a length estimate in place of the measured one |
| **Asking for the voice** | the clean VO script, and "send one file per line, or one whole recording with a pause of 0.5 s or more between lines; I cut and measure it" | "how many seconds is your audio?" (`vo`, `vo-split`, `vo-place` measure the file); the structure or the storyboard |
| **Gate 2** (storyboard) | `explain`: per frame the time, what is on screen, the voice line, on-screen text, zoom highlights, cursor and narrator moments, the transition in, effects, what the viewer takes away; then the summary (highlights, delivery arc, style) and the files still needed | the script again; anything not in the storyboard file |
| **Gate 3** (sample) | the 10 s clip and what to judge in it (hook, one zoom, one transition, the voice) | a full explanation of the plan |
| **Gate 4** (final) | file path, size, duration, fps, resolution, loudness, what changed since the sample, what the user can still change and where | claims it was not checked for (playback on their player) |

## The VO script, exactly

```
[curious] Pernah merasa... AI selalu punya jawaban?

[impressed] Cepat, pintar, dan terdengar sangat meyakinkan.

[firm, emphatic] Periksa faktanya. Lindungi datamu. Dan yang terpenting... tetap gunakan pikiranmu sendiri.
```

One line per script block, the tag the author wrote, a blank line between. This is a deliverable, not a summary: it must be possible to paste it into any TTS, read it into a microphone or cut it line by line without editing. `project.mjs vo-script <proj>` prints it again.

## The storyboard walkthrough, exactly

```
Frame 4 — Features demo   14.00–21.00 s
  On screen:  Dashboard with three tabs; the cursor visits each and clicks; then the camera zooms into the report chart.
  Voice:      14.20–20.60  "Dari toko online, sistem kasir, ..."
  Zoom:       laporan-chart 18.40–20.90 scale=1.5
  Cursor:     tab-toko @15.00 click
  Transition in: fade 0.4 s
  The viewer takes away: online store, POS and finance reports in one place
```

All of it comes from the storyboard file (`project.mjs explain <proj>`), so what the user approves is what will be built.
