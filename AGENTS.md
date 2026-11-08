# removid: instructions for coding agents

This repo ships one agent skill, `removid`, for making programmatic video with Remotion and HyperFrames. It is read by Claude Code, Codex and Antigravity.

## Layout

- `skills/removid/SKILL.md`: the entrypoint. Keep it short (router, workflow, hard rules). Frontmatter `name` must equal the directory name.
- `skills/removid/references/*.md`: detail loaded on demand. Add depth here, not in `SKILL.md`.
- `skills/removid/styles/`: `styles.json` (36 styles as checked tokens) and `emotions.json` (12 emotion tags: voice, face, gestures). The single source; the starter's `src/emotions.ts` is generated from it (a test fails on drift: regenerate, never hand-edit).
- `skills/removid/scripts/`: `project.mjs` (intake, folder, structure/script/storyboard checks, gates, voice lines and measuring, assemble; Node only, no dependencies), `lib-style.mjs` and `lib-emotion.mjs` (the two tables as code), `sfx.mjs` (effects track, full ffmpeg) and small bash helpers (`doctor.sh`, `probe-mp4.sh`, `new-project.sh`: bash, ffmpeg/ffprobe, awk).
- `skills/removid/templates/project/`: the files a new project folder starts from.
- `tests/`: `project.test.mjs` and the 30 s PrvTech fixture (the user's original script, a tightened script, a storyboard).
- `skills/removid/templates/remotion-starter/`: the tested Remotion starter. Inside the skill directory on purpose: only that directory is installed, so anything outside it is invisible to the agent.
- `install.sh`: symlinks (or copies) the skill into each agent's skills directory.

## Rules when editing

- The order is fixed: intake, project folder and style, structure + script (gate 1), voice, character, storyboard (gate 2), build, sample (gate 3), final (gate 4). The voice is never made before Gate 1. Never document or code a path that builds before the matching gate. Do not remove the checks that make timing calculated.
- Roles are fixed: Remotion authors scenes, HyperFrames cuts and assembles rendered clips. Default fps is 60. Do not reintroduce HyperFrames-authored scenes or 30 fps examples.
- Keep `SKILL.md` under ~100 lines. If it grows, move content to a reference and link it from the routing table.
- Descriptions are the trigger: include the phrases users actually say ("render", "MP4", "Remotion", "HyperFrames", "/removid").
- References are condensed from upstream docs. Do not paste upstream files wholesale; link to the authoritative source (`npx hyperframes docs <topic>`, remotion.dev/docs) for exhaustive detail.
- Scripts must exit non-zero on failure and print what failed. Test them before committing: `bash -n` and a run against a real file.
- Do not add generated renders, `node_modules` or media to this repo.
- Never add code that installs, downloads, starts or deploys a voice engine, a container or a model on a user's or anyone's machine. Voice routes are the agent's own tool, a speech server the owner already runs (loopback only, `lib-voice.mjs`), or the user's audio files.

## Test

`./test.sh` (fast) and `./test.sh --full` (pixel cursor check, 60 fps renders). Run `--full` after touching the starter, the cursor/camera libraries or the character.

`node --test tests/*.test.mjs` covers the project tool (`project.test.mjs`) and the styles, emotions, intake, structure and transitions (`style.test.mjs`). A style added to `styles.json` must pass the palette, easing, transition (≤ 0.5 s) and alias tests; a transition kind or easing name must exist in `lib/ease.ts` and in `assemble`. Checks must be able to fail: when you add or change one, break the input on purpose in a scratch copy and confirm it exits non-zero (the cursor check once passed a 90 px miss on a wide button because it only tested "inside the element").

