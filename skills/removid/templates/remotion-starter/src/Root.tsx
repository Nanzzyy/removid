import React from 'react';
import {Composition} from 'remotion';
import {z} from 'zod';
import {FPS, H, s, W} from './lib/time.ts';
import {Narrator} from './scenes/Narrator.tsx';
import {DURATION_SEC as NARRATOR_SEC} from './scenes/narrator.data.ts';
import {UiDemo} from './scenes/UiDemo.tsx';
import {DURATION_SEC as UIDEMO_SEC} from './scenes/uiDemo.data.ts';

const uiDemoSchema = z.object({debug: z.boolean()});
const narratorSchema = z.object({audio: z.string().nullable(), envelope: z.string().nullable(), debug: z.boolean()});

// fps is 60 on every composition. Durations are planned in seconds and converted with s().
export const Root: React.FC = () => (
  <>
    <Composition id="UiDemo" component={UiDemo} schema={uiDemoSchema} defaultProps={{debug: false}} durationInFrames={s(UIDEMO_SEC)} fps={FPS} width={W} height={H} />
    <Composition
      id="Narrator"
      component={Narrator}
      schema={narratorSchema}
      defaultProps={{audio: 'narration/sample.mp3', envelope: 'narration/sample.envelope.json', debug: false}}
      durationInFrames={s(NARRATOR_SEC)}
      fps={FPS}
      width={W}
      height={H}
    />
  </>
);
