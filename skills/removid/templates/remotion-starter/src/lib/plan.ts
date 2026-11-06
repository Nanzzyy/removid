// Helpers for scenes that are driven by Storyboard/plan.json (written by `project.mjs check storyboard`). Pure, no React.
//
// Convention: a scene composition is rendered as a CLIP for one storyboard frame, starting at `startFrame` of the whole video.
// Scene time is GLOBAL: t = (startFrame + useCurrentFrame()) / fps, so the seconds in *.data.ts are the storyboard's seconds,
// and a character whose pose is a function of t carries on seamlessly from one clip into the next.

export type PlanVo = {start: number; end: number; text: string};
export type PlanFrame = {id: number; name: string; start: number; end: number; startFrame: number; endFrame: number; durationFrames: number; clipFrames: number; vo: PlanVo[]};
export type Plan = {fps: number; totalSec: number; totalFrames: number; frames: PlanFrame[]};

/** Picture rendered before and after a scene's range, for the crossfade. 15 frames = 0.25 s at 60 fps (0.5 s of overlap between clips). */
export const HANDLE_FRAMES = 15;

/** First frame, last frame (exclusive) and length of the clip for a storyboard frame: its range plus a handle each side, clamped to the video. */
export function clipRange(totalFrames: number, f: {startFrame: number; endFrame: number}, handle = HANDLE_FRAMES): {from: number; to: number; durationInFrames: number} {
  const from = Math.max(0, f.startFrame - handle);
  const to = Math.min(totalFrames, f.endFrame + handle);
  return {from, to, durationInFrames: to - from};
}

/**
 * Opacity of a scene's CONTENT (not the background or the narrator). It leaves in the last `dur` seconds of the scene's range, so
 * when HyperFrames crossfades two clips only the background and the identical narrator are blended, never two text layouts on top
 * of each other. The last scene never leaves.
 */
export function exitAlpha(t: number, endSec: number, isLast: boolean, dur = 0.25): number {
  if (isLast) return 1;
  return Math.min(1, Math.max(0, (endSec - t) / dur));
}

/**
 * When each word of a line should appear so the words follow the voice: spread over the vo window [voStart, voEnd] in proportion to
 * the word lengths, starting `lead` after the window opens and finishing `tail` before it closes.
 */
export function revealTimes(words: string[], voStart: number, voEnd: number, lead = 0.12, tail = 0.28): number[] {
  const total = words.reduce((a, w) => a + w.length, 0) || 1;
  const span = Math.max(0, voEnd - voStart - lead - tail);
  let before = 0;
  return words.map((w) => {
    const at = voStart + lead + (before / total) * span;
    before += w.length;
    return at;
  });
}
