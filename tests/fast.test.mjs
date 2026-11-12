import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadStyles, contrast} from '../skills/removid/scripts/lib-style.mjs';
import {fixture as createFixture, approve} from './helpers/fast-fixture.mjs';
import {pick, recipes} from '../skills/removid/fast/scripts/pick.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const kit = path.join(root, 'skills/removid/fast'), pm = path.join(root, 'skills/removid/scripts/project.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'removid-fast-test-'));
process.on('exit', () => fs.rmSync(tmp, {recursive: true, force: true}));
function run(cmd, ...args) {
  const r = spawnSync(cmd, args, {encoding: 'utf8'});
  return {code: r.status, out: (r.stdout || '') + (r.stderr || '')};
}
const projectRun = (...a) => run(process.execPath, pm, ...a);
const ok = (r) => assert.equal(r.code, 0, r.out);
let n = 0;
const fixture = () => createFixture(path.join(tmp, `path with space ${n++}`));
// This fixture is also used by the full render smoke test (all files live in /tmp).
function changeDirection(p, mutate) {
  const file = path.join(p, 'Storyboard/direction.json'), d = JSON.parse(fs.readFileSync(file));
  mutate(d); fs.writeFileSync(file, JSON.stringify(d));
}

test('all 36 recipes use the canonical tokens and readable secondary text', () => {
  const styles = Object.values(loadStyles().styles);
  assert.equal(styles.length, 36);
  assert.deepEqual(Object.keys(recipes).sort(), styles.map((s) => s.id).sort());
  const preset = (s) => fs.readFileSync(path.join(kit, s), 'utf8');
  const motion = preset('kit/motion.tsx'), audio = preset('scripts/cues.mjs');
  for (const s of styles) {
    const r = pick('promo tanpa narasi', {style: s.id});
    assert.equal(r.style, s.name);
    assert.equal(r.tokens.transition, s.transition.kind);
    assert.deepEqual(r.tokens.ease, s.ease);
    assert.ok(contrast(r.palette.sub, r.palette.bg) >= 4.5, s.id);
    assert.ok(contrast(r.palette.hero, r.palette.bg) >= 3, s.id);
    assert.ok(motion.includes(`'${r.recipe.text}'`));
    assert.ok(motion.includes(`'${r.recipe.bg}'`));
    assert.ok(motion.includes(`${r.recipe.cam}:`));
    assert.ok(audio.includes(`${r.recipe.sfx}:`));
    assert.ok(audio.includes(`${r.recipe.music}:`));
    assert.ok(/^[a-z0-9-]+@[1-9]00$/.test(r.font.head));
  }
});
test('routing honors aliases, keeps ordinary words from forcing a style, and requires a no-narration intake', () => {
  assert.equal(pick('promo payment system tanpa narasi').style, 'FLATLIFE');
  assert.equal(pick('promo pakai style SYSTEM tanpa narasi').style, 'SYSTEM');
  assert.equal(pick('promo gaya tanah liat tanpa narasi').style, 'CLAY-3D');
  assert.equal(pick('promo aplikasi digital').fast.eligible, false);
  assert.equal(pick('promo aplikasi tanpa narasi').fast.eligible, true);
  assert.equal(pick('edit footage saya tanpa narasi', {style: 'flatlife'}).fast.eligible, false);
  assert.equal(pick('video tanpa narasi 46 detik').fast.eligible, false);
  assert.equal(pick('video tanpa narasi 0.5 menit').spec.dur, 30);
  const r = run(process.execPath, path.join(kit, 'scripts/pick.mjs'), 'promo', '--style', 'unknown');
  assert.notEqual(r.code, 0); assert.match(r.out, /unknown style/);
});
test('setup and compiler enforce the storyboard gate, exact frames and stale direction', () => {
  const p = fixture();
  const setup = () => run('bash', path.join(kit, 'setup.sh'), p, '--no-install');
  assert.notEqual(setup().code, 0, 'unapproved storyboard');
  assert.equal(fs.readdirSync(path.join(p, 'Source/remotion')).length, 0);
  approve(p); ok(setup());
  const cues = JSON.parse(fs.readFileSync(path.join(p, 'Source/remotion/src/cues.json')));
  assert.equal(cues.dur, 8); assert.deepEqual(cues.scenes.map((s) => [s.start, s.end]), [[0, 4], [4, 8]]);
  fs.appendFileSync(path.join(p, 'Source/remotion/src/Scenes.tsx'), '\n// preserved edit\n');
  ok(setup()); assert.match(fs.readFileSync(path.join(p, 'Source/remotion/src/Scenes.tsx'), 'utf8'), /preserved edit/);
  changeDirection(p, (d) => { d.scenes[0].text = 'Changed'; });
  assert.notEqual(setup().code, 0);
  assert.match(projectRun('gate', 'build', p).out, /STALE/);
  approve(p);
  const r = setup(); assert.notEqual(r.code, 0); assert.match(r.out, /matching storyboard text window/);
});
test('bad timing, ids, unknown scenes and events fail even after approval', () => {
  for (const [mutate, pattern] of [
    [(d) => { d.scenes[0].beats = 7; }, /timing comes/],
    [(d) => { d.scenes[0].id = 'cta'; }, /duplicate id/],
    [(d) => { d.scenes[0].type = 'missing'; }, /unknown scene type/],
    [(d) => { d.scenes[0].frame = 2; }, /frame must/],
    [(d) => { d.scenes[0].type = 'custom'; d.scenes[0].hits = [{at: 4, kind: 'hit'}]; }, /hit outside/],
    [(d) => { d.scenes[0].type = 'custom'; d.scenes[0].hits = [{at: 1, kind: 'bad'}]; }, /unknown hit kind/],
    [(d) => { d.bpm = -2; }, /bpm/],
  ]) {
    const p = fixture(); changeDirection(p, mutate); approve(p);
    const r = run(process.execPath, path.join(kit, 'scripts/cues.mjs'), p);
    assert.notEqual(r.code, 0, r.out); assert.match(r.out, pattern);
  }
});
test('revised direction invalidates approved samples and finals, and stale audio is blocked', () => {
  const p = fixture(); approve(p);
  ok(run('bash', path.join(kit, 'setup.sh'), p, '--no-install'));
  for (const folder of ['sample', 'v1']) {
    fs.mkdirSync(path.join(p, 'Result', folder), {recursive: true});
    fs.writeFileSync(path.join(p, 'Result', folder, 'fixture.mp4'), 'synthetic gate fixture');
  }
  ok(projectRun('approve', 'sample', p, '--evidence', 'test sample approval'));
  ok(projectRun('approve', 'final', p, '--evidence', 'test final approval'));
  // The final must be a real video with sound: a text file is unreadable and a video without audio is a defect.
  const unreadable = projectRun('gate', 'deliver', p);
  assert.notEqual(unreadable.code, 0); assert.match(unreadable.out, /could not be probed for audio/);
  const final = path.join(p, 'Result/v1/fixture.mp4');
  const video = ['-f', 'lavfi', '-i', 'nullsrc=s=160x90:r=30:d=1'], sine = ['-f', 'lavfi', '-i', 'sine=frequency=440:d=1'], enc = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'];
  const make = (...a) => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a, final]).status === 0;
  if (make(...video, ...enc)) {
    const silent = projectRun('gate', 'deliver', p);
    assert.notEqual(silent.code, 0); assert.match(silent.out, /has no audio stream/);
    assert.ok(make(...video, ...sine, ...enc, '-c:a', 'aac', '-shortest'));
    ok(projectRun('gate', 'deliver', p));
  }
  changeDirection(p, (d) => { d.title = 'Revised'; });
  for (const gate of ['build', 'sample', 'full', 'deliver']) {
    const r = projectRun('gate', gate, p);
    assert.notEqual(r.code, 0); assert.match(r.out, /STALE/);
  }
  approve(p);
  const r = run(process.execPath, path.join(kit, 'scripts/project.mjs'), p);
  assert.notEqual(r.code, 0); assert.match(r.out, /cues are stale/);
});
test('actual animation entry and reading time must fit before transition exit', () => {
  const p = fixture();
  changeDirection(p, (d) => { d.scenes[0] = {id: 'hook', frame: 1, type: 'stat', value: 87, suffix: '%', label: 'Pesan utama'}; });
  fs.appendFileSync(path.join(p, 'Storyboard/CLAIMS.md'), '\n| 87% | owner-confirmed | synthetic test data |\n');
  const sb = path.join(p, 'Storyboard/STORYBOARD.md');
  fs.writeFileSync(sb, fs.readFileSync(sb, 'utf8').replace('- text: 0.8–3.6 "Pesan utama"', '- text: 0.8–3.6 "Pesan utama"\n- text: 0.8–3.6 "87%"'));
  approve(p);
  const r = run(process.execPath, path.join(kit, 'scripts/cues.mjs'), p);
  assert.notEqual(r.code, 0); assert.match(r.out, /cannot finish entering and hold/);
});
test('loudness check rejects missing, silent, quiet, loud and clipped summaries', () => {
  const meter = path.join(kit, 'scripts/loudness.mjs');
  for (const [i, peak, pass] of [[-14, -1.7, true], [-16, -1.7, false], [-12, -1.7, false], [-14, -.2, false], ['-inf', '-inf', false]]) {
    const r = spawnSync(process.execPath, [meter], {encoding: 'utf8', input: `Summary:\n I: ${i} LUFS\n Peak: ${peak} dBFS\n`});
    assert.equal(r.status === 0, pass, r.stdout + r.stderr);
  }
  assert.notEqual(spawnSync(process.execPath, [meter], {input: 'filter unavailable'}).status, 0);
});
