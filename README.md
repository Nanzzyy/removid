# removid

One agent skill for making video from code. It combines **Remotion** (React, data-driven batches) and **HyperFrames** (HTML + GSAP, editable in Studio) behind a single `/removid` entrypoint, with a brief-to-render workflow, approval gates and frame verification.

Works with **Claude Code**, **Codex** and **Antigravity**.

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

Requirements: Node.js 22+, FFmpeg. Check with `skills/removid/scripts/doctor.sh` or `/removid doctor`.

## What is inside

```
skills/removid/
├── SKILL.md              router + workflow + hard rules
├── references/
│   ├── workflow.md       brief, plan, gates, verification, report
│   ├── remotion.md       Remotion essentials
│   ├── hyperframes.md    HyperFrames contract and CLI loop
│   ├── migration.md      port Remotion/Lottie/Three.js/canvas into HyperFrames
│   ├── gsap.md           GSAP timelines for video
│   └── motion-design.md  easing, duration, stagger, framing, beat sync
└── scripts/
    ├── doctor.sh         tool check
    └── probe-mp4.sh      assert size / fps / duration of a render
```

`AGENTS.md` (Codex, Antigravity) and `CLAUDE.md` (Claude Code) guide agents that edit this repo.
