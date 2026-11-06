# removid

One agent skill for making video from code, at **60 fps** by default. Two tools, two jobs behind a single `/removid` entrypoint:

- **Remotion** authors and edits every scene: layout, text, UI demos, a **cursor that lands exactly on its target**, **smooth zoom-to-highlight**, a **3D Claude-style narrator character with lip sync**, data-driven batches. Each scene is rendered to a clip.
- **HyperFrames** cuts and assembles those clips (and raw footage): trim, split, order, transitions, music, final render.

The skill asks first whether the video needs narration and a character, then follows a brief, plan, build, prove, assemble workflow with approval gates. The cursor and zoom rules are checked by scripts, in numbers and in rendered pixels.

## Install

```bash
git clone https://github.com/Nanzzyy/removid.git
cd removid
./install.sh                # symlink into all three agents (git pull updates them all)
./install.sh claude codex   # only some agents
./install.sh --copy         # copy instead of symlink
./install.sh --project .    # install into one project's skills dirs
./install.sh --uninstall
```

| Agent | Global skills dir | Project skills dir | Invoke |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/skills/removid` | `.claude/skills/removid` | `/removid` |
| Codex | `~/.codex/skills/removid` | `.agents/skills/removid` | `$removid` or `/skills` |
| Antigravity | `~/.gemini/antigravity/skills/removid` | `.agent/skills/removid` | automatic, from the description |

Override a path with `REMOVID_CLAUDE_DIR`, `REMOVID_CODEX_DIR` or `REMOVID_ANTIGRAVITY_DIR`. Restart the agent session after installing.

Requirements: Node.js 22.18+ (the starter runs `.ts` check scripts directly), FFmpeg (a full build for HyperFrames renders). Check with `skills/removid/scripts/doctor.sh` or `/removid doctor`.

## What is inside

```
skills/removid/
├── SKILL.md                      roles, 60 fps default, questions to ask, routing, hard rules
├── references/
│   ├── workflow.md               ask, plan, Remotion, proofs, clips, HyperFrames, sample, final
│   ├── remotion.md               authoring scenes at 60 fps
│   ├── cursor-and-camera.md      cursor on target, click, zoom-highlight, verification
│   ├── character-and-narration.md  narrator character, voice, envelope, cues
│   ├── handoff.md                Remotion clips into HyperFrames, verifying the cut
│   ├── hyperframes.md            cutting and assembly, contract, CLI loop
│   └── motion-design.md          easing, duration, 60 fps, stagger, framing, beat sync
├── scripts/
│   ├── doctor.sh                 tool check (Node, ffmpeg, the minimal-ffmpeg trap)
│   ├── new-project.sh            scaffold a Remotion project from the starter
│   └── probe-mp4.sh              assert size / fps / duration of a render
└── templates/remotion-starter/   tested starter: UiDemo (cursor + zoom) and Narrator (3D character)
    ├── src/lib/                  camera, cursor, pose, envelope (pure, no React)
    ├── src/components/           Camera, CursorLayer, Spotlight, TargetBox, ClaudeCharacter
    ├── src/scenes/               scenes and their *.data.ts (targets, stops, shots, cues)
    └── scripts/                  check-logic, check-click-stills, make-envelope
```

## Use

```bash
skills/removid/scripts/new-project.sh ~/videos/my-video     # in the agent: /removid new ~/videos/my-video
cd ~/videos/my-video
npm run check            # zoom smoothness, cursor speed/hold/arrival, pose + lip-sync rules
npm run check:cursor     # renders debug stills and proves the cursor tip is on its targets (pixels)
npm run studio           # Remotion Studio
```

## Test this repo

```bash
./test.sh          # syntax, install/uninstall, scaffold, typecheck, numeric audit
./test.sh --full   # + pixel cursor check and 60 fps renders of both scenes, probed
```

`AGENTS.md` (Codex, Antigravity) and `CLAUDE.md` (Claude Code) guide agents that edit this repo.

## Notes

- The narrator is an original character in Claude's visual language (coral, cream, spark motif), not an official Anthropic asset or logo.
- HyperFrames renders need a full ffmpeg build. With a minimal one they fail (`VIDEO_SOURCE_UNRENDERABLE`); set `HYPERFRAMES_FFMPEG_PATH`. `doctor.sh` checks this.
