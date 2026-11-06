# removid: instructions for coding agents

This repo ships one agent skill, `removid`, for making programmatic video with Remotion and HyperFrames. It is read by Claude Code, Codex and Antigravity.

## Layout

- `skills/removid/SKILL.md`: the entrypoint. Keep it short (router, workflow, hard rules). Frontmatter `name` must equal the directory name.
- `skills/removid/references/*.md`: detail loaded on demand. Add depth here, not in `SKILL.md`.
- `skills/removid/scripts/`: small bash helpers (`doctor.sh`, `probe-mp4.sh`, `new-project.sh`). No dependencies beyond bash, ffmpeg/ffprobe, awk.
- `skills/removid/templates/remotion-starter/`: the tested Remotion starter. Inside the skill directory on purpose: only that directory is installed, so anything outside it is invisible to the agent.
- `install.sh`: symlinks (or copies) the skill into each agent's skills directory.

## Rules when editing

- Roles are fixed: Remotion authors scenes, HyperFrames cuts and assembles rendered clips. Default fps is 60. Do not reintroduce HyperFrames-authored scenes or 30 fps examples.
- Keep `SKILL.md` under ~100 lines. If it grows, move content to a reference and link it from the routing table.
- Descriptions are the trigger: include the phrases users actually say ("render", "MP4", "Remotion", "HyperFrames", "/removid").
- References are condensed from upstream docs. Do not paste upstream files wholesale; link to the authoritative source (`npx hyperframes docs <topic>`, remotion.dev/docs) for exhaustive detail.
- Scripts must exit non-zero on failure and print what failed. Test them before committing: `bash -n` and a run against a real file.
- Do not add generated renders, `node_modules` or media to this repo.

## Test

`./test.sh` (fast) and `./test.sh --full` (pixel cursor check, 60 fps renders). Run `--full` after touching the starter, the cursor/camera libraries or the character.

Checks must be able to fail: when you add or change one, break the input on purpose in a scratch copy and confirm it exits non-zero (the cursor check once passed a 90 px miss on a wide button because it only tested "inside the element").

