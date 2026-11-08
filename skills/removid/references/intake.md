# Intake: the short interview

The brief is usually enough. Ask only what it leaves open, **once**, in **one batch of at most four questions**, each with the recommended answer first. A long interview loses the user; a wrong guess costs a revision. This file decides which.

## Run the tool, then ask what it says

```bash
node <skill>/scripts/project.mjs intake "<the user's words, unchanged>" [--json]
```

It reads the brief and prints three lists:

- **KNOWN**: stated in the brief (duration, platform and so the format, language, narration yes/no, a style named on purpose, a voice engine named). Do not ask these again.
- **ASSUMED**: defaults the agent takes without asking (60 fps, 30 s, Indonesian, Edge TTS, hook, structure, call to action). Say them in **one line** to the user ("Saya asumsikan: 30 detik, 60 fps, suara Edge TTS Indonesia; hook dan CTA saya susun di struktur") and move on. They correct them at Gate 1 when they see the structure and the script.
- **ASK**: the questions still worth asking, already written as options (`--json` gives them ready for the agent's question tool). None left means: no questions, create the project.

**Round 1**, one call, at most four questions:

| Question | Asked when | Options (recommended first) |
| --- | --- | --- |
| Type of video | the brief states none and names no style | **motion graphics** (2D, 13 styles, no footage), **video editing** (the user's footage, 10 styles), **motion 3D** (characters and worlds, 13 styles); the recommended one follows the brief (a story or a character leans 3D) |
| Format | the brief names no platform | vertical 30 s (Reels/TikTok/Shorts), wide 30-60 s, square |
| Voice | narration or its source is not settled | narration + a character Claude designs with **the agent's default voice** (recommended), the default voice without a character, **the user sends audio files matching the script**, silent |
| Proof | the brief mentions a number, offer, testimonial, domain | all true, **not sure: mark as example (recommended)**, drop them |

**Round 2**, one call, once the type is known (`intake "<brief>" --category <type> --json`):

| Question | Options |
| --- | --- |
| Style (skipped when the brief names one) | the three styles of THAT category that fit the topic, each with why; any other of the category by name through "Other" |
| Technical needs (choose any) | the user's footage (video editing only: file and part of each clip), logo and brand kit, captions, music, data or numbers to show (not video editing). None chosen = the standard |

A video-editing style makes a footage project (`Raw-Footage/`), and `new` says to put the clips there and name the part each beat uses.

## Never ask

Hook, structure, call to action, length of each part, fonts, music, which voice engine (the agent's own, Edge TTS id-ID as the baseline; a local speech server only when the owner already runs one, `voice-check` tells), fps, language, or anything you can propose. The skill never installs a voice engine for anyone. Propose it in the structure and let the user correct it with the real thing in front of them: people judge a table far better than an abstract question.

A script the user already wrote is theirs: keep every word, report the numbers (`check script`), offer a tightened version only as a separate suggestion.

## After the answers

```bash
project.mjs new <Brand> <slug> --brief "<the user's words>" --format portrait --duration 30 --narration yes --character undecided --style clay [--language id-ID]
```

The brief goes in verbatim. Brand files, footage and references the user has go to `Asset/owner/`, `Raw-Footage/`, `Reference/`; ask for them only when the style or the brief needs them (a brand colour, a logo, the clips to edit). Never invent a logo, a voice, a client or a number.

## The same, in a sentence

Read the brief; run `intake`; state the assumptions; ask the few real questions at once; create the project; draft the structure.
