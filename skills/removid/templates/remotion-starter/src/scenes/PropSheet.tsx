import React from 'react';
import {AbsoluteFill} from 'remotion';
import {GlbProp} from '../components/GlbProp.tsx';
import {SHEET_BG} from './CharacterSheet.tsx';

export const PROP_CELL = {w: 640, h: 720};

/** One GLB prop, up to four values of one joint side by side (e.g. a lid at 0, 40, 80, 110 degrees). Shows what the user is approving. */
export const PropSheet: React.FC<{src: string; joint: string; values: number[]; yaw: number; pitch: number; margin: number}> = ({src, joint, values, yaw, pitch, margin}) => (
  <AbsoluteFill style={{background: SHEET_BG}}>
    {values.map((v, k) => (
      <div key={k} style={{position: 'absolute', left: k * PROP_CELL.w, top: 0}}>
        <GlbProp src={src} joints={joint ? {[joint]: v} : {}} yaw={yaw} pitch={pitch} margin={margin} width={PROP_CELL.w} height={PROP_CELL.h} />
      </div>
    ))}
  </AbsoluteFill>
);
