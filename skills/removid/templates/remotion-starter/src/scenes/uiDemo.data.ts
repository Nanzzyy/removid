// Single source of truth for the UiDemo scene: layout rects, cursor stops, zoom shots.
// The UI elements are positioned FROM these rects (rectStyle), and the cursor aims AT these rects,
// so the tip cannot miss. Pure data: the check scripts import this file directly.
import type {ZoomShot} from '../lib/camera.ts';
import type {CursorPlan, Targets} from '../lib/cursor.ts';

export const DURATION_SEC = 10;

export const T = {
  search: {x: 360, y: 190, w: 1200, h: 96},
  buy: {x: 1060, y: 760, w: 420, h: 104},
  cart: {x: 1690, y: 20, w: 120, h: 70},
} as const satisfies Targets;

export const CARD = {x: 360, y: 340, w: 640, h: 560};
export const TITLE = {x: 1060, y: 350, w: 640, h: 160};
export const PRICE = {x: 1060, y: 560, w: 640, h: 90};

/** Pad a rect (the highlight frames the button with some air around it). */
const pad = (r: {x: number; y: number; w: number; h: number}, px: number, py: number) => ({
  x: r.x - px,
  y: r.y - py,
  w: r.w + 2 * px,
  h: r.h + 2 * py,
});

export const SHOTS: ZoomShot[] = [
  {focus: pad(T.buy, 60, 40), start: 2.1, inDur: 0.8, hold: 1.7, outDur: 0.7, fill: 0.4, maxScale: 1.6},
  {focus: pad(T.cart, 50, 20), start: 6.4, inDur: 0.8, hold: 1.4, outDur: 0.7, fill: 0.18, maxScale: 1.8},
];

export const CURSOR: CursorPlan = {
  start: {x: 300, y: 700},
  stops: [
    {target: 'search', at: 1.2, click: true},
    {target: 'buy', at: 3.6, click: true},
    {target: 'cart', at: 5.9, click: true},
  ],
};
