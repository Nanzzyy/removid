// All easings map [0,1] -> [0,1] with f(0)=0, f(1)=1.
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
/** Zero velocity AND zero acceleration at both ends: the "no stiff start/stop" zoom curve. */
export const smootherstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const easeOutBack = (t: number, k = 1.70158): number => {
  const c3 = k + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);
};

/** Easings by the names styles use (styles/styles.json `ease`). `project.mjs` only accepts these names. */
export const EASES = {inOutSine: easeInOutSine, inOutQuad: easeInOutQuad, outCubic: easeOutCubic, smootherstep, outBack: easeOutBack} as const;
export type EaseName = keyof typeof EASES;
export const easeNamed = (name: string, t: number): number => (EASES[name as EaseName] ?? easeOutCubic)(Math.min(1, Math.max(0, t)));
