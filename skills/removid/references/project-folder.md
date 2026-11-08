# Project folder and gates

One folder per video. It is the single source of truth: a new session, another agent or a revision a week later starts from it, not from chat memory. Nothing is built outside it.

```
<root>/<Brand>/<YYYYMMDD>-<slug>/        root = --root, $REMOVID_ROOT, or ./Project-Motion
├── PROJECT.md        front matter (type, size, fps, narration, voice, character, gates) + the user's brief + decisions + history
├── Reference/        the user's references (main guide), one <id>.analysis.md each, REFERENCES.md index
├── Raw-Footage/      footage projects only: the user's clips, SOURCES.md (codec, fps, keyframes)
├── Storyboard/       STRUCTURE.md, SCRIPT.md, STORYBOARD.md, style.json (the chosen style), plan.json (generated: frames, style, emotions, transitions), *.submitted-<time>.md snapshots
├── Asset/            owner/ (user files, untouched), agen/ (voice, vo.txt, vo-lines.json, vo-report.json, music), scenes/ (Remotion clips), ASSETS.md
├── Source/           remotion/ (the project), hyperframes/ (assembly)
└── Result/           sample/ (10 s), v1/, v2/ ... each with the video and a _source.tgz of Source + Storyboard
```

**The schema is mandatory.** `new` creates every folder and ledger file; nothing is built, rendered or saved outside it. Git does not keep empty folders, so a cloned or archived project loses `Asset/owner`, `Asset/agen`, `Asset/scenes`, `Result`... : `status` shows `FOLDER INCOMPLETE`, `check script` and `check storyboard` fail with the list, and `project.mjs repair <proj>` recreates what is missing (folders, `REFERENCES.md`, `ASSETS.md`, `SOURCES.md`, `style.json`) and never overwrites a file that exists. `Asset/ASSETS.md` is the ledger: every file the build uses (owner's, agent's, footage) is listed with who made it and which frame uses it; `check storyboard` warns about an unlisted file and about an `asset:` line naming a file that does not exist yet.

Same layout as the Hermes motion-project folders, plus the script file in `Storyboard/` so that the script is covered by the storyboard approval. The folder layout is compatible; `PROJECT.md` is not: the Hermes `mp` tool expects different gate fields (Indonesian statuses, a `version` field) and fails on a project made here (tested). Use one tool per project, and do not point `--root` at a tree that `mp` manages.

## PROJECT.md

- **Brief = the user's own words**, quoted. Do not paraphrase and do not add what they did not say. (Real incident: a paraphrased brief said "VO ElevenLabs" when the user only said "male voice"; the next agent waited for an API key nobody asked for.)
- Facts that matter (voice, size, narration, character) are **fields**, not prose.
- The user's latest message beats PROJECT.md. If they conflict, fix PROJECT.md and go on.
- `## Final decisions` is what a revision must not reopen. `## History` is appended by the tool; use `project.mjs log` for anything else worth keeping.

## Gates

A gate is a hard stop that a script enforces. Approval is **the user's own words, quoted** as evidence. Silence, "looks fine to me", a teammate's message or your own judgement is not approval.

| Gate | Submit | Approve | Then |
| --- | --- | --- | --- |
| 1 Structure + script (narrated only) | `submit script` | `approve script --evidence "..."` | voice (`vo-lines`, `vo-place`) |
| 2 Storyboard | `submit storyboard` (needs measured audio, or `--estimate "user's reason"`) | `approve storyboard --evidence "..."` | `gate build`, `scaffold`, Remotion |
| 3 Sample (10 s, draft) | `render --start 0 --end 10 --quality draft` into `Result/sample/` | `approve sample --evidence "..."` | `gate full` |
| 4 Final | render into `Result/vN/` | `approve final --evidence "..."` | `gate deliver` |

- `submit` runs the checks first and refuses on any error; it snapshots the file and records its hash.
- Approvals are bound to hashes. Change a spoken word, a time or an emotion tag in SCRIPT.md, anything in STRUCTURE.md, or anything in STORYBOARD.md (the style too), and that gate (and every gate after it) shows `stale` and must be submitted and approved again. Changing a claim's status in `## Claims` does not.
- `gate <action>` exits 1 and prints why. Run it before: `voice`, `storyboard`, `build`, `sample`, `full`, `deliver`. `full` and `deliver` also refuse while any claim is still `placeholder`.
- After `submit`, show the user the table and the warnings, then stop. Do not start the next step in the same turn.

## Commands (`scripts/project.mjs`)

```
intake "<brief>" [--json]          what the brief states, what is assumed, the (at most 4) questions to ask
style [name|--list|--for "<brief>"]  a style card, the 36 styles, or the three that fit a brief
repair <proj>                     recreate any missing mandatory folder or template file (never overwrites)
new <Brand> <slug> --brief "..." [--type motion|footage] [--format landscape|portrait|square] [--duration N] [--narration yes|no] [--voice ...] [--character <id>|none] [--style NAME] [--language id-ID]
set-style <proj> <name>           fix the style (Storyboard/style.json; scaffold writes src/style.ts)
set-character <proj> <id>|none
status [project]                  gates, stale files, the next step
check script|storyboard <proj>    numbers and rules; storyboard also writes plan.json when clean
submit script|storyboard <proj>   check, snapshot, hash, wait for the user
approve <gate> <proj> --evidence "user's words"
gate voice|storyboard|build|sample|full|deliver <proj>
vo-lines <proj> [--engine plain|edge|elevenlabs|chatterbox]
                                  per-line text and voice settings from the script's emotion tags (Asset/agen/vo-lines.json, lines/lineN.txt)
vo <proj> <audio> [--min-gap S]  measure the real voice and map it to the script lines (finds the gap that gives one run per line)
vo-place <proj> [--lead 0.1] [--fit] [--lufs -15]
                                  build vo.wav from Asset/agen/line1..N.* placed at each script window and measure it. Reports every line that does not fit
                                  its window; --fit reschedules the lines (the approved script stays untouched); --lufs levels each line, writes the track
                                  as dual-mono stereo and measures it the way the video carries it
scaffold <proj>                   copy the Remotion starter into Source/remotion (after Gate 2)
assemble <proj> [--handle 15] [--force]  write Source/hyperframes/index.html from plan.json; verifies every clip (size, 60 fps, exact frame count)
log <proj> "note"
```

`<proj>` is a path or a name fragment under the root. New session: run `status` first, then read PROJECT.md.

## Revisions

- Ask what changes. A different word or timing in the script, or a different thing on screen = storyboard change: edit the file, `check`, `submit`, wait for approval again. Colour, copy typos or polish inside an approved frame: edit `Source/`, re-render that one clip.
- Never overwrite a delivered render: a new version goes to a new `Result/vN/`. Archive its source: `tar czf Result/vN/_source.tgz Source Storyboard`.
- Scenes you did not touch must come out identical. Compare a few frames of the old and new clip (`handoff.md`, "Verify the cut") before saying so.
- `project.mjs log <proj> "v2: ..."` so the next session knows.

## References

Analyse each reference before the storyboard: look at the frames or picture, fill `<id>.analysis.md` (hook, structure per scene, transitions and sound, what to reuse, what not to copy). Describe only what is visible. No reference from the user: say so in REFERENCES.md and state the pattern you chose.
