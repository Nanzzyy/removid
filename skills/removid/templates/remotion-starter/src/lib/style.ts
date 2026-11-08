// Helpers over the style tokens in src/style.ts. Pure, no React.
import {easeNamed} from './ease.ts';

export type StyleTokens = {
  id: string; name: string; category: string; build: string;
  palette: {bg: string; fg: string; accent: string; accent2: string; muted: string};
  transition: {kind: 'cut' | 'fade' | 'slide' | 'wipe'; sec: number};
  ease: {enter: string; move: string};
  /** 0 = smooth; 8..12 = poses held between steps (pixel, clay, paper looks). */
  stepFps: number;
  zoomMax: number; shotSec: [number, number]; maxWords: number;
};

/** Time quantised to the style's pose rate. Feed it to the pose, not to the audio envelope: the voice stays continuous. */
export const stepTime = (t: number, stepFps: number): number => (stepFps > 0 ? Math.floor(t * stepFps + 1e-9) / stepFps : t);

/** 0..1 eased progress of something entering at `start` for `dur` seconds, with the style's enter easing. */
export const enter = (style: StyleTokens, t: number, start: number, dur = 0.5): number => easeNamed(style.ease.enter, (t - start) / dur);
/** The same for a move (camera, slide) with the style's move easing. */
export const move = (style: StyleTokens, t: number, start: number, dur = 0.8): number => easeNamed(style.ease.move, (t - start) / dur);

/** Each item of a list enters `step` s after the previous one: the style's stagger. */
export const stagger = (i: number, step = 0.08): number => i * step;
