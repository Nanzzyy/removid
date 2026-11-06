import React from 'react';
import type {Cam} from '../lib/camera.ts';

/** Applies the camera to everything inside. Put content here; keep cursor, captions and the narrator outside. */
export const Camera: React.FC<{cam: Cam; width: number; height: number; children: React.ReactNode}> = ({cam, width, height, children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width,
      height,
      transformOrigin: '0 0',
      transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`,
    }}
  >
    {children}
  </div>
);
