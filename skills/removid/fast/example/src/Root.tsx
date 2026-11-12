import React from 'react';
import {Composition} from 'remotion';
import {Main, Clip} from './Scenes';
import {Presets} from './Presets';
import cues from './cues.json';
import style from './style.json';
const [width, height] = style.spec.size.split('x').map(Number);
const config = {durationInFrames: Math.round(cues.dur * 60), fps: 60, width, height};
export const Root: React.FC = () => <>
  <Composition id="Main60" component={Main} {...config} />
  {cues.scenes.map((s, scene) => <Composition key={s.id} id={`Scene${scene + 1}`} component={Clip} defaultProps={{scene}} {...config} />)}
  <Composition id="Presets" component={Presets} {...config} />
</>;
