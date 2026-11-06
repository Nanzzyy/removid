# Workflow: Remotion authors, HyperFrames cuts

```
ask -> plan (gate 1) -> Remotion scenes -> check + stills -> cursor proof -> scene clips (60 fps)
    -> HyperFrames cut + assemble -> sample (gate 2) -> final render -> probe
```

## 0. Ask

See `SKILL.md` "Ask first". Record the answers in the plan so a later revision does not re-ask.

## 1. Brief

| Field | Default |
| --- | --- |
| Goal / message (one sentence) | ask |
| Platform / audience | ask if it changes aspect ratio |
| Length | 15-30 s promos, shorter for social; a narrated video is as long as its voice track plus 1 s |
| Size and **fps** | 1920x1080 @ **60** (vertical 1080x1920) |
| Copy | draft it, mark as draft |
| Brand (logo, colours, fonts) | ask for files; never invent a logo |
| Audio | music only if asked (measure a song's real tempo before planning cuts); narration per the questions |

Show real things (product screens, logo, real imagery). Draw only what has no source.

## 2. Plan (gate 1)

```
Size/fps/length: 1920x1080 @60, 18 s
Narration: yes, Claude-style character, TTS id-ID female   (or: none)
Scenes (Remotion):          clip file
  01 hook      0.0-3.0 s    scenes/01-hook.mp4
  02 demo      3.0-9.0 s    scenes/02-demo.mp4
       cursor: search (1.2 click) -> buy (3.6 click) -> cart (5.9 click)
       zoom:   buy 2.1-5.3 s, cart badge 6.4-9.3 s
       narrator: wave 0.05-1.6, point at card 4.0-7.5
Assembly (HyperFrames): trim 02 by 0.5 s, music bed, outro, cuts on beats
Props/variables: headline, accent, logo
Assets needed: logo.svg, product-01.png, narration audio
```

Every adjective becomes a number ("fast" = 0.3 s entrances). Cursor targets, zoom focuses and narrator cues are named. Wait for approval.

## 3. Remotion (author and edit)

- Start: `scripts/new-project.sh <dir>` (or continue the existing project).
- One scene = one `<Composition>`, `fps={60}`, typed props, text/colours/media as props.
- Scene data (target rects, cursor stops, zoom shots, narrator cues) lives in `src/scenes/<scene>.data.ts`; UI elements are positioned from it.
- Edit visually in `npm run studio`.

## 4. Check and stills

```bash
npm run typecheck
npm run check            # zoom smoothness, cursor speed/hold/arrival, pose + lip-sync rules
npx remotion compositions   # fps must read 60
```

Render stills and look at them: start, mid and end of each scene, each click frame, one frame inside each zoom hold, one speaking frame and one silent frame for a narrator. Check overflow, off-canvas, safe area, fonts, clipped hands/limbs, text covered by the character.

## 5. Cursor proof

`npm run check:cursor` renders debug stills at every arrival and click and measures the tip against the element in pixels. It must print ALL OK (tip within 3 px of the aim point). See `cursor-and-camera.md`.

## 6. Scene clips

`npx remotion render src/index.ts <Id> out/scenes/NN-name.mp4` with about 0.5 s handle at head and tail. Probe: `scripts/probe-mp4.sh clip.mp4 1920x1080 60 <seconds>`.

## 7. HyperFrames (cut and assemble)

Import clips, trim, split, order, overlap for transitions, align cuts to measured beats, add music, `check`, `snapshot`, preview. Details in `hyperframes.md`, `handoff.md`.

## 8. Sample (gate 2)

About 10 s (or the busiest part) at draft quality: `npx hyperframes render --fps 60 --quality draft`. Show it, wait.

## 9. Final

`npx hyperframes render --fps 60 --quality delivery --output out.mp4`, then `scripts/probe-mp4.sh out.mp4 1920x1080 60 <seconds>`. Decode a few frames and look again; for a trimmed clip confirm the offset (`handoff.md`).

## Report

File path, size, duration, fps, resolution; what the user can change and where (Remotion props and `*.data.ts`, HyperFrames timeline); anything approximated; failures stated plainly with output.

## Revisions and batches

- Change to one scene: re-render that clip, replace the file, re-run `check`. Do not touch other clips.
- Batch from rows: verify ONE row by stills before rendering all; name outputs from a field.
