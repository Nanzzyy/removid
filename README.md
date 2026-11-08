# removid

One agent skill for making video from code, at **60 fps** by default. Two tools, two jobs behind a single `/removid` entrypoint:

- **Remotion** authors and edits every scene: layout, text, UI demos, a **cursor that lands exactly on its target**, **smooth zoom-to-highlight**, a **3D narrator character that Claude designs for each video (woman, man, pixel, mascot...) with lip sync**, data-driven batches. Each scene is rendered to a clip.
- **HyperFrames** cuts and assembles those clips (and raw footage): trim, split, order, transitions, music, final render.

The skill runs a **short interview** (`project.mjs intake`: it reads the brief, then asks in two short rounds only what the brief leaves open: the type of video (motion graphics, video editing from footage, motion 3D), format and voice; then the style of that type and its technical needs), then works from a **project folder** through four **approval gates**: structure + script, storyboard, 10 s sample, final. A video starts as a **structure** (beats: what is shown, which footage, the one idea, the emotion), then a **script** whose every line opens with an **emotion tag** (`[curious]`, `[mad]`, `[sad]`, `[laugh]`...). The voice is made after the script, from one of three routes (the agent's default voice, a local speech server the owner already runs, or the user's own audio files; removid installs no engine anywhere), and the same tag drives how the line is spoken, how the narrator's face acts and which gestures fit. **36 video styles** (clay, pixel, paper, blueprint, midnight, lantang...) are data the checks enforce: palette, rhythm, transitions, camera limit, easing. The script and the storyboard are *calculated*, not eyeballed: `project.mjs check` fails a script whose words do not fit their time windows, an unverified claim, a storyboard with a gap, a vo line that differs from the script, or a cursor landing while the camera zooms. Approvals are quoted user words bound to file hashes. The cursor and zoom rules are also checked in numbers and in rendered pixels.

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
│   ├── workflow.md               intake, folder, structure + script, voice, storyboard, Remotion, HyperFrames, sample, final
│   ├── intake.md                 the short interview: known / assumed / the few questions
│   ├── structure.md              beats: what each shows, footage, one idea, emotion
│   ├── styles.md                 the 36 styles as checked tokens, how Remotion and HyperFrames use them
│   ├── emotion-and-voice.md      emotion tags, voice engines (Edge, ElevenLabs, VoiceBox, Voice Studio), the face over time
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
│   ├── project.mjs               intake / style / new / set-style / check / submit / approve / gate / voice-check / vo-lines / vo-synth / vo / vo-place / scaffold / assemble / status / log
│   ├── lib-style.mjs, lib-emotion.mjs   the style table and emotion table as code (matching, contrast, recommendations, engine adapters)
│   ├── lib-voice.mjs             optional connector to a LOCAL speech server (loopback only, starts nothing)
│   ├── sfx.mjs                   synthesize the sound-effect track from plan.json (full ffmpeg)
│   ├── doctor.sh                 tool check (Node, ffmpeg, the minimal-ffmpeg trap)
│   ├── new-project.sh            scaffold a Remotion project from the starter
│   └── probe-mp4.sh              assert size / fps / duration of a render
├── styles/                       styles.json (36 styles), emotions.json (12 emotions): the single source
├── templates/project/            STRUCTURE.md, SCRIPT.md, STORYBOARD.md, REFERENCES.md ... copied into each project
└── templates/remotion-starter/   tested starter: UiDemo (cursor + zoom) and Narrator (3D character)
    ├── src/lib/                  camera, cursor, pose, emotion, face, style, envelope, plan (pure, no React)
    ├── src/style.ts, emotions.ts the chosen style and the emotion table (written by scaffold)
    ├── src/components/           Camera, CursorLayer, Spotlight, TargetBox, Character, NarratorLayer
    ├── src/characters/           the contract (types), humanoid / voxel / mascot builders, the registry
    ├── src/scenes/               scenes and their *.data.ts (targets, stops, shots, cues)
    └── scripts/                  check-logic, check-click-stills, stills, character-sheet, make-envelope
```

## Use

In the agent: `/removid <what you want>`. It asks, creates the folder and walks the gates. The same steps by hand (`P=skills/removid/scripts/project.mjs`):

```bash
node $P intake "your request, in your words"      # known / assumed / the questions worth asking
node $P new PrvTech promo-umkm --root ~/videos --narration yes --format landscape --duration 30 --style flatlife --brief "your request, in your words"
node $P check script promo-umkm      # structure, words and seconds per window, emotions, claims; edit Storyboard/STRUCTURE.md and SCRIPT.md until clean
node $P submit script promo-umkm     # then the user answers ...
node $P approve script promo-umkm --evidence "the user's words"
node $P voice-check                  # which voice routes exist here (read-only)
node $P vo-lines promo-umkm --engine edge   # per-line text and voice settings from the emotion tags
node $P vo promo-umkm voice.wav      # measure the real voice (or vo-place for one file per line)
node $P check storyboard promo-umkm  # frame table, vo/zoom/cursor rules, writes plan.json
node $P submit storyboard promo-umkm && node $P approve storyboard promo-umkm --evidence "..."
node $P scaffold promo-umkm          # Remotion starter + plan.json into Source/remotion
node skills/removid/scripts/sfx.mjs promo-umkm/Storyboard/plan.json --out Asset/agen/sfx.wav   # effects + cursor clicks
node $P assemble promo-umkm          # HyperFrames index.html from plan.json; rejects clips with the wrong frame count
```

Inside `Source/remotion`: `npm run check` (zoom, cursor, pose, lip sync), `npm run check:cursor` (cursor tip on its targets, in pixels), `npm run studio`. Folder layout and gates: `skills/removid/references/project-folder.md`.

## Test this repo

```bash
./test.sh          # syntax, project/style/emotion tests (mutants must fail), install/uninstall, scaffold, typecheck, numeric audit, emotion and style mutants
./test.sh --full   # + pixel cursor check (and a 90 px mutant that must fail), the emotion sheets (twelve faces must differ from neutral), stills, 60 fps renders of both scenes, probed
REMOVID_FFMPEG=/path/to/full/ffmpeg ./test.sh   # also runs the tests that need a full ffmpeg (sfx audibility, assemble); otherwise they are skipped
```

`AGENTS.md` (Codex, Antigravity) and `CLAUDE.md` (Claude Code) guide agents that edit this repo.

## Notes

- **Voice is never installed for you.** `voice-check` only looks. A local speech server (for example Voice Studio, OmniVoice engine, which lists Indonesian) is used only when you already run one, and only over loopback. Its adapter is written from its documentation and is not yet verified against a live server; Edge TTS and your own audio files are the tested routes.

- The narrator is a character Claude designs per video from an archetype (humanoid woman/man, pixel, mascot) or a new builder, previewed with `npm run character -- <id>` (and `--emotions` for its twelve faces) and approved by the user. It is never the Claude logo or sparkle in 3D, and never an Anthropic asset.
- HyperFrames renders need a full ffmpeg build. With a minimal one they fail (`VIDEO_SOURCE_UNRENDERABLE`); set `HYPERFRAMES_FFMPEG_PATH`. `doctor.sh` checks this.
