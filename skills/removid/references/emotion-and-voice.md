# Emotion and voice

One tag in the script drives three things, so they cannot disagree: **how the line is spoken**, **how the narrator's face and body act**, **which gestures fit**. The table is `styles/emotions.json` (the starter carries a generated copy; a test fails if they drift).

## Tags

Open every narrated block with one: `[curious] Bagaimana ini berubah jadi kamu?`. A second tag may change the delivery mid-line (at most 2 per block, each covering 0.8 s or more, otherwise the face cannot show it). Tags are never spoken and never counted as words.

## The vocabulary is open

**Any emotion word works**, in English or Indonesian: `[furious]`, `[nostalgic]`, `[terrified]`, `[gembira]`, `[bittersweet]`. There is no closed list.

- **18 presets** are tuned by hand (table below): neutral, warm, curious, confused, surprised, excited, laugh, proud, serious, mad, sad, calm, impressed, concerned, thoughtful, afraid, tired, disgusted.
- **A shipped lexicon of about 160 more words** gives each a place between the presets (valence: unpleasant to pleasant; arousal: calm to energetic). A word takes its face, voice and body from the nearest presets, weighted by distance, so `[nostalgic]` lands among calm, warm and thoughtful. Words whose valence and arousal cannot tell anger from fear from disgust name a **family** (`furious`, `irritated`, `indignant` → mad; `nervous` → afraid; `gloomy` → sad): that preset's face, scaled by how intense the word is, so `irritated` frowns less than `furious`.
- **Aliases** map everyday words to a preset (`happy` → warm, `firm` → serious, `scared` → afraid, `capek` → tired).
- **Your own words** go in `Storyboard/emotions.custom.json` of the project: `{"bittersweet": {"va": [0.1, 0.25]}, "gloomish": {"like": "sad"}}` (a point of valence and arousal, or "like" another known word).
- **A word nobody knows** (`[Applause]`, `[wistfulish]`) is a warning, not an error: the face stays neutral, ElevenLabs receives the tag as written (its tags are free-form), and Edge, Voice Studio and the other engines drop it, so it is never read aloud. A **misspelling** of a known word (`[serios]`, `[thoughtful, slowr]`) is an error that names the word you meant (only words of 5+ letters are checked, so short real words are never "corrected").
- The tag may carry **more than one emotion** (`[excited, nervous]`: the second is mixed in at 35%) and **delivery words** (below).

The tuned presets:

| Tag | Feel | Voice (Edge) | Face | Gestures that fit |
| --- | --- | --- | --- | --- |
| neutral | default | +0 | gentle smile | all |
| warm | friendly, welcoming | rate -3%, pitch +2 | broad smile, soft brows | wave, present |
| curious | asking, wondering | pitch +6 | one brow lifted, head tilt | point, present |
| confused | puzzled | rate -6%, pitch +3 | flat mouth, inner brows up, tilt | present |
| surprised | sudden | rate +6%, pitch +10, vol +3 | wide eyes, brows up | point, present |
| excited | energetic | rate +10%, pitch +8, vol +5 | big smile, bigger bounce | all |
| laugh | amused | rate +4%, pitch +6 | squinting smile | wave, present |
| proud | assured | rate -4%, pitch -2 | smile, chin up | present, point |
| serious | firm | rate -6%, pitch -6 | straight mouth, brows down | point, present |
| mad | angry | rate +6%, pitch -4, vol +6 | frown, brows down hard | point |
| sad | low | rate -12%, pitch -8, vol -4 | frown, inner brows up, lean | none |
| calm | settled | rate -8%, pitch -3 | soft smile, half-lidded | present |
| impressed | admiring | pitch +4, vol +1 | broad smile, brows up, eyes wide | present, point |
| concerned | worried | rate -6%, pitch -2 | slight frown, inner brows up, lean | present |
| thoughtful | reflecting | rate -8%, pitch -2, pause 0.15 s | faint smile, half-lidded, head tilt | present |
| afraid | fearful | rate +8%, pitch +6, vol -2 | wide eyes, brows up and together, small frown | present |
| tired | worn out | rate -12%, pitch -6, vol -4, pause 0.2 s | heavy lids, slight frown, slumped | none |
| disgusted | repelled | rate -4%, pitch -4 | frown, brows down, narrowed eyes | point |

**Delivery words** (after the emotion, comma-separated; an unknown one is passed to free-form engines and otherwise ignored): `slower` (rate -8%), `faster` (+8%), `softer` (volume -4), `louder` (+4), `emphatic` (volume +3, pitch +2, bigger bounce), `reassuring` (rate -3%, a little more smile), `whisper` (volume -6, rate -6, small bounce). Rate stays within ±20% however many pile up. ElevenLabs receives the author's own words unchanged (`[firm, emphatic]`); Edge gets the summed rate, pitch and volume; the narrator's face and bounce use the nudged numbers.

`check script` also reads the arc: a hook delivered with energy under 0.5, an ending that is sad or calm before a call to action, every block the same tag, or a jump from sad to excited with no visual beat between are warnings. `check storyboard` warns when a narrator cue contradicts the delivery (a wave while the line is `sad`).

## Where the voice comes from: three routes, none of them installed by removid

removid ships no voice engine and installs nothing on anyone's machine. `project.mjs voice-check` lists what exists, read-only:

