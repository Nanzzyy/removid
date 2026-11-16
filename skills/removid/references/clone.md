# Cloning a reference video (rea-video)

The user gives a video they want "the same kind of" ("klon", "bikin yang seperti ini"). What a reference can give is its **structure, tempo and technique**. Its footage, music, voice, logos, product and words are not ours. `rea-video` (https://github.com/JuneYaooo/rea-video, Apache-2.0) takes a video apart shot by shot; `scripts/clone-import.mjs` turns its result into the project's reference analysis. Same intake, same gates: the analysis feeds Gate 1, it does not replace it.

## rea-video is the user's tool, not ours

Do not install it, and do not download its models. If `rea-video --help` works, use it. If it does not, tell the user to set it up (`pip install` from the repo; needs ffmpeg and Python 3.10+; its first full run downloads about 67 MB of audio models, more with the optional OCR/speech extras) and wait for their yes, or work from a breakdown they already have. Without it, analyse the reference by looking at frames (`references/intake.md`: analyse the reference before the storyboard).

## Steps

1. **Intake as usual.** The reference is a known fact; do not ask for a hook or structure. Ask who owns or may use the reference only if it is not the user's own or a clearly public example.
2. **Breakdown** (the user's command, or yours if they allowed it): `rea-video decompose ref.mp4 -o out/ref --lang en`. It writes `VIDEO.md` and `video/timeline.md` (one line per shot).
3. **Review by eye is not optional.** Without an image reader the package holds pixel statistics only: "live action / AI / 3D" is weak and nothing says what is on screen. Look at `out/ref/storyboard.jpg`, then `rea-video review out/ref`, fill `review_answers.json` from what you see, and `rea-video apply-review out/ref --by <agent>`. `clone-import` prints WARNING and writes a banner into the analysis when no reader (`agent`, `model`, `human`) is in the card.
4. **Import:** `node <skill dir>/scripts/clone-import.mjs out/ref --project <proj> [--id ref1] [--note "the user's words"]` writes `Reference/<id>.analysis.md` in the analysis template (hook, one row per shot, transitions and sound, what we reuse, what we do not copy) and adds the row to `Reference/REFERENCES.md`. It refuses an inconsistent package (shot count, overlaps, numbering, unknown keys) and never overwrites without `--force`.
5. **Read the analysis, then write our own structure.** Fill the `TODO (agent)` line, then `Storyboard/STRUCTURE.md`: same beat count and tempo if the user wants "the same feel", with our idea, our footage and our words in each beat. Every number, claim and name is ours or the user's (`references/script.md`). Gate 1 as usual.

## What maps to what

| rea-video says | removid does |
| --- | --- |
| code / template render, static hold | Remotion scene: layout, text and timing from the table (`references/remotion.md`) |
| live action, screen recording, film footage, AI video, avatar, 3D render | not authored here: the user's own clip in `Asset/owner` or `Raw-Footage`; HyperFrames cuts it (`references/hyperframes.md`). Never promise to generate or imitate the footage |
| the cut rhythm (shot length, transitions) | the beats' seconds in `STRUCTURE.md`, then the style's transitions |
| music tempo (BPM), if found | measure the track the user supplies (`references/hyperframes.md`); do not copy the reference's track |
| sound effects with times | our effects: `sfx:` lines, or licensed files (`references/sfx-search.md`) |

## What `clone-import` reads

`VIDEO.md` front matter (`videomd: 1`, `shots`, `source`, `readers`, `made_mix` ids) and `video/timeline.md` (a fenced `videomd-timeline` block: `#01 0.0-3.0 | story ... | seen ... | made~ code / template render 84% ...`) and, if present, `video/sound.md` (a BPM, a few lines). English and Chinese labels both map to rea-video's production-method ids. Values stay in the reference's language; translate them when writing our structure. Verified on real rea-video 0.1.0 output (offline run on a synthetic clip, English, Chinese, and after an agent review) and with the `videomd` package's own checker. A newer format with a new timeline key is rejected by name rather than guessed.

## Do not

- Copy the reference's wording, voice, music, logos, product or numbers into the script, or call an AI/3D shot "ours" because the table named it.
- Build the structure from an unreviewed breakdown.
- Treat the percentages as facts: they are tool inference (`made~`), useful for deciding what Remotion can rebuild, not proof of how the video was made.
