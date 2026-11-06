#!/usr/bin/env node
// Render stills at GLOBAL times (the storyboard's seconds), bundling once.
//   node scripts/stills.mjs <times> [--prefix Promo] [--debug] [--out out/stills]
//   node scripts/stills.mjs 0.5,2.9,4.5,9.7,13.5 --prefix Promo
// A time is mapped to the composition `<prefix><frame id>` whose frame range in src/plan.json contains it, then to a local
// frame via that composition's `startFrame` prop. Without --prefix, or without src/plan.json, a time is a frame of --id.
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const times = (args.find((a) => /^[\d.,]+$/.test(a)) ?? '').split(',').filter(Boolean).map(Number);
if (!times.length) {
  console.error('usage: stills.mjs <t1,t2,...> [--prefix Promo | --id CompId] [--debug] [--out out/stills]');
  process.exit(2);
}
const prefix = opt('--prefix', null), fixedId = opt('--id', null);
const outDir = resolve(opt('--out', 'out/stills'));
mkdirSync(outDir, {recursive: true});
const plan = existsSync('src/plan.json') ? JSON.parse(readFileSync('src/plan.json', 'utf8')) : null;
if (!fixedId && !(prefix && plan?.frames?.length)) {
  console.error('need --id <Composition>, or --prefix <name> together with src/plan.json (project.mjs scaffold writes it)');
  process.exit(2);
}
const chromiumOptions = {gl: process.env.REMOTION_GL ?? 'swangle'};
const serveUrl = await bundle({entryPoint: resolve('src/index.ts')});
const inputProps = args.includes('--debug') ? {debug: true} : {};
for (const t of times) {
  const gframe = Math.round(t * 60);
  const f = fixedId ? null : plan.frames.find((x) => gframe >= x.startFrame && gframe < x.endFrame) ?? plan.frames.at(-1);
  const id = fixedId ?? `${prefix}${f.id}`;
  const comp = await selectComposition({serveUrl, id, inputProps, chromiumOptions});
  const start = Number(comp.props?.startFrame ?? 0);
  const frame = Math.min(comp.durationInFrames - 1, Math.max(0, gframe - start));
  const file = `${outDir}/${id}-t${t.toFixed(2)}.png`;
  await renderStill({composition: comp, serveUrl, output: file, frame, inputProps, chromiumOptions, imageFormat: 'png'});
  console.log(`${t.toFixed(2)} s -> ${id} frame ${frame} (global ${gframe}): ${file}`);
}
