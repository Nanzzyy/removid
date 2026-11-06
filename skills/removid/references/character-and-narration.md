# Narrator character and narration

For any video that needs a spoken narrator. Ask first (SKILL.md "Ask first"): narration yes/no, character yes/no, which voice. Without narration there is no character.

## The built-in character

`src/components/ClaudeCharacter.tsx` (three.js, procedural, no external model files). A rounded coral body (`#D97757`), cream spark badge, simple dark capsule eyes, a mouth that opens with the voice, stubby arms that wave, point and present, short legs. It is **an original character in Claude's visual language (warm coral and cream, spark motif), not an official Anthropic asset or logo.** If the video is public or commercial, tell the user so and let them decide on brand use.

Everything about it is deterministic: it draws from a `Pose`, a pure function of time (`src/lib/pose.ts`). No `Math.random()`: blinks use a fixed hash. Two renders of the same frame are byte-identical (tested, including WebGL).

Customising: palette in `PALETTE`, proportions in `buildRig`. Keep silhouette simple; the face must read at small sizes.

## Pipeline

1. **Script** the lines. Short sentences, one idea each.
2. **Voice** audio file (user's recording, or TTS the user chose). Put it in `public/narration/<name>.mp3`.
3. **Envelope** (offline, never at render time):
   ```bash
   node scripts/make-envelope.mjs public/narration/<name>.mp3 --out public/narration/<name>.envelope.json
   ```
   One 0..1 mouth-opening value per frame (RMS, noise gate, fast attack, slower release). Works with any ffmpeg build.
4. **Time the cues** to the real audio, not to the script. Find speech and silence with `ffmpeg -i x.mp3 -af silencedetect=noise=-35dB:d=0.25 -f null -` (needs a full ffmpeg build) or read the envelope. Put them in `src/scenes/narrator.data.ts`:
   ```ts
   {kind: 'wave',    side: 'R', start: 0.05, dur: 1.6},
   {kind: 'point',   side: 'R', start: 4.0,  dur: 3.5, targetCanvas: {x: CARD.x + 10, y: CARD.y + 130}},
   {kind: 'present', side: 'R', start: 8.1,  dur: 2.4, targetCanvas: {...}},
   ```
   `side` is the arm on the screen's side (`L` = left of the screen). Targets are canvas points; the scene maps them through the camera each frame so the arm follows a zoom.
5. **Captions** (`CAPTIONS` in the same file) only when asked or when the platform is usually watched muted.
6. **Scene length** = audio length + about 0.3 s. Set `DURATION_SEC`.
7. `npm run check`: confirms the mouth follows the envelope (speech vs silence), cues only move their own arm, blinks are deterministic.
8. Stills: one speaking frame (mouth open), one silent frame (mouth a thin line), one point frame. Look for: hand or arm clipped at the canvas edge, arm covering the content it points at, character hiding the zoomed content, ground shadow under the feet.
9. Render the clip. The narration audio rides in the Remotion clip (`<Audio>`); in HyperFrames that clip keeps `data-has-audio="true"`.

## Layout rules learned the hard way

- **Character canvas wide enough**: arms reach about 1.75 world units; a canvas that is too narrow clips the hand (`CHAR_BOX` in the starter is 1400 px wide with the character at its centre, positioned at a negative x).
- **Arms stop at the target** (`reach`): the arm shortens to the distance so the hand rests on the card's edge instead of covering the text. Aim at an edge of the thing, not its middle.
- **Camera anchor**: when the narrator is on the left, zoom the content with `anchor.x` about 0.7 so it stays clear of the character. The narrator is drawn outside the `<Camera>` and does not zoom.
- Eyes and body turn slightly toward the current target (`look`).

## GL in headless Chrome

three.js needs WebGL. `remotion.config.ts` sets `Config.setChromiumOpenGlRenderer('swangle')` (software, works without a GPU). Plain `'angle'` failed with "Error creating WebGL context" on Chrome 158. If a render says that, switch the renderer (`swangle`, `angle-egl`, or `angle` on a GPU machine) and re-render a still before anything long.

## TTS notes

- Edge TTS (`pip install edge-tts`), `npx hyperframes tts`, a local engine, or the user's own recording all work; the pipeline only needs an audio file.
- Do not send the user's script to a cloud TTS without their consent, and never claim a voice that was not used.
- Pronunciation: spell brand names phonetically in the TTS input only, keep captions as written.
