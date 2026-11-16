// Tests for skills/removid/scripts/clone-import.mjs. The three fixtures are real rea-video 0.1.0 output (offline run on a synthetic 9 s clip):
// English unreviewed, the same after an agent's `review` + `apply-review` (checked with the videomd package), and Chinese. Mutants of them must be rejected.
//   node --test tests/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PM = path.join(ROOT, 'skills/removid/scripts/project.mjs'), CI = path.join(ROOT, 'skills/removid/scripts/clone-import.mjs');
const FIX = (n) => path.join(ROOT, 'tests/fixtures', n);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'removid-clone-'));
process.on('exit', () => fs.rmSync(tmp, {recursive: true, force: true}));
const sh = (script, ...a) => { const r = spawnSync('node', [script, ...a], {encoding: 'utf8'}); return {code: r.status, out: (r.stdout || '') + (r.stderr || '')}; };
let n = 0;
function project() {
  const root = path.join(tmp, 'root' + n++);
  const r = sh(PM, 'new', 'Demo', 'clone-demo', '--root', root, '--brief', 'brief', '--style', 'flatlife', '--narration', 'no', '--character', 'none'); assert.equal(r.code, 0, r.out);
  return path.join(root, 'Demo', fs.readdirSync(path.join(root, 'Demo'))[0]);
}
/** A copy of a fixture package with edits: edit(file, from, to). */
function pkg(name, edits = []) {
  const d = path.join(tmp, 'pkg' + n++); fs.cpSync(FIX(name), d, {recursive: true});
  for (const [file, from, to] of edits) { const f = path.join(d, file); const t = fs.readFileSync(f, 'utf8'); assert.ok(t.includes(from), `fixture no longer contains: ${from}`); fs.writeFileSync(f, t.replace(from, to)); }
  return d;
}
const TL = 'video/timeline.md';
const analysis = (p, id) => fs.readFileSync(path.join(p, 'Reference', `${id}.analysis.md`), 'utf8');

