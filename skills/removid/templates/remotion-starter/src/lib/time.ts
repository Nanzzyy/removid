// Pure helpers (no React, no remotion import) so Node scripts can load them directly.
export const FPS = 60;
export const W = 1920;
export const H = 1080;

/** seconds -> frames. Plan in seconds, convert here, never hard-code frame counts. */
export const s = (sec: number, fps: number = FPS): number => Math.round(sec * fps);
export const toSec = (frame: number, fps: number = FPS): number => frame / fps;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
