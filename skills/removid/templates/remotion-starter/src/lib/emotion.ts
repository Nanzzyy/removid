// The narrator's face over time, from the emotion tags in the script. Storyboard/plan.json carries one segment per tag with the
// absolute numbers (written by `project.mjs check storyboard` from styles/emotions.json), so this file needs no table: it only blends
// neighbouring segments. A pure function of time: no state, no randomness.
import {smootherstep} from './ease.ts';

export type Mood = {
  /** -1 frown .. 1 broad smile (0.55 is the old resting smile). */
  smile: number;
  /** -1 inner ends up (sad, worried) .. 0 flat .. 1 inner ends down (angry, serious). */
  brow: number;
  /** 0..1 brows lifted (curious, surprised). */
  raise: number;
  /** Eye openness multiplier: 0.8 squint .. 1.3 wide. */
  eye: number;
  /** Head lean in radians (a curious tilt). */
  tilt: number;
  /** Gain on the speech bounce. */
  bounce: number;
  /** 0..1, how animated the delivery is (drives nothing by itself; for scenes that want to match it). */
  energy: number;
};
export type MoodSegment = {tag: string; start: number; end: number | null; energy: number; face: {smile: number; brow: number; raise: number; eye: number; tilt: number}; body: {bounce: number}; gestures?: string[]};
export type EmotionPlan = {segments: MoodSegment[]; transitionSec: number};

/** What the narrator looked like before emotions existed: a calm resting smile. Used when a scene passes no mood. */
export const DEFAULT_MOOD: Mood = {smile: 0.55, brow: 0, raise: 0, eye: 1, tilt: 0, bounce: 1, energy: 0.4};

const of = (s: MoodSegment): Mood => ({...s.face, bounce: s.body.bounce, energy: s.energy});
const mix = (a: Mood, b: Mood, w: number): Mood => ({smile: a.smile + (b.smile - a.smile) * w, brow: a.brow + (b.brow - a.brow) * w, raise: a.raise + (b.raise - a.raise) * w, eye: a.eye + (b.eye - a.eye) * w, tilt: a.tilt + (b.tilt - a.tilt) * w, bounce: a.bounce + (b.bounce - a.bounce) * w, energy: a.energy + (b.energy - a.energy) * w});

/** The mood at time `t`: the current segment, blended in from the previous one over `blendSec` with zero speed at both ends. */
export function moodAt(t: number, plan: EmotionPlan | null | undefined, fallback: Mood = DEFAULT_MOOD): Mood {
  const segs = plan?.segments; if (!segs?.length) return fallback;
  let k = -1; for (let i = 0; i < segs.length; i++) if (t >= segs[i].start) k = i; else break;
  if (k < 0) return of(segs[0]);
  const cur = of(segs[k]); if (k === 0) return cur;
  const since = t - segs[k].start; const blend = plan!.transitionSec || 0.35;
  return since >= blend ? cur : mix(of(segs[k - 1]), cur, smootherstep(since / blend));
}

/** The segment active at `t` (for scenes that react to the emotion by name). */
export function segmentAt(t: number, plan: EmotionPlan | null | undefined): MoodSegment | null {
  const segs = plan?.segments; if (!segs?.length) return null;
  let k = -1; for (let i = 0; i < segs.length; i++) if (t >= segs[i].start) k = i; else break;
  return k < 0 ? null : segs[k];
}