test('an unreviewed package imports, says it is unreviewed, and fills the analysis sections and the references table', () => {
  const p = project(), r = sh(CI, FIX('rea-video-pkg'), '--project', p, '--note', 'user note');
  assert.equal(r.code, 0, r.out); assert.match(r.out, /3 shots, 9\.0 s/); assert.match(r.out, /WARNING: no image reader/);
  const a = analysis(p, 'ref');
  for (const h of ['## Hook (0–3 s)', '## Structure per scene', '## Transitions and sound', '## What we reuse', '## What we do NOT copy']) assert.ok(a.includes(h), h);
  assert.match(a, /NOT REVIEWED BY AN IMAGE READER/); assert.match(a, /\| 02 \| 3\.0–6\.0 s \|/); assert.match(a, /code \/ template render 86%/); assert.match(a, /Readers: tools; shots: 3; cuts: 2/);
  assert.match(a, /shots #01–#03 \(0\.0–9\.0 s\): drawn by code in the reference: rebuild as a Remotion scene/);
  const refs = fs.readFileSync(path.join(p, 'Reference/REFERENCES.md'), 'utf8'); assert.match(refs, /\| ref \| ref\.mp4 \| rea-video package \(rea-video-pkg\) \| user note \| ref\.analysis\.md \|/);
  const st = sh(PM, 'status', p); assert.doesNotMatch(st.out, /FOLDER INCOMPLETE/);
});
test('a reviewed package carries what each shot shows and no warning; the Chinese package reads through its labels', () => {
  const p = project(), r = sh(CI, FIX('rea-video-pkg-reviewed'), '--project', p, '--id', 'rev');
  assert.equal(r.code, 0, r.out); assert.doesNotMatch(r.out, /WARNING/); const a = analysis(p, 'rev');
  assert.doesNotMatch(a, /NOT REVIEWED/); assert.match(a, /Readers: tools, agent/); assert.match(a, /Mandelbrot fractal/); assert.match(a, /grab attention/);
  const z = project(), rz = sh(CI, FIX('rea-video-pkg-zh'), '--project', z); assert.equal(rz.code, 0, rz.out); const az = analysis(z, 'ref');
  assert.match(az, /Made-with \(inferred, by duration\): code \/ template render 100%/, 'the Chinese label 代码/模板渲染 maps to its id'); assert.match(az, /代码渲染 · 段1/); assert.match(az, /shots #01–#03 .*drawn by code/);
});
test('footage shots, flags, transitions and a tempo are carried; a | inside a value cannot split the table', () => {
  const lines = ['#01 0.0-2.0 | story grab attention, a hand opens a box | seen hand and box | camera handheld | made~ live action 92% · runner-up AI-generated video 5% | material~ shot by the creator | remake shoot it | flag low confidence',
    '#02 2.0-5.0 | transition fade through 0.4s | made~ code / template render 80% | remake code render · Part 1',
    '#03 5.0-8.0 | seen price|card | made~ code / template render 55% | material~ rendered | remake code render · Part 1 | flag to confirm'];
  const tl = fs.readFileSync(path.join(FIX('rea-video-pkg'), TL), 'utf8').replace(/```videomd-timeline\n[\s\S]*?\n```/, '```videomd-timeline\n' + lines.join('\n') + '\n```');
  const d = pkg('rea-video-pkg', [['VIDEO.md', 'duration: 9.0', 'duration: 8.0']]); fs.writeFileSync(path.join(d, TL), tl);
  fs.writeFileSync(path.join(d, 'video/sound.md'), '---\nvideomd: 1\npart: sound\n---\n\n## Sound\n\n**Music**\n\n- Library music, 124 BPM, 4/4\n');
  const p = project(), r = sh(CI, d, '--project', p, '--id', 'mix'); assert.equal(r.code, 0, r.out); assert.match(r.out, /2 shot\(s\) flagged/);
  const a = analysis(p, 'mix');
  assert.match(a, /shots #01 \(0\.0–2\.0 s\): live action: not authored in Remotion; needs the user's own clip/); assert.match(a, /shots #02–#03 \(2\.0–8\.0 s\): drawn by code/);
  assert.match(a, /about 124 BPM/); assert.match(a, /Duration \/ BPM: 8\.0 s.* \/ 124\n/); assert.match(a, /#02 fade through 0\.4s/); assert.match(a, /Needs a second look: #01 \(low confidence\), #03 \(to confirm\)/);
  assert.match(a, /live action 25%, code \/ template render 75%|code \/ template render 75%, live action 25%/);
  for (const row of a.split('\n').filter((l) => /^\| 0\d \|/.test(l))) assert.equal(row.split('|').length, 8, 'a table row has 6 cells: ' + row);
});
test('a broken or edited package is rejected with the reason, and nothing is written', () => {
  const cases = [
    ['the card and the timeline disagree on the shot count', pkg('rea-video-pkg', [['VIDEO.md', 'shots: 3', 'shots: 4']]), /card says 4 shots, the timeline has 3/],
    ['shots overlap', pkg('rea-video-pkg', [[TL, '#02 3.0-6.0', '#02 2.0-6.0']]), /starts at 2 s, before shot #1 ends/],
    ['a shot ends before it starts', pkg('rea-video-pkg', [[TL, '#02 3.0-6.0', '#02 3.0-3.0']]), /ends \(3\) before it starts/],
    ['shot numbers skip', pkg('rea-video-pkg', [[TL, '#03 6.0-9.0', '#04 6.0-9.0']]), /must run 1, 2, 3/],
    ['an unknown timeline key (a newer format)', pkg('rea-video-pkg', [[TL, '| remake code render · Part 1\n#02', '| mood happy | remake code render · Part 1\n#02']]), /unknown timeline key "mood"/],
    ['an unreadable line', pkg('rea-video-pkg', [[TL, '#02 3.0-6.0', 'shot two 3.0-6.0']]), /cannot read the timeline line/],
    ['the duration is far from the last shot', pkg('rea-video-pkg', [['VIDEO.md', 'duration: 9.0', 'duration: 30.0']]), /card says 30\.0 s, the last shot ends at 9 s/],
    ['not videomd format 1', pkg('rea-video-pkg', [['VIDEO.md', 'videomd: 1', 'videomd: 2']]), /not videomd format 1/],
    ['no timeline block', pkg('rea-video-pkg', [[TL, '```videomd-timeline', '```text']]), /no ```videomd-timeline block/],
  ];
  for (const [what, d, re] of cases) { const p = project(), r = sh(CI, d, '--project', p); assert.equal(r.code, 1, `${what}\n${r.out}`); assert.match(r.out, re, what); assert.deepEqual(fs.readdirSync(path.join(p, 'Reference')).filter((f) => f.endsWith('.analysis.md') && !f.startsWith('_')), [], `${what}: wrote a file anyway`); assert.doesNotMatch(fs.readFileSync(path.join(p, 'Reference/REFERENCES.md'), 'utf8'), /rea-video package/, what); }
  const gone = pkg('rea-video-pkg'); fs.rmSync(path.join(gone, TL)); const p = project(); const r = sh(CI, gone, '--project', p); assert.equal(r.code, 1); assert.match(r.out, /not a rea-video package: video\/timeline\.md is missing/);
});
test('usage errors, a non-project folder, and a second import of the same id', () => {
  const p = project();
  assert.equal(sh(CI).code, 2); assert.equal(sh(CI, FIX('rea-video-pkg')).code, 2); assert.equal(sh(CI, FIX('rea-video-pkg'), '--project', p, '--id', 'Bad Id').code, 2); assert.equal(sh(CI, FIX('rea-video-pkg'), '--project', p, '--nope').code, 2);
  const bare = path.join(tmp, 'plain'); fs.mkdirSync(bare); const np = sh(CI, FIX('rea-video-pkg'), '--project', bare); assert.equal(np.code, 1); assert.match(np.out, /not a removid project/);
  assert.equal(sh(CI, FIX('rea-video-pkg'), '--project', p).code, 0);
  const again = sh(CI, FIX('rea-video-pkg'), '--project', p); assert.equal(again.code, 1); assert.match(again.out, /already exists/);
  fs.writeFileSync(path.join(p, 'Reference/ref.analysis.md'), 'my own notes'); assert.equal(sh(CI, FIX('rea-video-pkg'), '--project', p).code, 1); assert.equal(fs.readFileSync(path.join(p, 'Reference/ref.analysis.md'), 'utf8'), 'my own notes');
  assert.equal(sh(CI, FIX('rea-video-pkg'), '--project', p, '--force').code, 0); const refs = fs.readFileSync(path.join(p, 'Reference/REFERENCES.md'), 'utf8'); assert.equal(refs.split('\n').filter((l) => l.startsWith('| ref |')).length, 1, 'a forced import must not duplicate the row');
});
