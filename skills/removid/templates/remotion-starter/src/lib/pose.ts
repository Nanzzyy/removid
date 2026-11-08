// Narrator pose as a pure function of time. The 3D component only draws what this returns.
import {smootherstep} from './ease.ts';
import {DEFAULT_MOOD, type Mood} from './emotion.ts';
import type {Point} from './geom.ts';
import {clamp} from './time.ts';

export type Side = 'L' | 'R'; // screen side of the arm: L = left of the screen
export type CueKind = 'wave' | 'point' | 'present';
export type Cue = {
  kind: CueKind;
  side: Side;
  /** Seconds. */
  start: number;
  dur: number;
  /** Screen-space point the character points at / presents to (resolved by the scene, camera included). */
  target?: Point;
};

export type ArmPose = {
  /** 0..1 weights, they do not need to sum to 1. */
  wave: number;
  point: number;
  present: number;
  aimTarget: Point | null;
  wavePhase: number;
};

export type Pose = {
  /** Seconds. Lets a character animate a prop (a flame) as a pure function of time. */
  time: number;
  talk: number; // mouth opening 0..1
  blink: number; // 0 open .. 1 closed
  breathe: number; // -1..1
  bounce: number; // vertical emphasis hop, 0..1
  smile: number; // -1..1 (frown..broad smile); the mood's smile
  /** The delivery's face and body numbers (brows, eye openness, lean, bounce gain). DEFAULT_MOOD when the scene passes none. */
  mood: Mood;
  look: Point | null; // screen-space point the eyes and head turn toward
  lookWeight: number;
  armL: ArmPose;
  armR: ArmPose;
};

const idleArm = (): ArmPose => ({wave: 0, point: 0, present: 0, aimTarget: null, wavePhase: 0});

/** Ramp in, hold, ramp out: 0..1. */
export function windowed(t: number, start: number, dur: number, ramp = 0.3): number {
  if (t <= start || t >= start + dur) return 0;
  const r = Math.min(ramp, dur / 2);
  if (t < start + r) return smootherstep((t - start) / r);
  if (t > start + dur - r) return smootherstep((start + dur - t) / r);
  return 1;
}

/** Deterministic blink: roughly every 3 s, 0.15 s long, jittered by a fixed hash (no Math.random). */
export function blinkAt(t: number): number {
  const slot = 3.1;
  const i = Math.floor(t / slot);
  const hash = (n: number) => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const start = i * slot + 0.6 + hash(i) * 1.6;
  const u = (t - start) / 0.15;
  if (u < 0 || u > 1) return 0;
  return u < 0.5 ? u * 2 : (1 - u) * 2;
}

export function narratorPose(t: number, talk: number, cues: Cue[], look: Point | null, mood: Mood = DEFAULT_MOOD): Pose {
  const arms: Record<Side, ArmPose> = {L: idleArm(), R: idleArm()};
  for (const c of cues) {
    const w = windowed(t, c.start, c.dur);
    if (w <= 0) continue;
    const a = arms[c.side];
    if (c.kind === 'wave') {
      a.wave = Math.max(a.wave, w);
      a.wavePhase = (t - c.start) * Math.PI * 2 * 2.2;
    } else if (c.kind === 'point') {
      a.point = Math.max(a.point, w);
      a.aimTarget = c.target ?? null;
    } else {
      a.present = Math.max(a.present, w);
      a.aimTarget = c.target ?? a.aimTarget;
    }
  }
  // Eyes follow the first pointing/presenting target while it is active, else the given look point.
  const active = cues.find((c) => c.target && windowed(t, c.start, c.dur) > 0);
  return {
    time: t,
    talk: clamp(talk, 0, 1),
    blink: blinkAt(t),
    breathe: Math.sin(t * Math.PI * 2 * 0.28),
    bounce: clamp(talk * 1.2 * mood.bounce, 0, 1),
    smile: mood.smile,
    mood,
    look: active?.target ?? look,
    lookWeight: active?.target ? windowed(t, active.start, active.dur) : look ? 1 : 0,
    armL: arms.L,
    armR: arms.R,
  };
}
