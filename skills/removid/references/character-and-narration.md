# Narrator character and narration

For any video that needs a spoken narrator. The intake (`intake.md`) settles narration yes/no, a character yes/no and the voice. Without narration there is no character.

## What "a 3D character from Claude" means

**A 3D character that Claude designs for this video**: a woman, a man, a pixel/voxel figure, a mascot, a robot, whatever suits the brief. It is **not** the Claude logo or its sparkle turned 3D, and it never reuses an Anthropic or Claude mark, wordmark or colour scheme as its identity. If the user says "Claude-style", they mean *made by Claude*, in the same spirit as the examples here: simple, friendly, readable at video size, built in code.

Every character is a function that builds three.js meshes and returns a `Model` (`src/characters/types.ts`). The shared rig (`components/Character.tsx`) drives any model from the same `Pose` (a pure function of time, `src/lib/pose.ts`): breathing, head turn toward what it looks at, blinking, lip sync from the voice envelope, and the arm cues wave / point / present (the arm stops at its target instead of covering it). So a new character costs a builder, not a new animation system.

## Design the character (do this before the storyboard)

1. **Read the brief for who narrates.** Audience, brand, tone, platform. Ask only what is missing, as options, not an open question: woman / man / neutral person, pixel, mascot, or something else (robot, animal)? Age feel? Outfit? Brand colours?
2. **Pick the closest archetype and write its data** in `src/characters/index.ts` (copy a line, new lowercase `id`):

   | Archetype | Data you set | Suits |
   | --- | --- | --- |
   | `humanoid(...)` | `presentation` female/male/neutral, `skin`, `hair`, `hairStyle` short/buzz/long/bob/bun, `outfit` shirt/blazer/dress, `top`, `bottom`, `shoes`, `accent` (tie), `glasses` | services, B2B, education, finance, health |
   | `voxel(...)` | `skin`, `hair`, `hairStyle` short/long/cap, `top`, `bottom`, `shoes`, `accent` | games, apps, younger or playful audiences |
   | `mascot(...)` | `body`, `limbs`, `belly`, `ink` | any product, any age, no human face |

   Take clothes and accent from the brand's tokens (one accent only), keep skin and hair natural for the audience, and keep contrast with the scene background (a dark-suited character on a dark scene disappears).
   `humanoid` also covers figures that are not modern clothed people, all optional: `scale` (real size; the camera is shared, so a 0.7 figure looks smaller), `stoop`, `fur` (bare hairy body instead of clothes), `brow`, `jaw`, `headScale`, `armLength`, `hat`, `holding` (`torch`, `phone`, `wheat`; the torch flame flickers from `pose.time`), and for friendliness `eyeScale` and `blush` (cheeks, on by default). Every humanoid smiles when its mouth is closed. Design a **cast** (a narrator plus one actor per story beat) as several registered ids; `components/CharacterRow` draws several of them side by side in ONE WebGL canvas (a group shot; several canvases per frame make rendering very slow).
   "Cuter" is a direction the user may ask for: bigger eyes (`eyeScale` 1.3), rounder head (`headScale` 1), a softer lean and jaw, warm fur colours, blush. Keep the head level (a hunched body still looks ahead).
3. **No archetype fits** (robot, animal, a specific style)? Write a builder `src/characters/<name>.ts` that returns a `Model` and register it. Required parts: `root` (front toward +Z, feet at y = 0), `headAnchor` on the face, `torso` (origin at its bottom), `eyes` + `eyeMeshes` (squashed to blink), `setMouth(open, smile)`, and two `arms` with a `pivot` at the shoulder, a `length` and `setReach(r, pointing)`. Use `frameCamera(height, centerY)` for the camera. Build only meshes (no canvas textures, no renderer) so the checks can run in Node.
4. **Show it.** `npm run character -- <id>` renders `out/characters/<id>.png`: rest and speaking, wave, point. It FAILS when the character is clipped by its canvas, too small or too large, and prints where the feet land (set `groundY` accordingly). Look at the sheet. Show it to the user with one line on who it is and why, and revise colours, hair, outfit or proportions until they like it.
5. **Show its range.** `npm run character -- <id> --emotions` renders `out/characters/<id>-emotions.png`: all twelve emotions of `styles/emotions.json` on this character, head and shoulders, drawn with the same camera, and FAILS when an emotion looks the same as neutral. Look at it: sad, mad, surprised and confused must read at a glance. `humanoid` has brows and a frown; `voxel` and `mascot` get eye slant, eye size, lean and smile from the rig. A new builder may implement the optional `setExpression(e)` (brows, frown, mouth shapes) to show more (`types.ts`); without it the rig still slants the eyes like brows.
6. **Record it:** `project.mjs set-character <proj> <id>` (or `none` for a voice-only video). The storyboard cannot be submitted while the character is `undecided`; narrator cues need a real character.

`npm run check` verifies every registered character without a browser: it builds, stands on y = 0, has both arms on the right sides with the declared length, the arm shortens when asked to, the face points forward, and it fits the camera with `groundY` where the feet really land.

## Acting: the delivery drives the face

