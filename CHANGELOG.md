# Changelog

`node skills/removid/scripts/project.mjs version` prints the version the agent is actually running, and whether it is behind `origin/main`.

## 0.11.0
- Optional `fast/` kit for silent videos up to 45 seconds: compact style selection, 36 motion recipes, ready Remotion scenes, timing from the approved frame plan, synthesized music/effects and strict video QA. Uses the existing intake, folder schema, approval gates and 60 fps pipeline; HyperFrames handles transitions and audio. Canonical style tokens remain in `styles/styles.json`.
- `Storyboard/direction.json`, when present, participates in storyboard approval hashes. Changing it invalidates the storyboard, sample and final approvals. FAST rejects content absent from the storyboard's checked text windows.
- Tests cover style recipes, stale gates, invalid directions, loudness failures, copy installation and, with `--full`, real kit renders and QA failure cases. Python audio tests require numpy/scipy and full ffmpeg.

## 0.10.0
- **`SCRIPT.md` is exactly the tagged lines** and nothing else: no front matter, comment, heading or table, so the file itself (not only the block the tool prints) can go to any TTS. Claims moved to `Storyboard/CLAIMS.md`, words-per-second to `PROJECT.md` (`new --wps`). `check script` errors on anything else; `script-clean <project>` fixes a 0.8/0.9 script. Test: the file is byte-identical to `vo-script`.

## 0.9.0
- `verify-reply <project> <message-file|->` checks the message an agent is about to send: exactly one VO block of tagged lines, byte-identical to `SCRIPT.md`; no seconds, stage labels or directions in it; no second timed script ("0–3s ... \"narration\"", "Tahap 1: ...") anywhere else; no question about the audio path or length. `--format-only` does the format part outside a project. Fixtures are the real bad outputs the owner pasted.
- The Gate 1 contract and `SKILL.md` tell the agent to run it before sending, and that the user's format wins whenever they ask for the script.

## 0.8.1
- `script-init <project>` writes `SCRIPT.md` from the structure: one emotion-tagged paragraph per spoken beat, nothing else, so the agent fills words instead of inventing a format. It refuses to overwrite a script that already has words (`--force`).
- The Gate 1 contract (what the script file is, what the chat message is, no drafting in chat) is printed by `intake` (also in `--json` as `gate1_contract`) and by `new`, the first commands every run uses, instead of living only in `SKILL.md`.

## 0.8.0
- **The script has no seconds.** `SCRIPT.md` is only the lines (one paragraph per spoken beat, each opening with its emotion tag); the time budget of each line comes from its beat in `STRUCTURE.md`, the exact seconds live in the storyboard. `check script` rejects seconds, stage labels and "(zoom ...)" directions in a project that has a structure. Older timed scripts are still read.

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
