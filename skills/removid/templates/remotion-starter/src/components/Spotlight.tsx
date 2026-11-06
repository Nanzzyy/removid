import React from 'react';
import {rectToScreen, type Cam} from '../lib/camera.ts';
import type {Rect} from '../lib/geom.ts';

/** Dims everything except the highlighted rect. `strength` 0..1 follows the zoom progress. Screen space. */
export const Spotlight: React.FC<{rect: Rect; cam: Cam; strength: number; accent?: string; pad?: number}> = ({rect, cam, strength, accent = '#D97757', pad = 14}) => {
  if (strength <= 0.001) return null;
  const r = rectToScreen(cam, rect);
  return (
    <div
      style={{
        position: 'absolute',
        left: r.x - pad,
        top: r.y - pad,
        width: r.w + 2 * pad,
        height: r.h + 2 * pad,
        borderRadius: 28,
        boxShadow: `0 0 0 4000px rgba(31,30,29,${0.32 * strength})`,
        outline: `${4}px solid ${accent}`,
        outlineOffset: 0,
        opacity: strength,
        pointerEvents: 'none',
      }}
    />
  );
};
