# removid

One agent skill for making video from code, at **60 fps** by default. Two tools, two jobs behind a single `/removid` entrypoint:

- **Remotion** authors and edits every scene: layout, text, UI demos, a **cursor that lands exactly on its target**, **smooth zoom-to-highlight**, a **3D narrator character that Claude designs for each video (woman, man, pixel, mascot...) with lip sync**, data-driven batches. Each scene is rendered to a clip.
- **HyperFrames** cuts and assembles those clips (and raw footage): trim, split, order, transitions, music, final render.

The skill asks first (script? narration? character? voice? provable claims?), then works from a **project folder** through four **approval gates**: script, storyboard, 10 s sample, final. The script and the storyboard are *calculated*, not eyeballed: `project.mjs check` fails a script whose words do not fit their time windows, an unverified claim, a storyboard with a gap, a vo line that differs from the script, or a cursor landing while the camera zooms. Approvals are quoted user words bound to file hashes. The cursor and zoom rules are also checked in numbers and in rendered pixels.

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
│   ├── workflow.md               ask, folder, script, voice, storyboard, Remotion, HyperFrames, sample, final
│   ├── project-folder.md         folder schema, PROJECT.md, the four gates, revisions
│   ├── script.md                 writing the script (naskah): format, timing numbers, claims, voice
│   ├── storyboard.md             frame format, what the checker computes, plan.json
│   ├── remotion.md               authoring scenes at 60 fps
│   ├── cursor-and-camera.md      cursor on target, click, zoom-highlight, verification
│   ├── character-and-narration.md  narrator character, voice, envelope, cues
│   ├── handoff.md                Remotion clips into HyperFrames, verifying the cut
│   ├── hyperframes.md            cutting and assembly, contract, CLI loop
│   └── motion-design.md          easing, duration, 60 fps, stagger, framing, beat sync
├── scripts/
│   ├── project.mjs               new / check / submit / approve / gate / vo / vo-place / scaffold / assemble / status / log
│   ├── sfx.mjs                   synthesize the sound-effect track from plan.json (full ffmpeg)
│   ├── doctor.sh                 tool check (Node, ffmpeg, the minimal-ffmpeg trap)
│   ├── new-project.sh            scaffold a Remotion project from the starter
│   └── probe-mp4.sh              assert size / fps / duration of a render
├── templates/project/            SCRIPT.md, STORYBOARD.md, REFERENCES.md ... copied into each project
└── templates/remotion-starter/   tested starter: UiDemo (cursor + zoom) and Narrator (3D character)
    ├── src/lib/                  camera, cursor, pose, envelope, plan (pure, no React)
    ├── src/components/           Camera, CursorLayer, Spotlight, TargetBox, Character, NarratorLayer
    ├── src/characters/           the contract (types), humanoid / voxel / mascot builders, the registry
    ├── src/scenes/               scenes and their *.data.ts (targets, stops, shots, cues)
    └── scripts/                  check-logic, check-click-stills, stills, character-sheet, make-envelope
```

## Use

In the agent: `/removid <what you want>`. It asks, creates the folder and walks the gates. The same steps by hand (`P=skills/removid/scripts/project.mjs`):

```bash
node $P new PrvTech promo-umkm --root ~/videos --narration yes --format landscape --duration 30 --brief "your request, in your words"
node $P check script promo-umkm      # words and seconds per window, claims; edit Storyboard/SCRIPT.md until clean
node $P submit script promo-umkm     # then the user answers ...
node $P approve script promo-umkm --evidence "the user's words"
node $P vo promo-umkm voice.wav      # measure the real voice
node $P check storyboard promo-umkm  # frame table, vo/zoom/cursor rules, writes plan.json
node $P submit storyboard promo-umkm && node $P approve storyboard promo-umkm --evidence "..."
node $P scaffold promo-umkm          # Remotion starter + plan.json into Source/remotion
node skills/removid/scripts/sfx.mjs promo-umkm/Storyboard/plan.json --out Asset/agen/sfx.wav   # effects + cursor clicks
node $P assemble promo-umkm          # HyperFrames index.html from plan.json; rejects clips with the wrong frame count
```

Inside `Source/remotion`: `npm run check` (zoom, cursor, pose, lip sync), `npm run check:cursor` (cursor tip on its targets, in pixels), `npm run studio`. Folder layout and gates: `skills/removid/references/project-folder.md`.

## Test this repo

```bash
./test.sh          # syntax, project tool tests (script/storyboard/gates), install/uninstall, scaffold, typecheck, numeric audit
./test.sh --full   # + pixel cursor check (and a 90 px mutant that must fail), stills, 60 fps renders of both scenes, probed
REMOVID_FFMPEG=/path/to/full/ffmpeg ./test.sh   # also runs the tests that need a full ffmpeg (sfx audibility, assemble); otherwise they are skipped
```

`AGENTS.md` (Codex, Antigravity) and `CLAUDE.md` (Claude Code) guide agents that edit this repo.

## Notes

- The narrator is a character Claude designs per video from an archetype (humanoid woman/man, pixel, mascot) or a new builder, previewed with `npm run character -- <id>` and approved by the user. It is never the Claude logo or sparkle in 3D, and never an Anthropic asset.
- HyperFrames renders need a full ffmpeg build. With a minimal one they fail (`VIDEO_SOURCE_UNRENDERABLE`); set `HYPERFRAMES_FFMPEG_PATH`. `doctor.sh` checks this.
