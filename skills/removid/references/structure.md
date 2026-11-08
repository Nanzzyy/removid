# Structure: what the video is made of

The structure comes **before the script** and the script is its expression in words. It answers, in one table, what the viewer sees and learns beat by beat, so the script, the voice, the storyboard and every cut start from the same plan instead of each agent improvising its own.

File: `Storyboard/STRUCTURE.md` (template in `templates/project/STRUCTURE.md`). It is approved together with the script at Gate 1 (one stop, not two): changing it afterwards makes the script and everything after it stale.

## Format

```
---
title: evolusi-manusia
duration: 30
---
## Beat 1 — HOOK
- time: 0.0–3.0
- purpose: hook
- shows: concrete picture: who/what is on screen, what moves
- source: remotion                      # remotion | footage | remotion+footage
- footage: interview.mp4 12.0–15.0      # only when the source includes footage: which file, which part
- info: the ONE thing the viewer takes from this beat (3-16 words)
- emotion: curious                      # narrated videos: the delivery (emotion-and-voice.md)
- vo: none                              # optional: a beat with no spoken words
```

Purposes: `hook setup problem solution demo proof story twist payoff cta outro`.

## What `check` enforces

- Beats are numbered 1..N, contiguous from 0 to the duration, no gap, no overlap.
- Exactly **one hook, and it is first**; it lasts at most 4 s (3 s is better). The last beat is `cta`, `outro` or `payoff`.
- Every beat says concretely what it `shows`, has one `info` (a beat with two ideas is two beats), a known `source`, and, for narrated videos, an `emotion`.
- Footage beats name the file and the part, and the part is at least as long as the beat. A file missing from `Raw-Footage/` is a warning until the user supplies it.
- The number of beats matches the style's rhythm (a LANTANG video cuts every 1.2-3 s, STORYTELLER every 4-9 s): a warning when the average is far outside it.
- A number, offer or domain in `info` needs a row in the script's `## Claims`.
- **Script ↔ structure**: every script block sits inside one beat; a beat that is spoken has at least one block (the hook and the call to action must); a block delivered in an emotion different from its beat's gets a warning.
- **Storyboard ↔ structure**: a frame may split a beat but never straddle its boundary.

## How to draft it

1. Count the beats from the style's rhythm: `duration ÷ shot length` (30 s of CLAY-3D at 2.5-6 s per shot is 6-8 beats).
2. Hook first (a question, a conflict, a surprising result), then setup, development with cause and effect, the payoff, and a call to action only if the goal needs one.
3. Write `info` before `shows`: if the beat has no single idea, merge or drop it.
4. Choose the `emotion` to make the arc: the hook awakes the viewer (curious, surprised, excited, mad), the middle varies, the end lands warm, excited or proud.
5. For footage: write which clip and which seconds each beat uses. Without that, "edit the footage" is a guess.
6. Show the beats in the same table as the script at Gate 1 (time, purpose, info, emotion, words, seconds).
