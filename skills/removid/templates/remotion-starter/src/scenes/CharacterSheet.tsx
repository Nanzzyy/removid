import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Character} from '../components/Character.tsx';
import {narratorPose, type Cue} from '../lib/pose.ts';

export const SHEET_CELL = {w: 900, h: 1080};
export const SHEET_BG = '#707a82'; // mid grey: dark shoes and white shirts both stand out from it

/** Three poses side by side: resting and speaking, waving, pointing right. Shows what the user is approving. */
export const CharacterSheet: React.FC<{id: string}> = ({id}) => {
  const cell = (k: number, cues: Cue[], talk: number, t = 1.5) => {
    const origin = {x: k * SHEET_CELL.w, y: 0};
    const pose = {...narratorPose(t, talk, cues, null), blink: 0};
    return (
      <div key={k} style={{position: 'absolute', left: origin.x, top: 0}}>
        <Character id={id} width={SHEET_CELL.w} height={SHEET_CELL.h} pose={pose} origin={origin} />
      </div>
    );
  };
  return (
    <AbsoluteFill style={{background: SHEET_BG}}>
      {cell(0, [], 0.75)}
      {cell(1, [{kind: 'wave', side: 'R', start: 0, dur: 3}], 0)}
      {cell(2, [{kind: 'point', side: 'R', start: 0, dur: 3, target: {x: 2 * SHEET_CELL.w + 840, y: 420}}], 0.3)}
    </AbsoluteFill>
  );
};
