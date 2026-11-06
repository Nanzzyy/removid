import React from 'react';
import {rectStyle, type Rect} from '../lib/geom.ts';

/**
 * An element that occupies exactly one target rect. In debug mode it outlines ITS OWN box in lime, which is
 * how scripts/check-click-stills.mjs proves the visible element really sits where the cursor aims.
 */
export const TargetBox: React.FC<{
  rect: Rect;
  debug?: boolean;
  scale?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({rect, debug, scale = 1, style, children}) => (
  <div
    style={{
      ...rectStyle(rect),
      transform: scale === 1 ? undefined : `scale(${scale})`,
      outline: debug ? '3px solid #00ff00' : undefined,
      outlineOffset: debug ? -3 : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);
