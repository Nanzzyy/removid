# source-material

Reference material the removid skill was built from. **It is not part of the skill and is never installed** (`install.sh` links only `skills/removid`). Agents working on this repo read `AGENTS.md` at the root, not the files here.

## creative-agent-style-library

The owner's library of 36 video styles (13 motion 3D, 13 motion graphics, 10 video editor) as prose style guides, a master prompt, a workflow and a scene-spec schema. Its own README says the names come from a public catalogue (https://kreatorlab.id/, read on 8 November 2026) and that every description, palette, camera and sound direction is an original interpretation, not an official specification.

| In the library | Became, in the skill |
| --- | --- |
| `styles/<category>/<slug>.md` (36 files) | `skills/removid/styles/styles.json`: the same 36 slugs as checked tokens (palette with contrast tests, shot rhythm, transition, zoom limit, on-screen words, easing, effects) plus `look`, `motion`, `camera`, `audio` and `avoid` condensed from the prose. A test fails if a style exists on one side only. |
| `references/STYLE_ALIASES.json` | the `aliases` of each style, tightened so a topic word ("evolusi", "system") is not read as a style name |
| `MASTER_PROMPT.md`, `references/WORKFLOW.md`, `skills/*/SKILL.md` | not copied: removid has its own fixed order and gates (`skills/removid/references/workflow.md`); the library's Blender and NLE routes are replaced by Remotion (authors) and HyperFrames (cuts) |

Two files that give agent instructions are renamed `AGENTS.upstream.md` and `CLAUDE.upstream.md`, so an agent that opens this folder does not load a second, conflicting workflow. Their content is unchanged.

To add or change a style: edit `skills/removid/styles/styles.json` (the source the checks use), keep the slug identical to the library file if there is one, and run `node --test tests/*.test.mjs`.
