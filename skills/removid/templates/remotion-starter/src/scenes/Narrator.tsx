import React from 'react';
import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera} from '../components/Camera.tsx';
import {NarratorLayer, useEnvelope} from '../components/NarratorLayer.tsx';
import {Spotlight} from '../components/Spotlight.tsx';
import {camAt, toScreen, zoomProgress} from '../lib/camera.ts';
import {moodAt} from '../lib/emotion.ts';
import {envAt} from '../lib/envelope.ts';
import {rectStyle} from '../lib/geom.ts';
import {narratorPose, type Cue} from '../lib/pose.ts';
import {CAPTIONS, CARD, CHAR_BOX, CUES, MOODS, SHOTS} from './narrator.data.ts';

const INK = '#1F1E1D';
const CREAM = '#FAF9F5';
const CORAL = '#D97757';
const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';

export const Narrator: React.FC<{audio: string | null; envelope: string | null; debug: boolean; character: string}> = ({audio, envelope, character}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const env = useEnvelope(envelope);

  const cam = camAt(t, SHOTS, width, height);
  const strength = Math.max(...SHOTS.map((z) => zoomProgress(t, z)));

  // Cue targets are canvas points; the pointing arm follows them through the camera.
  const cues: Cue[] = CUES.map(({targetCanvas, ...c}) => ({...c, target: targetCanvas ? toScreen(cam, targetCanvas) : undefined}));
  const pose = narratorPose(t, envAt(env, frame, fps), cues, {x: width * 0.6, y: height * 0.45}, moodAt(t, MOODS));

  const caption = CAPTIONS.find((c) => t >= c.start && t < c.end);
  const capOpacity = caption ? Math.min(interpolate(t, [caption.start, caption.start + 0.15], [0, 1], {extrapolateRight: 'clamp'}), interpolate(t, [caption.end - 0.15, caption.end], [1, 0], {extrapolateLeft: 'clamp'})) : 0;

  return (
    <AbsoluteFill style={{background: CREAM, fontFamily: FONT, color: INK, overflow: 'hidden'}}>
      {audio && <Audio src={staticFile(audio)} />}
      <Camera cam={cam} width={width} height={height}>
        <div style={{...rectStyle(CARD), background: '#fff', borderRadius: 40, border: '3px solid #E8E4D8', padding: 56, boxSizing: 'border-box'}}>
          <div style={{fontSize: 36, color: '#5E5A50', fontWeight: 600}}>Viewers who stayed</div>
          <div style={{fontSize: 220, fontWeight: 800, color: CORAL, lineHeight: 1.05}}>98%</div>
          <div style={{fontSize: 40, lineHeight: 1.3}}>of the clip, with a calm, readable zoom on what matters.</div>
        </div>
      </Camera>
      <Spotlight rect={CARD} cam={cam} strength={strength} />
      <NarratorLayer pose={pose} box={CHAR_BOX} character={character} />
      {caption && (
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 70, display: 'flex', justifyContent: 'center', opacity: capOpacity}}>
          <div style={{background: 'rgba(31,30,29,0.88)', color: '#fff', fontSize: 46, fontWeight: 600, padding: '18px 40px', borderRadius: 22}}>{caption.text}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
