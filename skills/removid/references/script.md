# Script

The script comes first. It fixes the words, the order and the time budget; the storyboard, the voice and every cut are built on it. A video made without one drifts, runs long and cannot be revised consistently.

File: `Storyboard/SCRIPT.md`. Check: `project.mjs check script <proj>`. Gate 1 for narrated videos (`project-folder.md`).

## Settle before writing

The brief and `intake` (`intake.md`) already settled what can be asked; the **structure** (`structure.md`) already fixed the beats, their times, the one idea of each and its emotion. The script is that plan in words: every block sits inside one beat. What can be proven (numbers, clients, testimonials, offers, the domain) goes in `## Claims` first. A user-supplied script is the user's: keep every word, report the numbers, and offer a tightened version only as a separate suggestion.

## Format

```
---
title: promo-umkm
language: id-ID
narration: yes            # no = the blocks are on-screen copy
duration: 30
wps: 2.4                  # spoken words per second, speech only; replaced by the measured audio
platform: Reels
message: one sentence the viewer should remember
---
[00.0–03.0] HOOK
UMKM kamu sudah punya website?

[03.0–08.0] PROBLEM
Usaha kecil sulit berkembang kalau terlihat kurang profesional.

## Claims
| claim | status | source |
|---|---|---|
| prvtech.id | placeholder | domain not confirmed |
```

Each block is `[start–end] LABEL` and then only the words that are said. Direction, music and visuals belong to the storyboard. Gaps between blocks are visual-only beats.

**Open each narrated block with its emotion tag** (`[curious] UMKM kamu sudah punya website?`). It is the delivery: it sets how the line is spoken, how the narrator's face acts and which gestures fit (`emotion-and-voice.md`). At most 2 per block, each covering 0.8 s or more; never spoken, never counted as words; part of what Gate 1 approves.

## The numbers (the checker computes them; do not eyeball)

| Rule | Value |
| --- | --- |
| Speaking pace | `wps` 2.4 words/s of SPEECH (silence trimmed) as the default estimate. Measured: Edge id-ID male TTS 2.6 to 3.0 words/s on a 15 s promo; counting the silence inside the file it is 1.5 to 2.2. Put the measured value in `wps` for the next script |
| Pauses added | 0.25 s per sentence end inside a block, 0.15 s per dash, 0.08 s per comma |
| A domain | read aloud: `prvtech.id` = 3 words ("prvtech titik id") |
| Words that fit a window | `floor((window − 0.3 s) × wps)`; at 2.4: 3 s = 6 words, 5 s = 11, 7 s = 16 |
| Whole video | speech under 85% of the duration; the rest is for visuals to breathe (30 s ≈ 50 to 55 words at 2.4) |
| Hook | starts within 0.5 s, under 12 words |
| Last block | has a call to action |
| Silent video | each on-screen block needs max(1 s, 0.3 s × words) |

Overflow is an error, not a note: cut words or widen the window, then check again. The estimate is only an estimate: the draft in `tests/fixtures/prvtech-30s/SCRIPT.original.md` (73 words, a domain read aloud as three) needs about 37 s at 2.0 words/s but about 31 s at 2.4 and would just fit at the 2.75 measured later, with no room to breathe. The decision comes from the measured audio, not from the default.

## Shape by length

- **15 s**: hook 0–2.5, one idea, call to action from 11.
- **30 s**: hook 3 s, problem 5 s, solution 6 s, demo 7 s, payoff 4 s, call to action 5 s. Adjust, but keep one idea per block.
- **60 s**: add a second proof and one story beat; still one message.

## Writing for ears

Short sentences, one breath each. A concrete noun and a verb beat an adjective. Say it aloud before keeping it. No filler openers ("di era digital ..."), no clickbait without payoff. End on what the viewer should do.

## Claims: no invented proof

Every number, superlative, offer (free, discount, guarantee), "trusted by", testimonial, client and domain needs a row in `## Claims`:

- `verified` with a source, or `owner-confirmed` (the user said so), or `placeholder`.
- A testimonial or customer count nobody supplied is a `placeholder`. It may appear in a sample if it is visibly marked, and it **blocks the full render** until the user replaces or confirms it. Never present an invented name, quote or figure as real.

## Brand names and numbers

A brand name the TTS engine spells out ("PrvTech" → "PiArVee Tek") or a domain read aloud ("prvtech.id" → "prvtech titik id") is longer than its word count. Prefer showing the domain on screen and saying only the name; the checker counts a domain as three words either way.

## Voice (after Gate 1, never before)

The user's own recording, or text-to-speech from the engine settled at intake (Edge TTS id-ID by default; do not send the script to a service the user has not accepted). On `submit`, `Asset/agen/vo.txt` (clean words, one line per block) and `Asset/agen/vo-lines.json` are written; `project.mjs vo-lines <proj> --engine <name>` also writes `Asset/agen/lines/lineN.txt` in the form that engine can use: Edge gets rate/pitch/volume from the emotion tag, ElevenLabs keeps audio tags, VoiceBox keeps only `[laugh]`/`[gasp]` (`emotion-and-voice.md`).

`vo-place` refuses a line that cannot fit its window and says by how much; `--fit` pushes the lines apart (0.35 s gaps) and pulls the tail back so the last word ends 0.5 s before the end, without editing the script. Level the voice at the same time: `vo-place <proj> --fit --lufs -15` (voice about -15 LUFS, effects 16 dB under it, so the final mix lands near -14 LUFS, the usual target for Reels/TikTok/Shorts; `probe-mp4.sh` checks it). Why stereo: the video carries the mono voice on two identical channels, which reads 3 dB louder than the mono file; a mono measure would leave the video at -12 LUFS (measured).

Then measure, never assume. One file per line (`Asset/agen/line1.mp3` ...)? `project.mjs vo-place <proj>` places each at its window start + 0.1 s into `Asset/agen/vo.wav` and measures it. One continuous recording? `project.mjs vo <proj> <audio>`. It finds the speech segments (edges at 0.1 s resolution; runs closer than the smallest gap that gives one run per line are merged), maps them to the script lines in order and writes `Asset/agen/vo-report.json`. The storyboard's `vo` windows come from those times. If the user will record later, draft the storyboard but do not submit it until the file exists, unless the user says to fit visuals to the real file afterwards (`submit storyboard --estimate "..."`).
