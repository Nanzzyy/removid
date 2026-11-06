#!/usr/bin/env node
// Render the character sheet (rest + speaking, wave, point) of one or all characters and verify it.
//   node scripts/character-sheet.mjs ayu            -> out/characters/ayu.png
//   node scripts/character-sheet.mjs --all
// Shows the user what they are approving, and fails when a character is clipped by its canvas, too small or too large.
// Prints where the head and feet land (canvas px), which is what `groundY` in src/characters/index.ts must match.
import {mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {PNG} from 'pngjs';

const args = process.argv.slice(2);
const {CHARACTERS} = await import(new URL('../src/characters/index.ts', import.meta.url).href);
const ids = args.includes('--all') ? Object.keys(CHARACTERS) : args.filter((a) => !a.startsWith('--'));
if (!ids.length) { console.error(`usage: character-sheet.mjs <id>|--all   (registered: ${Object.keys(CHARACTERS).join(', ')})`); process.exit(2); }
for (const id of ids) if (!CHARACTERS[id]) { console.error(`unknown character "${id}". Registered: ${Object.keys(CHARACTERS).join(', ')}`); process.exit(2); }

const outDir = resolve('out/characters');
mkdirSync(outDir, {recursive: true});
const chromiumOptions = {gl: process.env.REMOTION_GL ?? 'swangle'};
const serveUrl = await bundle({entryPoint: resolve('src/index.ts')});
const CELL = {w: 900, h: 1080}, BG = [0x70, 0x7a, 0x82];
let fails = 0;
for (const id of ids) {
  const inputProps = {id};
  const composition = await selectComposition({serveUrl, id: 'CharacterSheet', inputProps, chromiumOptions});
  const file = `${outDir}/${id}.png`;
  await renderStill({composition, serveUrl, output: file, frame: 0, inputProps, chromiumOptions, imageFormat: 'png'});
  const png = PNG.sync.read(readFileSync(file));
  console.log(`${id}: ${CHARACTERS[id].about}`);
  ['rest+speaking', 'wave', 'point'].forEach((name, k) => {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < CELL.h; y++) for (let x = 0; x < CELL.w; x++) {
      const i = (y * png.width + k * CELL.w + x) * 4;
      if (Math.abs(png.data[i] - BG[0]) + Math.abs(png.data[i + 1] - BG[1]) + Math.abs(png.data[i + 2] - BG[2]) > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const tag = `  ${name.padEnd(14)}`;
    if (x1 < 0) { fails++; console.log(`${tag} FAIL nothing drawn (WebGL context failed?)`); return; }
    const m = 4, hFrac = (y1 - y0) / CELL.h;
    const clipped = x0 < m || y0 < m || x1 > CELL.w - 1 - m || y1 > CELL.h - 1 - m;
    const note = `x ${x0}..${x1}, y ${y0}..${y1} (head top ${y0}, feet ${y1}), ${(hFrac * 100).toFixed(0)}% of the height`;
    if (clipped) { fails++; console.log(`${tag} FAIL clipped by its canvas: ${note}`); }
    else if (hFrac < 0.45 || hFrac > 0.92) { fails++; console.log(`${tag} FAIL size: ${note}`); }
    else console.log(`${tag} ok   ${note}`);
  });
}
console.log(fails ? `\n${fails} FAIL (sheets in ${outDir})` : `\nALL OK (sheets in ${outDir})`);
process.exit(fails ? 1 : 0);
