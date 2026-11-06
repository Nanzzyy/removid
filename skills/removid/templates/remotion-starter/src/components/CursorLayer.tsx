import React from 'react';
import {rectToScreen, toScreen, type Cam} from '../lib/camera.ts';
import {clickTimes, cursorPos, cursorScale, ringProgress, type Leg, type Targets} from '../lib/cursor.ts';
import type {Point} from '../lib/geom.ts';

/** Arrow whose TIP is the element origin (0,0), so translating to a point puts the tip exactly there. */
const Arrow: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
    <path d="M0 0 L0 17 L4.6 13 L7.4 19.6 L10 18.5 L7.2 12 L13 12 Z" fill="#1F1E1D" stroke="#FFFFFF" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

/**
 * Screen-space cursor. The path is planned in canvas coords and mapped through the camera, so it stays glued
 * to the content during zooms. `size` is in screen px (>= 56 on a 1440 px canvas; 72 on 1920).
 * debug: outlines every target (cyan) and draws a magenta crosshair on the tip.
 */
export const CursorLayer: React.FC<{
  t: number;
  cam: Cam;
  legs: Leg[];
  start: Point;
  targets: Targets;
  size?: number;
  debug?: boolean;
}> = ({t, cam, legs, start, targets, size = 72, debug}) => {
  const clicks = clickTimes(legs);
  const tip = toScreen(cam, cursorPos(t, legs, start));
  const ring = ringProgress(t, clicks);
  const sc = cursorScale(t, clicks);
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {debug &&
        Object.entries(targets).map(([id, rect]) => {
          const r = rectToScreen(cam, rect);
          return (
            // Drawn OUTSIDE the rect so it never covers the element's own (lime) outline.
            <div key={id} style={{position: 'absolute', left: r.x - 6, top: r.y - 6, width: r.w + 12, height: r.h + 12, border: '3px solid #00ffff', boxSizing: 'border-box'}}>
              <span style={{position: 'absolute', left: 0, top: -32, font: '600 22px monospace', color: '#00aaaa'}}>{id}</span>
            </div>
          );
        })}
      {ring !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: tip.x - 14 - ring * 46,
            top: tip.y - 14 - ring * 46,
            width: 28 + ring * 92,
            height: 28 + ring * 92,
            borderRadius: '50%',
            border: '5px solid #D97757',
            opacity: 1 - ring,
            boxSizing: 'border-box',
          }}
        />
      )}
      <div style={{position: 'absolute', left: 0, top: 0, transform: `translate(${tip.x}px, ${tip.y}px) scale(${sc})`, transformOrigin: '0 0'}}>
        <Arrow size={size} />
      </div>
      {debug && (
        <>
          <div style={{position: 'absolute', left: tip.x - 20, top: tip.y - 1.5, width: 40, height: 3, background: '#ff00ff'}} />
          <div style={{position: 'absolute', left: tip.x - 1.5, top: tip.y - 20, width: 3, height: 40, background: '#ff00ff'}} />
        </>
      )}
    </div>
  );
};
