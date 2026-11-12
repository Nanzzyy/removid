import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const pm = fileURLToPath(new URL('../../skills/removid/scripts/project.mjs', import.meta.url));
const projectRun = (...args) => {
  const r = spawnSync(process.execPath, [pm, ...args], {encoding: 'utf8'});
  return {code: r.status, out: (r.stdout || '') + (r.stderr || '')};
};
const ok = (r) => assert.equal(r.code, 0, r.out);
// Synthetic projects; approval evidence is never used for a user's video.
export function fixture(base, allScenes = false) {
  const hook = {id: 'hook', type: 'hook', text: 'Pesan utama'};
  const cta = {id: 'cta', type: 'cta', text: 'Mulai sekarang', sub: 'Lihat panduan'};
  const scenes = (allScenes ? [hook,
    {id: 'stat', type: 'stat', value: 87, suffix: '%', label: 'Data contoh'},
    {id: 'list', type: 'list', title: 'Langkah mudah', items: ['Buka', 'Baca', 'Mulai']},
    {id: 'statement', type: 'statement', text: 'Panduan yang jelas', sub: 'Langkah pertama'}, cta] : [hook, cta]).map((s, i) => ({...s, frame: i + 1}));
  let duration = 0;
  const ranges = scenes.map((_, i) => { const start = duration; duration += allScenes ? (i === 0 ? 3 : 5) : 4; return {start, end: duration}; });
  ok(projectRun('new', 'Kit', 'smoke', '--root', base, '--narration', 'no', '--format', 'portrait', '--duration', String(duration), '--style', 'flatlife', '--brief', 'promo panduan tanpa narasi'));
  const parent = path.join(base, 'Kit'), p = path.join(parent, fs.readdirSync(parent)[0]);
  const head = `---\ntitle: smoke\nduration: ${duration}\n---\n`;
  fs.writeFileSync(path.join(p, 'Storyboard/STRUCTURE.md'), head + scenes.map((s, i) => `
## Beat ${i + 1} — ${s.id}
- time: ${ranges[i].start}–${ranges[i].end}
- purpose: ${i === 0 ? 'hook' : i === scenes.length - 1 ? 'cta' : 'demo'}
- shows: A headline and shapes explain the guide
- source: remotion
- info: Open the guide and start now
- emotion: curious
`).join(''));
  fs.writeFileSync(path.join(p, 'Storyboard/STORYBOARD.md'), `---
title: smoke
size: 1080x1920
fps: 60
duration: ${duration}
message: A clear guide to getting started
arc: hook, CTA
---
` + scenes.map((s, i) => `
## Frame ${i + 1} — ${s.id}
- time: ${ranges[i].start}–${ranges[i].end}
- scene: A headline and shapes explain the guide
- engine: remotion
- asset: kit shapes only
- vo: none
${[s.text, s.sub, s.title, s.label, ...(s.items ?? []), ...(s.type === 'stat' ? [`${s.value}${s.suffix}`] : [])].filter(Boolean).map((text) => `- text: ${ranges[i].start + .8}–${ranges[i].end - .4} "${text}"`).join('\n')}
- reads: Open the guide and start now
`).join(''));
  if (allScenes) fs.appendFileSync(path.join(p, 'Storyboard/CLAIMS.md'), '\n| 87% | owner-confirmed | synthetic test data |\n');
  fs.writeFileSync(path.join(p, 'Storyboard/direction.json'), JSON.stringify({title: 'Smoke', scenes}, null, 2));
  return p;
}
export function approve(p) {
  ok(projectRun('check', 'storyboard', p));
  ok(projectRun('submit', 'storyboard', p));
  ok(projectRun('approve', 'storyboard', p, '--evidence', 'test fixture approval'));
}
