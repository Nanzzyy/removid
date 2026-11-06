// Smooth zoom-to-highlight camera. Pure functions of time, no React.
//
// A camera is {s, tx, ty}: screen = canvas * s + (tx, ty). Content lives in canvas coordinates;
// everything that must stay glued to the content (cursor path, targets) is mapped through the camera.
import {smootherstep} from './ease.ts';
import {centerOf, type Point, type Rect} from './geom.ts';
import {clamp, lerp} from './time.ts';

export type Cam = {s: number; tx: number; ty: number};
export const IDENTITY: Cam = {s: 1, tx: 0, ty: 0};

export type ZoomShot = {
  /** Rect (canvas coords) to highlight. */
  focus: Rect;
  /** Seconds when the zoom-in starts moving. */
  start: number;
  /** Zoom-in duration. 0.6-0.9 s for large zooms, at least 0.4 s for small ones. */
  inDur: number;
  /** Seconds the camera stays still on the focus. */
  hold: number;
  /** Zoom-out duration. */
  outDur: number;
  /** Fraction of the canvas width the focus should fill at full zoom. Default 0.5. */
  fill?: number;
  /** Explicit scale; overrides `fill`. */
  scale?: number;
  /** Upper bound for the computed scale. Default 1.8. */
  maxScale?: number;
  /** Where the focus centre sits on screen at full zoom, as fractions of the canvas. Default centre. */
  anchor?: Point;
};

export const shotEnd = (z: ZoomShot): number => z.start + z.inDur + z.hold + z.outDur;

/** Final zoom scale of a shot. */
export function shotScale(z: ZoomShot, W: number): number {
  if (z.scale !== undefined) return z.scale;
  const want = ((z.fill ?? 0.5) * W) / z.focus.w;
  return clamp(want, 1.1, z.maxScale ?? 1.8);
}

/** 0 = no zoom, 1 = fully zoomed. Smootherstep in and out. */
export function zoomProgress(t: number, z: ZoomShot): number {
  const tIn = z.start + z.inDur;
  const tOut = tIn + z.hold;
  if (t <= z.start || t >= tOut + z.outDur) return 0;
  if (t < tIn) return smootherstep((t - z.start) / z.inDur);
  if (t <= tOut) return 1;
  return 1 - smootherstep((t - tOut) / z.outDur);
}

/** The shot that is active at t (progress > 0 or inside its window), or undefined. */
export const activeShot = (t: number, shots: ZoomShot[]): ZoomShot | undefined =>
  shots.find((z) => t > z.start && t < shotEnd(z));

/**
 * Camera at time t. Zooms about the focus point while that point drifts to its anchor on screen,
 * scale is interpolated in log space (constant perceived zoom speed), and the view never leaves the canvas.
 */
export function camAt(t: number, shots: ZoomShot[], W: number, H: number): Cam {
  const z = activeShot(t, shots);
  if (!z) return IDENTITY;
  const p = zoomProgress(t, z);
  if (p <= 0) return IDENTITY;
  const s1 = shotScale(z, W);
  const f = centerOf(z.focus);
  const a = {x: (z.anchor?.x ?? 0.5) * W, y: (z.anchor?.y ?? 0.5) * H};
  const s = Math.exp(p * Math.log(s1));
  const fs = {x: lerp(f.x, a.x, p), y: lerp(f.y, a.y, p)};
  return {
    s,
    tx: clamp(fs.x - f.x * s, W - W * s, 0),
    ty: clamp(fs.y - f.y * s, H - H * s, 0),
  };
}

export const toScreen = (cam: Cam, p: Point): Point => ({x: p.x * cam.s + cam.tx, y: p.y * cam.s + cam.ty});
export const rectToScreen = (cam: Cam, r: Rect): Rect => ({
  x: r.x * cam.s + cam.tx,
  y: r.y * cam.s + cam.ty,
  w: r.w * cam.s,
  h: r.h * cam.s,
});

export type CamIssue = {level: 'error' | 'warn'; msg: string};

/** Authoring rules for zoom shots. Errors fail the check script; warnings are reported. */
export function validateShots(shots: ZoomShot[], W: number, H: number): CamIssue[] {
  const out: CamIssue[] = [];
  const sorted = [...shots].sort((a, b) => a.start - b.start);
  sorted.forEach((z, i) => {
    const s1 = shotScale(z, W);
    const big = s1 - 1 >= 0.08;
    const minIn = big ? 0.6 : 0.4;
    const tag = `zoom #${i + 1}`;
    if (z.inDur < minIn) out.push({level: 'error', msg: `${tag}: inDur ${z.inDur}s < ${minIn}s (stiff zoom)`});
    if (z.outDur < minIn) out.push({level: 'error', msg: `${tag}: outDur ${z.outDur}s < ${minIn}s`});
    if (z.inDur > 1.2) out.push({level: 'warn', msg: `${tag}: inDur ${z.inDur}s is slow; 0.6-0.9 s reads best`});
    if (z.hold < 0.5) out.push({level: 'warn', msg: `${tag}: hold ${z.hold}s is short; the viewer needs time to read`});
    if (s1 > 2) out.push({level: 'warn', msg: `${tag}: scale ${s1.toFixed(2)} > 2; bitmaps will look soft`});
    if (s1 <= 1.05) out.push({level: 'warn', msg: `${tag}: scale ${s1.toFixed(2)} is barely visible`});
    const f = z.focus;
    if (f.x < 0 || f.y < 0 || f.x + f.w > W || f.y + f.h > H) out.push({level: 'error', msg: `${tag}: focus outside the canvas`});
    const next = sorted[i + 1];
    if (next && next.start - shotEnd(z) < 0.15) {
      out.push({level: 'error', msg: `${tag}: gap to next zoom is ${(next.start - shotEnd(z)).toFixed(2)}s, need >= 0.15s (no zoom in-out-in)`});
    }
  });
  void H;
  return out;
}
