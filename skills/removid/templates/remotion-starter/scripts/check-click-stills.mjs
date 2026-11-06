#!/usr/bin/env node
// Pixel proof that the cursor lands on what it points at.
//   node scripts/check-click-stills.mjs UiDemo
//   node scripts/check-click-stills.mjs Promo3 src/scenes/promo.data.ts   (any scene whose data module exports T, CURSOR, SHOTS;
//   a clip with a `startFrame` prop is handled: the times in the data are global)
// For every click it renders the composition with debug=true at the arrival and click frames, then reads the PNG:
//   magenta crosshair = cursor tip      lime outline = the VISIBLE element's own box (drawn by TargetBox)
// PASS needs: (1) the tip within 3 px of the planned aim point, (2) the tip inside the visible element's box,
// (3) that box where the target table says it is. (1) matters: on a wide button, "inside" alone lets a 90 px miss pass.
// Exit 1 on any miss.
import {mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {PNG} from 'pngjs';
import {camAt, rectToScreen, toScreen} from '../src/lib/camera.ts';
import {planCursor} from '../src/lib/cursor.ts';
import {FPS, H, W} from '../src/lib/time.ts';

const SCENES = {
  UiDemo: 'src/scenes/uiDemo.data.ts',
};

// <Composition> [data module]. The module must export T (target rects), CURSOR (plan) and SHOTS (zoom shots).
const id = process.argv[2] ?? 'UiDemo';
const modulePath = process.argv[3] ?? SCENES[id];
if (!modulePath) {
  console.error(`no data module for "${id}". Usage: check-click-stills.mjs <Composition> <src/scenes/x.data.ts>  (built in: ${Object.keys(SCENES).join(', ')})`);
  process.exit(2);
}
const d = await import(pathToFileURL(resolve(modulePath)).href);
if (!d.T || !d.CURSOR || !d.SHOTS) {
  console.error(`${modulePath} must export T, CURSOR and SHOTS`);
  process.exit(2);
}
const {T: targets, CURSOR: plan, SHOTS: shots} = d;
const {legs} = planCursor(plan, targets);
const outDir = resolve('out/click-check');
mkdirSync(outDir, {recursive: true});

const chromiumOptions = {gl: process.env.REMOTION_GL ?? 'swangle'};
console.log('bundling...');
const serveUrl = await bundle({entryPoint: resolve('src/index.ts')});
const inputProps = {debug: true};
const composition = await selectComposition({serveUrl, id, inputProps, chromiumOptions});
if (composition.fps !== 60) console.log(`  WARN  composition fps is ${composition.fps}, expected 60`);
// A clip rendered from the middle of the video has its own frame 0: global time = (startFrame + frame) / fps.
const startFrame = Number(composition.props?.startFrame ?? 0);

const near = (px, c, t) => Math.abs(px - c) <= t;
function scan(png, rect, pad) {
  // magenta crosshair pixels (global) and lime outline pixels inside the expanded expected rect
  let mx = 0, my = 0, mn = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, ln = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (r > 235 && g < 40 && b > 235) { mx += x; my += y; mn++; }
      else if (r < 40 && g > 235 && b < 40 && x > rect.x - pad && x < rect.x + rect.w + pad && y > rect.y - pad && y < rect.y + rect.h + pad) {
        ln++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
  }
  return {tip: mn ? {x: mx / mn, y: my / mn} : null, tipPx: mn, box: ln ? {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1} : null};
}

let fails = 0;
for (const leg of legs) {
  const moments = [['arrival', leg.arrive], ...(leg.clickAt === undefined ? [] : [['click', leg.clickAt]])];
  for (const [label, t] of moments) {
    const gframe = Math.round(t * FPS);
    const frame = gframe - startFrame;
    if (frame < 0 || frame >= composition.durationInFrames) { fails++; console.log(`  FAIL  "${leg.target}" ${label}: time ${t} s is outside this composition (frames ${startFrame}..${startFrame + composition.durationInFrames - 1})`); continue; }
    const file = `${outDir}/${id}-${leg.target}-${label}.png`;
    await renderStill({composition, serveUrl, output: file, frame, inputProps, chromiumOptions, imageFormat: 'png'});
    const png = PNG.sync.read(readFileSync(file));
    const cam = camAt(gframe / FPS, shots, W, H);
    const expect = rectToScreen(cam, targets[leg.target]);
    // Search only just outside the expected box, so a neighbouring element 40 px away is not read as part of this one.
    const tolPx = 0.06 * Math.max(expect.w, expect.h) / 2 + 4;
    const {tip, tipPx, box} = scan(png, expect, tolPx + 8);
    const tag = `"${leg.target}" ${label} (frame ${gframe})`;
    if (!tip || tipPx < 30) { fails++; console.log(`  FAIL  ${tag}: cursor crosshair not found in the still`); continue; }
    if (!box) { fails++; console.log(`  FAIL  ${tag}: the visible element's outline was not found near the expected rect`); continue; }
    const inside = tip.x >= box.x && tip.x <= box.x + box.w && tip.y >= box.y && tip.y <= box.y + box.h;
    const tol = tolPx; // click press scales the element to 0.95
    const aligned = near(box.x, expect.x, tol) && near(box.y, expect.y, tol) && near(box.x + box.w, expect.x + expect.w, tol) && near(box.y + box.h, expect.y + expect.h, tol);
    const aim = toScreen(cam, leg.to);
    const aimErr = Math.hypot(tip.x - aim.x, tip.y - aim.y);
    const off = `${aimErr.toFixed(1)}px from the aim point`;
    if (aimErr > 3) { fails++; console.log(`  FAIL  ${tag}: tip is ${off} (limit 3)`); }
    else if (!inside) { fails++; console.log(`  FAIL  ${tag}: tip is OUTSIDE the element (${off})`); }
    else if (!aligned) { fails++; console.log(`  FAIL  ${tag}: element box does not match the target table`); }
    else console.log(`  ok    ${tag}: tip inside the element (${off})`);
  }
}
console.log(fails ? `\n${fails} FAIL (stills in ${outDir})` : `\nALL OK (stills in ${outDir})`);
process.exit(fails ? 1 : 0);
