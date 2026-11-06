import {Config} from '@remotion/cli/config';

// PNG frames keep text and cursor edges crisp.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
// WebGL (three.js) in headless Chrome. 'swangle' (software ANGLE) works on machines with no GPU and on
// Chrome 158+, where plain 'angle' failed with "Error creating WebGL context". On a machine with a GPU you
// can switch to 'angle' for speed, but run `npm run check:cursor` and look at a still first.
Config.setChromiumOpenGlRenderer('swangle');
