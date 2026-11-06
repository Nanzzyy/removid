import React, {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {EMPTY_ENVELOPE, type Envelope} from '../lib/envelope.ts';
import type {Rect} from '../lib/geom.ts';
import type {Pose} from '../lib/pose.ts';
import {DEFAULT_CHARACTER, getCharacter} from '../characters/index.ts';
import {Character} from './Character.tsx';

/** Loads the lip-sync envelope made by scripts/make-envelope.mjs. A missing file means a silent (closed-mouth) character. */
export function useEnvelope(file: string | null): Envelope {
  const [env, setEnv] = useState<Envelope>(EMPTY_ENVELOPE);
  const [handle] = useState(() => delayRender('envelope'));
  useEffect(() => {
    if (!file) {
      continueRender(handle);
      return;
    }
    fetch(staticFile(file))
      .then((r) => (r.ok ? r.json() : EMPTY_ENVELOPE))
      .then((j: Envelope) => setEnv(j))
      .catch(() => setEnv(EMPTY_ENVELOPE))
      .finally(() => continueRender(handle));
  }, [file, handle]);
  return env;
}

/**
 * Ground glow + the character. Draw it OUTSIDE the Camera so zooms never scale or dim it. Give the envelope of the WHOLE video and
 * look it up with the global frame (`envAt(env, startFrame + frame, fps)`), so the mouth stays in sync in every clip.
 * `glow`: the ground shadow colour; a dark `rgba(31,30,29,0.22)` on a light background, a tinted glow on a dark one.
 */
export const NarratorLayer: React.FC<{pose: Pose; box: Rect; character?: string; groundY?: number; glow?: string}> = ({pose, box, character = DEFAULT_CHARACTER, groundY, glow = 'rgba(31,30,29,0.22)'}) => {
  const gy = groundY ?? getCharacter(character).groundY;
  return (
    <>
      <div style={{position: 'absolute', left: box.x + box.w / 2 - 160, top: gy - 28, width: 320, height: 56, borderRadius: '50%', background: `radial-gradient(closest-side, ${glow}, rgba(0,0,0,0))`}} />
      <div style={{position: 'absolute', left: box.x, top: box.y}}>
        <Character id={character} width={box.w} height={box.h} pose={pose} origin={{x: box.x, y: box.y}} />
      </div>
    </>
  );
};
