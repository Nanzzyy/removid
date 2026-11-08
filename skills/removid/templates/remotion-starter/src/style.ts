// The video's style tokens. `project.mjs set-style` + `scaffold` overwrite this file with the chosen style (styles/styles.json);
// until then it holds a neutral default. Scenes read colours, easing and rhythm from here instead of hard-coding them.
import type {StyleTokens} from './lib/style.ts';

export const STYLE: StyleTokens = {
  id: 'default', name: 'DEFAULT', category: 'motion-graphics', build: 'remotion-2d',
  palette: {bg: '#FAF9F5', fg: '#1F1E1D', accent: '#D97757', accent2: '#6A9BCC', muted: '#5E5A50'},
  transition: {kind: 'fade', sec: 0.5}, ease: {enter: 'outCubic', move: 'inOutSine'}, stepFps: 0, zoomMax: 2, shotSec: [2, 6], maxWords: 8,
};