1. **The agent's default voice** (recommended): whatever speech tool the agent already has. Edge TTS id-ID is the baseline.
2. **A local speech server the owner already runs** (optional). `vo-synth` speaks each line to its OpenAI-compatible endpoint (`POST /v1/audio/speech`; Voice Studio's is on `127.0.0.1:3900`, set another with `--url` or `REMOVID_VOICE_URL`). It talks to loopback addresses only (a remote host needs `REMOVID_VOICE_ALLOW_REMOTE=1`, the owner's decision), starts nothing, and stops with a clear message when nothing answers.
3. **The user's own audio**: `vo-lines` lists each line (and the emotion to perform); the user records or generates one file per line (`Asset/agen/line1.*`) or one whole recording, and `vo-place` or `vo` measures it. No engine needed.

## The clean voice script

What goes to a TTS, or to a microphone, is **one separate file and nothing else**: `Asset/agen/vo-script.txt` (printed by `submit script`, or `project.mjs vo-script <proj>`). Each line opens with its tag as written, one blank line between lines so it can be cut line by line:

```
[curious] Pernah merasa... AI selalu punya jawaban?

[thoughtful, slower] Dan ketika semua keputusan kamu serahkan pada AI... kapan terakhir kali kamu benar-benar berpikir sendiri?
```

No times, no labels (HOOK, CTA), no scene directions, no zoom notes, no claims table, no estimated length. The words are the approved script's; the visuals are the storyboard's. `vo.txt` is the same without the tags, for engines that would read a bracket aloud.

A user who has one recording instead of per-line files: `project.mjs vo-split <proj> <audio>` cuts it into `line1..N.wav` at its pauses (0.5 s or more between lines; it refuses and says how many runs it found when the count does not match), then `vo-place <proj> --fit`. Never ask how long their audio is: `vo`, `vo-split` and `vo-place` measure it from the file.

## The voice is made after the script

The order is fixed: structure and script approved (Gate 1) → voice → character → storyboard. A voice made before the words are final is redone every time a word changes.

```bash
project.mjs vo-lines <proj> [--engine plain|edge|elevenlabs|chatterbox|voicestudio]
```

writes `Asset/agen/vo.txt` (clean words, one line per block, no tags), `Asset/agen/vo-lines.json` (each line with every engine's version) and, with `--engine`, `Asset/agen/lines/lineN.txt`. Synthesize one file per block (`Asset/agen/line1.mp3`...), then `vo-place <proj> --fit --lufs -15` (placement, levelling, measuring; `script.md`).

| Engine | What it does with the tags | Notes |
| --- | --- | --- |
| **Edge TTS** (default, id-ID) | has no emotion tags and reads brackets aloud, so none are sent; the tag becomes rate, pitch, volume (`engines.edge` in vo-lines.json) | `edge-tts --voice id-ID-GadisNeural --rate=-3% --pitch=+2Hz --volume=+0% --text "..." --write-media Asset/agen/line1.mp3`; the first value of a block applies to the whole file |
| **ElevenLabs** (v3 audio tags) | tags kept in place, e.g. `[curious]`, `[laughs]` | needs the user's key; check the tag names against the account's model before relying on them |
| **VoiceBox** (open source, local) | only its own sound tags, `[laugh]` and `[gasp]`, and only with the Chatterbox Turbo model; other models read tags as text | English only for those tags; no Linux binary yet (build from source). Not installed by removid; never assume it |
| **Voice Studio** (open source, AGPL-3.0 app, default engine OmniVoice, Apache-2.0; local server `127.0.0.1:3900`) | the default engine takes reaction tags and pauses, not emotion words, and reads an unknown tag aloud, so each tag becomes its documented reaction or pause: surprised `[surprise-oh]`, laugh `[laughter]`, mad `[dissatisfaction-hnn]`, sad `[sigh]`, confused `[pause 300ms]`, serious `[pause 250ms]`, the rest nothing; the emotion's rate becomes an ffmpeg `atempo` | Indonesian is in OmniVoice's language list (about 6,300 hours of training data, far more than Malay or Javanese). **Written from its documentation; not yet run against a live server** (the docker image is 17 GB and the test machine had 4 GB of free RAM), and some of its interjections are tuned for Mandarin-flavoured speech: judge by ear before relying on them |
| **The user's own audio** | the user performs the emotion (`vo-lines` says which); `vo-place` or `vo` measures the file | one file per block, with a pause between; no engine involved |

Say which engine is used and what it cannot do. Do not send the script to a service the user has not accepted, and never claim a voice that was not used. The tag still drives the narrator's face and gestures with any engine, including a recording.

## The face over time

`check storyboard` turns the tags into `plan.json` `emotions`: one segment per tag, starting 0.2 s before its first spoken word (the face leads the voice), holding until the next tag, relaxing to neutral 0.5 s after the last word. The Remotion scene calls `moodAt(t, plan.emotions)` and passes it to `narratorPose(..., mood)`. Blending is smooth (0.35 s, zero speed at both ends) so the face never pops; `npm run check` verifies the blend, and `npm run character -- <id> --emotions` renders all twelve faces of a character on one sheet and fails if one looks the same as neutral.

A character without brows still frowns: the rig slants its eyes like brows. A character that implements `setExpression` (the humanoid does: brows and frown) shows the full range. Design for the range: look at the emotion sheet before the user approves a character.

## Verify what the user will hear

Signal in the file is not the same as sound in the viewer. After the final render check loudness (`probe-mp4.sh`) and confirm on the player the user will use. If a viewer plays no sound, offer an audio-only copy (mp3) and an AAC 44.1 kHz copy before concluding the file is wrong: some previewers (an editor's built-in preview, for instance) do not decode every codec.
