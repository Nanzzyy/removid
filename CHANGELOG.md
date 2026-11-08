# Changelog

`node skills/removid/scripts/project.mjs version` prints the version the agent is actually running, and whether it is behind `origin/main`.

## 0.7.0
- Emotions are an open vocabulary: 18 tuned presets, about 160 lexicon words (English, Indonesian), families scaled by intensity, a project's own `Storyboard/emotions.custom.json`. A new word is a warning, a misspelling an error.
- `SKILL.md` front matter is valid YAML (the unquoted `scene: UI` broke GitHub and strict parsers).
- `version` command, `VERSION`, this file.

## 0.6.0
- Two-round interview: the type of video (motion graphics, video editing, motion 3D), then the style of that type and its technical needs.
- Mandatory folder schema guarded (`repair`, `FOLDER INCOMPLETE`, asset ledger checks).
- The clean voice script (`vo-script`, only the lines with their emotion tags) apart from the storyboard walkthrough (`explain`); `vo-split` cuts one recording; delivery words (`[thoughtful, slower]`).
- Optional local speech-server connector (loopback only; nothing is installed or started).
- The owner's style library moved to `source-material/`.

## 0.5.0
- Intake (known / assumed / questions), STRUCTURE.md before the script, emotion tags, 36 checked styles, per-style transitions, emotion sheet.

## 0.4.0
- Voice fitting and levelling, early-human characters, group shots, spelled-number claims.

## 0.3.0
- Project folder, script and storyboard gates, character system, sound effects, assemble.

## 0.2.0
- Remotion authors, HyperFrames cuts; 60 fps, zoom, cursor, 3D narrator.

## 0.1.0
- First release.