The script's emotion tags become `plan.json` `emotions` (`emotion-and-voice.md`). In a scene: `narratorPose(t, talk, cues, look, moodAt(t, plan.emotions))`. The mood carries smile (frown to broad), brows, raised brows, eye openness, head lean and the speech-bounce gain, blended smoothly between tags. With a style that sets `stepFps` (pixel, clay, paper), feed the pose `stepTime(t, STYLE.stepFps)` and keep the voice envelope on real time. Gestures follow the delivery: no wave while `sad`; `check storyboard` warns. A gesture starts just before the word it illustrates and rests between: arms are not always moving.

## Pipeline

1. **Structure and script**: `Storyboard/STRUCTURE.md` and `SCRIPT.md`, approved together at Gate 1 (`structure.md`, `script.md`). Short sentences, one idea each, an emotion tag opening each block.
2. **Voice** (after Gate 1) audio file (user's recording, or TTS the user chose, from `Asset/agen/vo.txt`). Measure it with `project.mjs vo <proj> <audio>` (segments + real pace go to `Asset/agen/vo-report.json` and into the storyboard's `vo` windows). Copy it to `public/narration/<name>.mp3`.
3. **Envelope** (offline, never at render time):
   ```bash
   node scripts/make-envelope.mjs public/narration/<name>.mp3 --out public/narration/<name>.envelope.json
   ```
   One 0..1 mouth-opening value per frame (RMS, noise gate, fast attack, slower release). Works with any ffmpeg build.
4. **Time the cues** to the real audio, not to the script (they are the `narrator:` lines of the approved storyboard). Find speech and silence with `project.mjs vo` or the envelope. Put them in `src/scenes/<scene>.data.ts`:
   ```ts
   {kind: 'wave',    side: 'R', start: 0.05, dur: 1.6},
   {kind: 'point',   side: 'R', start: 4.0,  dur: 3.5, targetCanvas: {x: CARD.x + 10, y: CARD.y + 130}},
   {kind: 'present', side: 'R', start: 8.1,  dur: 2.4, targetCanvas: {...}},
   ```
   `side` is the arm on the screen's side (`L` = left of the screen). Targets are canvas points; the scene maps them through the camera each frame so the arm follows a zoom.
5. **Captions** only when asked or when the platform is usually watched muted.
6. **Scene length** = audio length + about 0.3 s.
7. `npm run check`: mouth follows the envelope, cues only move their own arm, blinks are deterministic, characters meet the contract.
8. Stills: one speaking frame (mouth open), one silent frame, one point frame. Look for: hand or arm clipped at the canvas edge, arm covering the content it points at, character hiding the zoomed content, ground glow under the feet.
9. Render the clip. Voice and effects go into HyperFrames as `<audio>`; scene clips carry no audio.

## In a multi-scene video

The narrator is a continuous performer, not a per-clip decoration. Use `components/NarratorLayer.tsx` (`character` = the id) and give every scene clip the same inputs: the envelope of the WHOLE voice track (made once from the final `vo.wav`) looked up with the global frame, `envAt(env, startFrame + frame, fps)`, and cue times in global seconds. Then the mouth, the blinks and the arm cues line up in every clip and the character does not pop at a crossfade, because two clips show the identical pose at the same global time.

## Layout rules learned the hard way

- **Character canvas wide enough**: arms reach about 1.75 world units; a canvas that is too narrow clips the hand (`CHAR_BOX` in the starter is 1400 px wide with the character at its centre, at a negative x).
- **Arms stop at the target** (`reach`): the arm shortens to the distance so the hand rests on the content's edge instead of covering it. Aim at an edge of the thing, not its middle.
- **Resting arms are part of the body**: the character sheet prints each character's width. Measured on a 900 px canvas: the humanoids stand about 235..665 px wide at rest (centre 450), the pixel figure 180..720, the round mascot 58..841 (wider). Reserve `centre ± half width` plus a margin as the zone the zoom must keep clear (`KEEP_CLEAR`, 880 px on a 1920 canvas fits the widest), and keep content that must stay uncovered right of the pointing arm's reach (about x 1050 when the character is at x 520).
- **Camera anchor**: when the narrator is on the left, zoom the content with `anchor.x` about 0.7 so it stays clear of the character. The narrator is drawn outside the `<Camera>` and does not zoom.
- Eyes and body turn slightly toward the current target (`look`).

## GL in headless Chrome

three.js needs WebGL. `remotion.config.ts` sets `Config.setChromiumOpenGlRenderer('swangle')` (software, works without a GPU). Plain `'angle'` failed with "Error creating WebGL context" on Chrome 158. If a render says that, switch the renderer (`swangle`, `angle-egl`, or `angle` on a GPU machine) and render a still before anything long.

## TTS notes

- Edge TTS (`pip install edge-tts`), `npx hyperframes tts`, a local engine, or the user's own recording all work; the pipeline only needs an audio file.
- Do not send the user's script to a cloud TTS without their consent, and never claim a voice that was not used.
- Pronunciation: spell brand names phonetically in the TTS input only, keep captions as written. A brand name that the engine expands ("PrvTech" read as "PiArVee Tek") lengthens its line; measure instead of counting words.
- Per-line synthesis: make one file per script block (`Asset/agen/line1.mp3` ... in the order of `vo.txt`), then `project.mjs vo-place <proj>` places each at its window start (+0.1 s) into `vo.wav` and measures it.
- A TTS file carries 0.3 to 0.6 s of silence at its end: judge the speech (`vo` reports it), not the file length. Measured with Edge id-ID male on a 15 s promo: 2.58 to 3.01 words/s speech-only, 1.5 to 2.2 words/s counting the silence.
