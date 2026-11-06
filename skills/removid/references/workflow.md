# Workflow: brief to delivered file

## Brief checklist

| Field | Default if unspecified |
| --- | --- |
| Goal / message (one sentence) | ask |
| Audience and platform | ask if it changes aspect ratio |
| Length | 15-30 s for promos, shorter for social |
| Size and fps | 1920x1080 @ 30 (vertical: 1080x1920) |
| Copy | draft it, mark as draft |
| Brand (logo, colours, fonts) | ask for files; never invent a logo |
| Audio | none unless asked; films over ~15 s that tell something usually benefit from music |

Show real things from their source (product screens, brand logo, real imagery). Draw only what has no source.

## Plan format (gate 1)

```
Engine: HyperFrames | Remotion
Size/fps/length: 1920x1080 @30, 18 s
Shots:
  0.0-3.0  hook: <what is on screen, what moves>
  3.0-9.0  ...
Variables: headline, accent colour, logo
Assets needed: logo.svg, product-01.png
```

Every adjective in the brief becomes a number ("fast" = 0.3 s entrances, "calm" = 0.8 s eases).

## Build rules

- One scene per file/component, short readable ids.
- Copy, brand colours and swappable media are props/variables.
- Timing in seconds in the plan; convert to frames only inside Remotion (`frame / fps`).

## Verification loop

1. Engine check (`npx hyperframes check --json`, or type-check + `npx remotion compositions` for Remotion). Fix every error, weigh every warning.
2. Stills at start / mid / end of each scene, with the props that will ship. Inspect them.
3. Sample render (~10 s) at draft quality. Show the user. Wait.
4. Full render. `scripts/probe-mp4.sh`. Decode a few frames from the final file and look again.

## Report at the end

- File path and size, duration, fps, resolution.
- What the user can change (props/variables, where).
- Anything dropped, approximated or substituted (fonts, ported effects), in a short list.
- Failures stated plainly, with command output.

## Batch / data-driven

Verify ONE representative row by stills before rendering all rows. Output names come from a field, never an index only.
