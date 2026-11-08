#!/usr/bin/env node
// Render the character sheet (rest + speaking, wave, point) of one or all characters and verify it.
//   node scripts/character-sheet.mjs ayu            -> out/characters/ayu.png
//   node scripts/character-sheet.mjs --all
//   node scripts/character-sheet.mjs ayu --emotions   -> out/characters/ayu-emotions.png: all emotions of the table on this character (and a check that the faces differ)
// Shows the user what they are approving, and fails when a character is clipped by its canvas, too small or too large.
// Prints where the head and feet land (canvas px), which is what `groundY` in src/characters/index.ts must match.
import {mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {PNG} from 'pngjs';

const args = process.argv.slice(2);
const {CHARACTERS} = await import(new URL('../src/characters/index.ts', import.meta.url).href);
const emotions = args.includes('--emotions');
const ids = args.includes('--all') ? Object.keys(CHARACTERS) : args.filter((a) => !a.startsWith('--'));
if (!ids.length) { console.error(`usage: character-sheet.mjs <id>|--all   (registered: ${Object.keys(CHARACTERS).join(', ')})`); process.exit(2); }
for (const id of ids) if (!CHARACTERS[id]) { console.error(`unknown character "${id}". Registered: ${Object.keys(CHARACTERS).join(', ')}`); process.exit(2); }

const outDir = resolve('out/characters');
mkdirSync(outDir, {recursive: true});
const chromiumOptions = {gl: process.env.REMOTION_GL ?? 'swangle'};
const serveUrl = await bundle({entryPoint: resolve('src/index.ts')});
const CELL = {w: 900, h: 1080}, BG = [0x70, 0x7a, 0x82];
let fails = 0;
if (emotions) {
  const {EMOTION_TABLE} = await import(new URL('../src/emotions.ts', import.meta.url).href);
  const tags = Object.keys(EMOTION_TABLE); const COLS = 6, EW = 500, EH = 560;
  let bad = 0;
  for (const id of ids) {
    const inputProps = {id};
    const composition = await selectComposition({serveUrl, id: 'EmotionSheet', inputProps, chromiumOptions});
    const file = `${outDir}/${id}-emotions.png`;
    await renderStill({composition, serveUrl, output: file, frame: 0, inputProps, chromiumOptions, imageFormat: 'png'});
    const png = PNG.sync.read(readFileSync(file));
    const cell = (k) => { const cx = (k % COLS) * EW, cy = Math.floor(k / COLS) * EH; const px = []; for (let y = 0; y < EH - 70; y++) for (let x = 0; x < EW; x++) { const i = ((cy + y) * png.width + cx + x) * 4; px.push(png.data[i], png.data[i + 1], png.data[i + 2]); } return px; };
    const cells = tags.map((_, k) => cell(k));
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) n++; return n; };
    const drawn = (c) => { let n = 0; for (let i = 0; i < c.length; i += 3) if (Math.abs(c[i] - BG[0]) + Math.abs(c[i + 1] - BG[1]) + Math.abs(c[i + 2] - BG[2]) > 24) n++; return n; };
    console.log(`${id}: ${CHARACTERS[id].about}`);
    tags.forEach((t, k) => { if (drawn(cells[k]) < 5000) { bad++; console.log(`  ${t.padEnd(10)} FAIL nothing drawn in its cell`); } });
    // the faces must read differently: compare each emotion with neutral and require a visible difference (pixels that changed)
    const base = tags.indexOf('neutral'); const MIN = 400; const rows = [];
    tags.forEach((t, k) => { if (k === base) return; const d = diff(cells[base], cells[k]); rows.push(`${t} ${d}`); if (d < MIN) { bad++; console.log(`  ${t.padEnd(10)} FAIL looks the same as neutral (${d} pixels differ, need ${MIN})`); } });
    console.log(`  pixels that differ from neutral: ${rows.join(', ')}`);
  }
  console.log(bad ? `\n${bad} FAIL (sheets in ${outDir})` : `\nALL OK (sheets in ${outDir})`);
  process.exit(bad ? 1 : 0);
}
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
