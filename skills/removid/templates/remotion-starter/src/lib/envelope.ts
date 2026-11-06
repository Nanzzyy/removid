// Mouth envelope for lip sync: one 0..1 value per video frame, produced offline by scripts/make-envelope.mjs.
// Never analyse audio at render time (headless Chrome has no realtime audio clock).
export type Envelope = {fps: number; values: number[]};

export const EMPTY_ENVELOPE: Envelope = {fps: 60, values: []};

/** Envelope value at a frame (0 outside the data). Interpolates if the envelope fps differs from the video fps. */
export function envAt(env: Envelope, frame: number, fps: number): number {
  if (env.values.length === 0) return 0;
  const idx = (frame / fps) * env.fps;
  const i0 = Math.floor(idx);
  const a = env.values[i0] ?? 0;
  const b = env.values[i0 + 1] ?? a;
  return a + (b - a) * (idx - i0);
}
