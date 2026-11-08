// The one place a delivery (Mood) is applied to a character's face and lean. Used by the rig (Character.tsx), group shots and the
// emotion sheet, so they can never disagree. Works for every character: eye openness and lean for all, frown and brows for those that
// implement setExpression.
import type {Model} from '../characters/types.ts';
import type {Mood} from './emotion.ts';

export function applyFace(m: Model, mood: Mood, blink: number, talk: number): void {
  for (const e of m.eyeMeshes) e.scale.y = Math.max(0.08, (1 - 0.92 * blink) * mood.eye);
  m.root.rotation.z = mood.tilt * 0.5;
  // A character without brows still frowns with its eyes: slant them like brows (inner ends down = angry, up = sad).
  if (!m.setExpression) for (const e of m.eyeMeshes) { const x = e.position.x; if (Math.abs(x) < 1e-3) continue; e.userData.baseRotZ ??= e.rotation.z; e.rotation.z = e.userData.baseRotZ + (x < 0 ? -1 : 1) * mood.brow * 0.38; }
  m.setExpression?.({smile: mood.smile, brow: mood.brow, raise: mood.raise, eye: mood.eye, tilt: mood.tilt});
  m.setMouth(talk, m.setExpression ? mood.smile : Math.max(0, mood.smile));
}
