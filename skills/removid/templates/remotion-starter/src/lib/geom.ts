export type Point = {x: number; y: number};
export type Rect = {x: number; y: number; w: number; h: number};

export const centerOf = (r: Rect): Point => ({x: r.x + r.w / 2, y: r.y + r.h / 2});
/** Point inside a rect, given as fractions of its size (0.5,0.5 = centre). */
export const pointIn = (r: Rect, fx = 0.5, fy = 0.5): Point => ({x: r.x + r.w * fx, y: r.y + r.h * fy});
export const contains = (r: Rect, p: Point, pad = 0): boolean =>
  p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
export const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
/** CSS for an absolutely positioned element that occupies exactly this rect. */
export const rectStyle = (r: Rect): {position: 'absolute'; left: number; top: number; width: number; height: number} => ({
  position: 'absolute',
  left: r.x,
  top: r.y,
  width: r.w,
  height: r.h,
});
