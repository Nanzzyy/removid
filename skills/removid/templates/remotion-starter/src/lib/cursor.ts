// Cursor planning. The path lives in CANVAS coordinates and is mapped through the camera when drawn,
// so the tip can never drift off a target while the camera zooms.
//
// Author stops by target id and ARRIVAL time. The library derives departure from distance, holds on the
// target, then clicks. Positions come from the shared target table, never from typed coordinates.
import {easeInOutQuad, easeInOutSine, easeOutBack} from './ease.ts';
import {dist, pointIn, type Point, type Rect} from './geom.ts';
import {clamp} from './time.ts';

export type Targets = Record<string, Rect>;

export type Stop = {
  target: string;
  /** Seconds when the tip arrives on the target. */
  at: number;
  click?: boolean;
  /** Aim point inside the target as fractions (default centre). */
  aim?: {fx: number; fy: number};
};

export type CursorPlan = {
  /** On-canvas start point. The cursor never starts off screen. */
  start: Point;
  stops: Stop[];
  /** Hold on the target before the click, seconds (>= 2 frames at 60 fps). */
  dwell?: number;
  /** Average travel speed, px/s. */
  speed?: number;
  minTravel?: number;
};

export type Leg = {
  target: string;
  from: Point;
  to: Point;
  depart: number;
  arrive: number;
  clickAt?: number;
};

export const CLICK_PRESS = 0.06; // press-down time before the click instant
export const CLICK_RELEASE = 0.2; // spring back after the click

export function planCursor(plan: CursorPlan, targets: Targets): {legs: Leg[]; issues: string[]} {
  const dwell = plan.dwell ?? 0.12;
  const speed = plan.speed ?? 900;
  const minTravel = plan.minTravel ?? 0.4;
  const issues: string[] = [];
  const legs: Leg[] = [];
  let at: Point = plan.start;
  let free = 0; // time the cursor is free to leave again
  for (const stop of plan.stops) {
    const rect = targets[stop.target];
    if (!rect) {
      issues.push(`unknown target "${stop.target}"`);
      continue;
    }
    const to = pointIn(rect, stop.aim?.fx ?? 0.5, stop.aim?.fy ?? 0.5);
    const travel = Math.max(minTravel, dist(at, to) / speed);
    let depart = stop.at - travel;
    if (depart < free - 1e-9) {
      issues.push(`"${stop.target}": needs ${travel.toFixed(2)}s of travel but only ${(stop.at - free).toFixed(2)}s are free`);
      depart = free;
    }
    const clickAt = stop.click ? stop.at + dwell : undefined;
    legs.push({target: stop.target, from: at, to, depart, arrive: stop.at, clickAt});
    free = (clickAt ?? stop.at + dwell) + CLICK_RELEASE * 0.6;
    at = to;
  }
  return {legs, issues};
}

/**
 * Tip position at time t (canvas coords). x and y use different easings so the path curves.
 * Before the first departure the cursor sits at `start`; after the last leg it stays on the target.
 */
export function cursorPos(t: number, legs: Leg[], start: Point): Point {
  let pos = start;
  for (const leg of legs) {
    if (t < leg.depart) return pos;
    if (t < leg.arrive) {
      const u = (t - leg.depart) / (leg.arrive - leg.depart);
      return {
        x: leg.from.x + (leg.to.x - leg.from.x) * easeInOutSine(u),
        y: leg.from.y + (leg.to.y - leg.from.y) * easeInOutQuad(u),
      };
    }
    pos = leg.to;
  }
  return pos;
}

export const clickTimes = (legs: Leg[]): number[] => legs.flatMap((l) => (l.clickAt === undefined ? [] : [l.clickAt]));

/** Cursor scale: 1 -> 0.82 while pressing, springs back after the click. */
export function cursorScale(t: number, clicks: number[]): number {
  let sc = 1;
  for (const c of clicks) {
    if (t >= c - CLICK_PRESS && t < c) sc = Math.min(sc, 1 - 0.18 * ((t - (c - CLICK_PRESS)) / CLICK_PRESS));
    else if (t >= c && t < c + CLICK_RELEASE) sc = Math.min(sc, 0.82 + 0.18 * easeOutBack((t - c) / CLICK_RELEASE));
  }
  return sc;
}

/** Ring progress 0..1 after a click (undefined when no ring is visible). */
export function ringProgress(t: number, clicks: number[], dur = 0.45): number | undefined {
  for (const c of clicks) if (t >= c && t < c + dur) return (t - c) / dur;
  return undefined;
}

/** Scale of the clicked target: presses to 0.95 on the click, springs back. */
export function targetPress(t: number, clickAt: number): number {
  if (t < clickAt - CLICK_PRESS) return 1;
  if (t < clickAt) return 1 - 0.05 * ((t - (clickAt - CLICK_PRESS)) / CLICK_PRESS);
  if (t < clickAt + 0.25) return 0.95 + 0.05 * easeOutBack((t - clickAt) / 0.25);
  return 1;
}

/** Peak speed (px/frame) and largest single-frame turn (radians) along the sampled path. */
export function pathStats(legs: Leg[], start: Point, fps: number, duration: number): {peakPxPerFrame: number; maxTurn: number} {
  let peak = 0;
  let maxTurn = 0;
  let prev = cursorPos(0, legs, start);
  let prevV: Point | undefined;
  const n = Math.ceil(duration * fps);
  for (let f = 1; f <= n; f++) {
    const p = cursorPos(f / fps, legs, start);
    const v = {x: p.x - prev.x, y: p.y - prev.y};
    const sp = Math.hypot(v.x, v.y);
    peak = Math.max(peak, sp);
    if (prevV && sp > 0.5 && Math.hypot(prevV.x, prevV.y) > 0.5) {
      const d = Math.atan2(v.y, v.x) - Math.atan2(prevV.y, prevV.x);
      maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
    }
    prevV = v;
    prev = p;
  }
  return {peakPxPerFrame: peak, maxTurn: clamp(maxTurn, 0, Math.PI)};
}
