// Single source of truth for the Narrator scene.
import type {ZoomShot} from '../lib/camera.ts';
import type {EmotionPlan} from '../lib/emotion.ts';
import type {Cue} from '../lib/pose.ts';

export const DURATION_SEC = 11;

/** The card the character points at (canvas coords). */
export const CARD = {x: 1020, y: 240, w: 720, h: 500};

/** Character canvas: top-left in composition pixels and size. */
/** Wide enough that a pointing arm is never clipped by the canvas edge. The character sits at the canvas centre (x = 520). */
export const CHAR_BOX = {x: -180, y: 0, w: 1400, h: 1080};

export const SHOTS: ZoomShot[] = [{focus: CARD, start: 4.2, inDur: 0.8, hold: 2.3, outDur: 0.7, fill: 0.47, maxScale: 1.5, anchor: {x: 0.7, y: 0.5}}];

/** Screen zone the zoom must never cover: the narrator and the arms resting at its sides (about x 0..870 on a 1920 canvas) stand here; a pointing arm reaches further, but only over empty space. */
export const KEEP_CLEAR = {x: 0, y: 0, w: 880, h: 1080};

/** Cue targets are given as canvas points; the scene maps them through the camera each frame. */
export const CUES: Array<Omit<Cue, 'target'> & {targetCanvas?: {x: number; y: number}}> = [
  {kind: 'wave', side: 'R', start: 0.05, dur: 1.6},
  {kind: 'point', side: 'R', start: 4.0, dur: 3.5, targetCanvas: {x: CARD.x + 10, y: CARD.y + 130}},
  {kind: 'present', side: 'R', start: 8.1, dur: 2.4, targetCanvas: {x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2}},
];

export const CAPTIONS = [
  {start: 0.0, end: 3.6, text: 'Halo! Aku maskot untuk video ini.'},
  {start: 4.2, end: 7.4, text: 'Lihat kartu ini: fokusnya selalu jelas.'},
  {start: 8.0, end: 10.3, text: 'Zoom halus, tanpa kaku.'},
];

/**
 * The delivery over time, in the shape `project.mjs check storyboard` writes to plan.json ("emotions"): one segment per emotion tag of the
 * script with absolute face/body numbers. A real scene reads them from plan.json; this sample inlines three (values of warm, curious, excited).
 */
export const MOODS: EmotionPlan = {
  transitionSec: 0.35,
  segments: [
    {tag: 'warm', start: 0, end: 3.8, energy: 0.5, face: {smile: 0.9, brow: -0.1, raise: 0.1, eye: 1.05, tilt: 0.03}, body: {bounce: 1.0}},
    {tag: 'curious', start: 3.8, end: 7.9, energy: 0.55, face: {smile: 0.4, brow: -0.15, raise: 0.6, eye: 1.12, tilt: 0.08}, body: {bounce: 0.9}},
    {tag: 'excited', start: 7.9, end: null, energy: 1.0, face: {smile: 1.0, brow: -0.1, raise: 0.5, eye: 1.15, tilt: 0.04}, body: {bounce: 1.5}},
  ],
};
