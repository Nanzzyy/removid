#!/usr/bin/env node
// Render a GLB prop (public/<file>.glb) at up to four values of one joint and verify the sheet.
//   node scripts/prop-sheet.mjs props/gift_box.glb                                  -> lists the joints, draws the prop at rest
//   node scripts/prop-sheet.mjs props/gift_box.glb --joint lid_hinge --values 0,55,110 [--yaw 30] [--pitch 18] [--margin 0.25]
// Joint values are degrees (revolute, continuous) or metres (prismatic), inside the range the file records. Fails when nothing is drawn, when the
// prop is clipped by its cell, or when a joint value changes nothing on screen (the joint is not wired, or the axis is wrong).
import {mkdirSync, readFileSync, existsSync} from 'node:fs';
import {basename, resolve} from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {PNG} from 'pngjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const src = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!src) { console.error('usage: prop-sheet.mjs <props/file.glb in public/> [--joint name --values a,b,c] [--yaw 30] [--pitch 18] [--margin 0.25]'); process.exit(2); }
const file = resolve('public', src);
if (!file.startsWith(resolve('public') + '/') || !existsSync(file)) { console.error(`public/${src} does not exist (copy the .glb into public/ first)`); process.exit(2); }

// the joints the file records (GLB: a 12-byte header, then a JSON chunk)
const buf = readFileSync(file);
if (buf.toString('ascii', 0, 4) !== 'glTF') { console.error(`${src} is not a binary glTF (.glb)`); process.exit(2); }
const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
const joints = (json.nodes || []).map((n) => n.extras?.s3d_joint).filter(Boolean);
const deg = (r) => (r * 180) / Math.PI;
const rangeOf = (j) => (j.type === 'prismatic' ? [j.lower ?? 0, j.upper ?? 0, 'm'] : j.type === 'continuous' ? [0, 360, '°'] : [deg(j.lower ?? 0), deg(j.upper ?? 0), '°']);
console.log(`${src}: ${joints.length ? joints.map((j) => { const [a, b, u] = rangeOf(j); return `${j.name} (${j.type} ${a.toFixed(2)}..${b.toFixed(2)}${u})`; }).join(', ') : 'no joints (a rigid prop)'}`);

const jointName = opt('--joint', '');
let values = [0];
if (jointName) {
  const j = joints.find((x) => x.name === jointName);
  if (!j) { console.error(`no joint "${jointName}" in ${src}`); process.exit(2); }
  const [lo, hi, unit] = rangeOf(j);
  values = (opt('--values', '') ? opt('--values', '').split(',').map(Number) : [lo, (lo + hi) / 2, hi]).slice(0, 4);
  if (values.some((v) => !Number.isFinite(v))) { console.error('--values must be numbers separated by commas'); process.exit(2); }
  if (j.type !== 'continuous') for (const v of values) if (v < lo - 1e-6 || v > hi + 1e-6) { console.error(`${v}${unit} is outside the range of ${jointName}: ${lo.toFixed(2)}..${hi.toFixed(2)}${unit}`); process.exit(2); }
} else if (opt('--values', '')) { console.error('--values needs --joint'); process.exit(2); }

const outDir = resolve('out/props');
mkdirSync(outDir, {recursive: true});
const chromiumOptions = {gl: process.env.REMOTION_GL ?? 'swangle'};
const serveUrl = await bundle({entryPoint: resolve('src/index.ts')});
const inputProps = {src, joint: jointName, values, yaw: Number(opt('--yaw', 30)), pitch: Number(opt('--pitch', 18)), margin: Number(opt('--margin', 0.25))};
const composition = await selectComposition({serveUrl, id: 'PropSheet', inputProps, chromiumOptions});
const out = `${outDir}/${basename(src, '.glb')}${jointName ? '-' + jointName : ''}.png`;
await renderStill({composition, serveUrl, output: out, frame: 0, inputProps, chromiumOptions, imageFormat: 'png'});

const png = PNG.sync.read(readFileSync(out));
const CELL = {w: 640, h: 720}, BG = [0x70, 0x7a, 0x82];
const drawn = (x, y) => { const i = (y * png.width + x) * 4; return Math.abs(png.data[i] - BG[0]) + Math.abs(png.data[i + 1] - BG[1]) + Math.abs(png.data[i + 2] - BG[2]) > 24; };
let fails = 0;
values.forEach((v, k) => {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < CELL.h; y++) for (let x = 0; x < CELL.w; x++) if (drawn(k * CELL.w + x, y)) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const tag = `  ${jointName ? `${jointName}=${Number(v.toFixed(3))}` : 'rest'}`.padEnd(26);
  if (!n) { fails++; console.log(`${tag} FAIL nothing drawn (WebGL context failed, or the file has no mesh)`); return; }
  const m = 4, clipped = x0 < m || y0 < m || x1 > CELL.w - 1 - m || y1 > CELL.h - 1 - m;
  const note = `x ${x0}..${x1}, y ${y0}..${y1}, ${n} px`;
  if (clipped) { fails++; console.log(`${tag} FAIL clipped by its cell: ${note} (raise --margin)`); } else console.log(`${tag} ok   ${note}`);
});
const MIN = 300; // pixels that must change between neighbouring joint values
for (let k = 1; k < values.length; k++) {
  let d = 0;
  for (let y = 0; y < CELL.h; y++) for (let x = 0; x < CELL.w; x++) {
    const a = ((y * png.width) + (k - 1) * CELL.w + x) * 4, b = ((y * png.width) + k * CELL.w + x) * 4;
    if (Math.abs(png.data[a] - png.data[b]) + Math.abs(png.data[a + 1] - png.data[b + 1]) + Math.abs(png.data[a + 2] - png.data[b + 2]) > 40) d++;
  }
  if (d < MIN) { fails++; console.log(`  ${jointName} ${values[k - 1]} -> ${values[k]}: FAIL only ${d} pixels changed (need ${MIN}): the joint is not wired, or its axis is wrong`); }
  else console.log(`  ${jointName} ${values[k - 1]} -> ${values[k]}: ok   ${d} pixels changed`);
}
console.log(fails ? `\n${fails} FAIL (sheet: ${out})` : `\nALL OK (sheet: ${out})`);
process.exit(fails ? 1 : 0);
