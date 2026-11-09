// Tests for skills/removid/scripts/project.mjs. Every check must be able to FAIL: mutants of the good fixture must be rejected.
//   node --test tests/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PM = path.join(ROOT, 'skills/removid/scripts/project.mjs');
const FIX = path.join(ROOT, 'tests/fixtures/prvtech-30s');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'removid-test-'));
process.on('exit', () => fs.rmSync(tmp, {recursive: true, force: true}));

const run = (...args) => { const r = spawnSync('node', [PM, ...args], {encoding: 'utf8'}); return {code: r.status, out: (r.stdout || '') + (r.stderr || '')}; };
let n = 0;
function project(opts = {}) {
  const root = path.join(tmp, 'root' + n++);
  const a = ['new', 'PrvTech', 'promo-umkm', '--root', root, '--format', 'landscape', '--duration', '30', '--narration', opts.narration || 'yes', '--voice', 'cowok', '--character', opts.character || (opts.narration === 'no' ? 'none' : 'ayu'), '--style', opts.style || 'flatlife', '--brief', 'brief in the user words'];
  if (opts.type) a.push('--type', opts.type);
  const r = run(...a); assert.equal(r.code, 0, r.out);
  const dir = path.join(root, 'PrvTech', fs.readdirSync(path.join(root, 'PrvTech'))[0]);
  if (!opts.empty) { fs.copyFileSync(path.join(FIX, 'STRUCTURE.md'), path.join(dir, 'Storyboard/STRUCTURE.md')); fs.copyFileSync(path.join(FIX, 'SCRIPT.md'), path.join(dir, 'Storyboard/SCRIPT.md')); fs.copyFileSync(path.join(FIX, 'STORYBOARD.md'), path.join(dir, 'Storyboard/STORYBOARD.md')); }
  return dir;
}
const edit = (file, from, to) => { const t = fs.readFileSync(file, 'utf8'); assert.ok(t.includes(from), `fixture no longer contains: ${from}`); fs.writeFileSync(file, t.replace(from, to)); };
const SB = (d) => path.join(d, 'Storyboard/STORYBOARD.md'), SC = (d) => path.join(d, 'Storyboard/SCRIPT.md');
const FFMPEG = process.env.REMOVID_FFMPEG || process.env.HYPERFRAMES_FFMPEG_PATH || 'ffmpeg';
const hasFfmpeg = spawnSync(FFMPEG, ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const filters = (spawnSync(FFMPEG, ['-hide_banner', '-filters'], {encoding: 'utf8'}).stdout || '');
const fullFfmpeg = hasFfmpeg && ['aevalsrc', 'anoisesrc', 'afade', 'highpass', 'lowpass'].every((n) => new RegExp(` ${n} `).test(filters));

test('folder schema is created as designed', () => {
  const d = project({empty: true, type: 'footage'});
  for (const p of ['PROJECT.md', 'Reference/REFERENCES.md', 'Reference/_TEMPLATE.analysis.md', 'Raw-Footage/SOURCES.md', 'Storyboard/SCRIPT.md', 'Storyboard/STORYBOARD.md', 'Asset/ASSETS.md', 'Asset/owner', 'Asset/agen', 'Asset/scenes', 'Source/remotion', 'Source/hyperframes', 'Result'])
    assert.ok(fs.existsSync(path.join(d, p)), 'missing ' + p);
  const t = fs.readFileSync(path.join(d, 'PROJECT.md'), 'utf8');
  assert.match(t, /> brief in the user words/); assert.match(t, /fps: 60/); assert.match(t, /size: 1920x1080/);
  assert.equal(project({empty: true, type: 'motion'}) && true, true);
});
test('new refuses a missing brief and bad names', () => {
  assert.equal(run('new', 'PrvTech', 'x', '--root', path.join(tmp, 'rx')).code, 2);
  assert.equal(run('new', 'PrvTech', 'Bad Slug', '--brief', 'x', '--root', path.join(tmp, 'rx')).code, 2);
});
test('untouched templates fail both checks', () => {
  const d = project({empty: true});
  assert.equal(run('check', 'script', d).code, 1); assert.equal(run('check', 'storyboard', d).code, 1);
});

test('the owner\'s original 30 s script is rejected with numbers', () => {
  const d = project(); fs.copyFileSync(path.join(FIX, 'SCRIPT.original.md'), SC(d));
  const r = run('check', 'script', d); assert.equal(r.code, 1);
  assert.equal((r.out.match(/<- too long/g) || []).length, 6, r.out);
  assert.match(r.out, /total speech ~3\d\.\d\d s is longer than the video/);
  for (const t of ['puluhan', 'gratis', 'prvtech.id']) assert.match(r.out, new RegExp(`"${t}" is a claim`));
});
test('the tightened script passes and reports the placeholder', () => {
  const r = run('check', 'script', project()); assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PLACEHOLDER/); assert.match(r.out, /total 47 words/);
});
test('script mutants are rejected', () => {
  const m = (from, to, re) => { const d = project(); edit(SC(d), from, to); const r = run('check', 'script', d); assert.equal(r.code, 1, `${from} -> ${to}\n${r.out}`); assert.match(r.out, re); };
  m('UMKM kamu sudah punya website?', 'UMKM kamu sudah punya website sendiri belum atau masih pakai cara lama?', /line 1 \(beat 1, budget 0\.00–3\.00 s\): needs/);
  m('Tampil rapi di mata pelanggan.', 'Tampil rapi untuk tiga juta pelanggan.', /"juta" is a claim/); // numbers spelled out count as claims too
  m('Tampil rapi di mata pelanggan.', 'TODO', /placeholder or empty/);
  m('| gratis | owner-confirmed |', '| terbaik | owner-confirmed |', /"gratis" is a claim/);
  m('| prvtech.id | placeholder |', '| prvtech.id | guessed |', /status must be one of/);
  m('narration: yes', 'narration: no', /narration must equal/);
});

test('the storyboard fixture passes and plan.json carries exact frame counts', () => {
  const d = project(); const r = run('check', 'storyboard', d); assert.equal(r.code, 0, r.out);
  const plan = JSON.parse(fs.readFileSync(path.join(d, 'Storyboard/plan.json'), 'utf8'));
  assert.equal(plan.fps, 60); assert.equal(plan.totalFrames, 1800); assert.equal(plan.frames.length, 6);
  assert.equal(plan.frames.reduce((a, f) => a + f.durationFrames, 0), 1800);
  assert.equal(plan.frames[3].startFrame, 840); assert.equal(plan.frames[3].clipFrames, 420 + 60);
});
test('storyboard mutants are rejected', () => {
  const m = (from, to, re) => { const d = project(); edit(SB(d), from, to); const r = run('check', 'storyboard', d); assert.equal(r.code, 1, `${from} -> ${to}\n${r.out}`); assert.match(r.out, re); assert.ok(!fs.existsSync(path.join(d, 'Storyboard/plan.json')), 'plan.json must not be written on failure'); };
  m('- time: 8.00–14.00', '- time: 8.50–14.00', /gap/);
  m('- time: 14.00–21.00', '- time: 13.50–21.00', /overlap/);
  m('vo: 8.20–13.90', 'vo: 7.90–13.90', /outside the frame/);
  m('siap pakai."', 'siap digunakan."', /differs from Storyboard\/SCRIPT\.md/);
  m('engine: remotion\n- asset: Asset/owner', 'engine: hyperframes\n- asset: Asset/owner', /not allowed/);
  m('laporan-chart 18.40–20.90 scale=1.5', 'laporan-chart 18.40–19.60 scale=1.5', /shorter than its ramps/);
  m('laporan-chart 18.40–20.90 scale=1.5', 'laporan-chart 17.00–20.90 scale=1.5', /lands while the camera moves/);
  m('tab-kasir @16.40', 'tab-kasir @15.30', /minimum/);
  m('tab-kasir @16.40', 'tab-kasir @15.60', /0\.64 s minimum/); // 0.60 s gap: above travel+dwell, below the planner's real minimum
  m('text: 0.30–2.70 "WEBSITE UNTUK UMKM"', 'text: 0.30–0.90 "WEBSITE UNTUK UMKM"', /is on screen 0\.60 s but needs 1\.00 s/);
  m('fps: 60', 'fps: 30', /fps is 30/);
  m('duration: 30', 'duration: 31', /duration is 31/);
  m('- narrator: wave 0.10–1.60 R', '- narrator: wave 0.10–1.60 R\n- narrator: wave 1.00–2.00 R', /same arm/);
  m('text: 25.40–29.60 "prvtech.id"', 'text: 25.40–29.60 "prvtech.com 100% aman"', /contains the claim, number or domain/);
  m('- vo: 3.20–7.60', '- vo: 2.90–7.60', /outside the frame|overlaps the previous vo/);
  m('narrator: point 4.00–6.50 R at headline', 'narrator: point 4.00–6.50 R', /needs "at <target>"/);
  m('- reads: a direct question to small business owners\n', '', /missing "- reads:"/);
  m('zoom: laporan-chart 18.40–20.90 scale=1.5', 'zoom: laporan-chart 18.40–20.90 scale=1.5\n- zoom: tab-toko 20.95–21.00 scale=1.5', /ramps must be at least|gap/);
});
test('sfx lines and cursor clicks land in plan.json; bad sfx lines are rejected', () => {
  const d = project(); assert.equal(run('check', 'storyboard', d).code, 0);
  const plan = JSON.parse(fs.readFileSync(path.join(d, 'Storyboard/plan.json'), 'utf8'));
  const key = plan.sfx.map((e) => `${e.kind}@${e.at.toFixed(2)}:${e.source}`);
  assert.deepEqual(key, ['impact@0.00:storyboard', 'whoosh@3.00:storyboard', 'click@15.12:cursor', 'click@16.52:cursor', 'click@17.92:cursor']);
  for (const [from, to, re] of [['- sfx: impact @0.00 gain=0.8', '- sfx: laser @0.00', /sfx must look like/], ['- sfx: impact @0.00 gain=0.8', '- sfx: impact @5.00', /outside the frame/]]) {
    const m = project(); edit(SB(m), from, to); const r = run('check', 'storyboard', m); assert.equal(r.code, 1, r.out); assert.match(r.out, re);
  }
  const w = project(); edit(SB(w), '- sfx: whoosh @3.00 gain=0.7\n', ''); const r = run('check', 'storyboard', w); assert.equal(r.code, 0); assert.match(r.out, /"sound:" is only a note/);
});
test('sfx.mjs names the missing filters when ffmpeg is a minimal build', { skip: fullFfmpeg && 'ffmpeg is a full build' }, () => {
  const d = project(); run('check', 'storyboard', d);
  const r = spawnSync('node', [path.join(ROOT, 'skills/removid/scripts/sfx.mjs'), path.join(d, 'Storyboard/plan.json'), '--out', path.join(tmp, 'm.wav')], {encoding: 'utf8'});
  assert.equal(r.status, 1); assert.match(r.stderr, /lacks the filters: .*aevalsrc/);
});
test('sfx.mjs renders the events at their times and silence elsewhere', { skip: !fullFfmpeg && 'needs a full ffmpeg build' }, () => {
  const d = project(); run('check', 'storyboard', d); const wav = path.join(tmp, 'sfx.wav');
  const r = spawnSync('node', [path.join(ROOT, 'skills/removid/scripts/sfx.mjs'), path.join(d, 'Storyboard/plan.json'), '--out', wav], {encoding: 'utf8'}); assert.equal(r.status, 0, r.stdout + r.stderr);
  const dur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], {encoding: 'utf8'}).stdout); assert.ok(Math.abs(dur - 30) < 0.05, `duration ${dur}`);
  const level = (at, len) => { const q = spawnSync(FFMPEG, ['-hide_banner', '-ss', String(at), '-t', String(len), '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], {encoding: 'utf8'}); const m = (q.stderr || '').match(/max_volume: (-?[\d.]+) dB/); return m ? Number(m[1]) : -99; };
  assert.ok(level(15.1, 0.1) > -40, 'click at 15.12 s is audible'); assert.ok(level(16.5, 0.1) > -40, 'click at 16.52 s'); assert.ok(level(3.0, 0.3) > -40, 'whoosh at 3.0 s');
  assert.ok(level(22.0, 2.0) < -80, 'silence between events'); assert.ok(level(15.30, 0.8) < -80, 'no sound between the clicks');
  const bad = path.join(tmp, 'bad-plan.json'); fs.writeFileSync(bad, JSON.stringify({totalSec: 5, sfx: [{kind: 'laser', at: 1}]}));
  assert.equal(spawnSync('node', [path.join(ROOT, 'skills/removid/scripts/sfx.mjs'), bad, '--out', path.join(tmp, 'x.wav')]).status, 1);
});
test('a click that finishes before the zoom starts is allowed, one that straddles the ramp is not', () => {
  const ok = project(); edit(SB(ok), 'laporan-chart 18.40–20.90', 'laporan-chart 18.00–20.90'); // click at 17.92 <= 18.00
  assert.equal(run('check', 'storyboard', ok).code, 0);
  const bad = project(); edit(SB(bad), 'laporan-chart 18.40–20.90', 'laporan-chart 17.90–20.90'); // click at 17.92 > 17.90
  assert.match(run('check', 'storyboard', bad).out, /lands while the camera moves/);
});
test('the narrator character must be decided before the storyboard; any registered id is accepted', () => {
  const d = project({character: 'undecided'});
  const r = run('check', 'storyboard', d); assert.equal(r.code, 1); assert.match(r.out, /narrator character is undecided/);
  assert.equal(run('set-character', d, 'Bad Name').code, 2);
  assert.equal(run('set-character', d, 'pixel').code, 0); assert.match(run('status', d).out, /character=pixel/);
  assert.equal(run('check', 'storyboard', d).code, 0);
  assert.equal(run('set-character', d, 'none').code, 0);
  const v = run('check', 'storyboard', d); assert.equal(v.code, 1); assert.match(v.out, /narrator cue but PROJECT\.md has no narrator character/); // voice only: no narrator cues allowed
  assert.equal(run('new', 'B', 'x', '--root', path.join(tmp, 'rc'), '--narration', 'yes', '--brief', 'y').code, 0);
  assert.match(fs.readFileSync(path.join(tmp, 'rc/B', fs.readdirSync(path.join(tmp, 'rc/B'))[0], 'PROJECT.md'), 'utf8'), /character: undecided/);
});
test('a silent project has no script gate and no voice lines', () => {
  const d = project({narration: 'no', empty: true});
  assert.match(run('submit', 'script', d).out, /no script gate/);
  fs.copyFileSync(path.join(FIX, 'STORYBOARD.md'), SB(d));
  const r = run('check', 'storyboard', d); assert.equal(r.code, 1); assert.match(r.out, /narration is off/);
});

test('gates: nothing moves without a submit, evidence, and a matching hash', () => {
  const d = project();
  assert.equal(run('gate', 'voice', d).code, 1);
  assert.equal(run('gate', 'build', d).code, 1);
  assert.equal(run('approve', 'script', d, '--evidence', 'ok disetujui').code, 1, 'approve before submit');
  assert.equal(run('submit', 'script', d).code, 0);
  assert.equal(run('approve', 'script', d, '--evidence', '').code, 2, 'empty evidence');
  assert.equal(run('approve', 'script', d).code, 2, 'no evidence');
  assert.equal(run('approve', 'script', d, '--evidence', 'ya, naskahnya oke').code, 0);
  assert.equal(run('gate', 'voice', d).code, 0);
  assert.equal(run('gate', 'build', d).code, 1, 'storyboard not approved');
  // storyboard needs audio or an explicit reason
  const s1 = run('submit', 'storyboard', d); assert.equal(s1.code, 1); assert.match(s1.out, /no measured audio/);
  assert.equal(run('submit', 'storyboard', d, '--estimate', 'the user records later').code, 0);
  assert.equal(run('scaffold', d).code, 1, 'no scaffold before the storyboard ACC');
  assert.equal(run('approve', 'storyboard', d, '--evidence', 'storyboard oke lanjut').code, 0);
  assert.equal(run('gate', 'build', d).code, 0);
  assert.equal(run('gate', 'sample', d).code, 0);
  assert.equal(run('gate', 'full', d).code, 1, 'sample not approved');
  assert.equal(run('approve', 'sample', d, '--evidence', 'sampel bagus').code, 1, 'no sample video yet');
  fs.mkdirSync(path.join(d, 'Result/sample'), {recursive: true}); fs.writeFileSync(path.join(d, 'Result/sample/sample.mp4'), 'x');
  assert.equal(run('approve', 'sample', d, '--evidence', 'sampel bagus').code, 0);
  const full = run('gate', 'full', d); assert.equal(full.code, 1); assert.match(full.out, /placeholder claims remain: "prvtech\.id"/);
  // confirming the domain edits only ## Claims: approvals survive
  edit(SC(d), '| prvtech.id | placeholder | domain not confirmed by the owner |', '| prvtech.id | owner-confirmed | the owner said so |');
  assert.equal(run('gate', 'full', d).code, 0, 'a claim update must not cancel approvals');
  // changing a word in the script cancels everything downstream
  edit(SC(d), 'Tampil rapi di mata pelanggan.', 'Tampil rapi di depan pelanggan.');
  const st = run('status', d); assert.match(st.out, /gate script\s+stale/); assert.match(st.out, /gate storyboard\s+stale/);
  assert.equal(run('gate', 'full', d).code, 1); assert.equal(run('gate', 'build', d).code, 1);
  assert.equal(run('approve', 'storyboard', d, '--evidence', 'oke').code, 1, 'stale storyboard cannot be approved');
});
test('changing the storyboard after approval cancels sample and final too', () => {
  const d = project();
  for (const [a, e] of [['script', 'oke'], ['storyboard', 'oke']]) { assert.equal(run('submit', a, d, ...(a === 'storyboard' ? ['--estimate', 'r'] : [])).code, 0); assert.equal(run('approve', a, d, '--evidence', e + ' ya').code, 0); }
  fs.mkdirSync(path.join(d, 'Result/sample'), {recursive: true}); fs.writeFileSync(path.join(d, 'Result/sample/s.mp4'), 'x');
  assert.equal(run('approve', 'sample', d, '--evidence', 'sampel oke').code, 0);
  edit(SB(d), 'scene: Domain and a button, clean hold to the end.', 'scene: Domain and a bigger button, clean hold to the end.');
  const st = run('status', d).out; assert.match(st, /gate storyboard\s+stale/); assert.match(st, /gate sample\s+stale/);
});
test('scaffold copies the Remotion starter once the storyboard is approved', () => {
  const d = project();
  run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  run('submit', 'storyboard', d, '--estimate', 'r'); run('approve', 'storyboard', d, '--evidence', 'ya oke');
  const r = run('scaffold', d); assert.equal(r.code, 0, r.out);
  for (const f of ['package.json', 'src/plan.json', 'src/lib/camera.ts', 'scripts/check-logic.mjs']) assert.ok(fs.existsSync(path.join(d, 'Source/remotion', f)), f);
  assert.equal(run('scaffold', d).code, 0, 'a second scaffold only refreshes plan.json'); fs.writeFileSync(path.join(d, 'Source/remotion/package.json'), '{"keep": true}'); run('scaffold', d); assert.match(fs.readFileSync(path.join(d, 'Source/remotion/package.json'), 'utf8'), /keep/, 'never overwrites the project');
});
test('scaffold --preview copies the starter for character design before any gate', () => {
  const d = project({character: 'undecided'});
  assert.equal(run('scaffold', d).code, 1, 'a normal scaffold waits for Gate 2');
  const r = run('scaffold', d, '--preview'); assert.equal(r.code, 0, r.out); assert.ok(fs.existsSync(path.join(d, 'Source/remotion/src/characters/index.ts')));
  assert.equal(run('scaffold', d, '--preview').code, 1, 'only once');
  run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  assert.match(run('status', d).out, /next: design the narrator character/);
  assert.equal(run('scaffold', project({narration: 'no', empty: true}), '--preview').code, 1, 'no character without narration');
});
test('project lookup by fragment, ambiguity and unknown names', () => {
  const root = path.join(tmp, 'lookup');
  for (const s of ['alpha-one', 'alpha-two']) assert.equal(run('new', 'B', s, '--root', root, '--brief', 'x').code, 0);
  assert.equal(run('status', 'one', '--root', root).code, 0);
  assert.equal(run('status', 'alpha', '--root', root).code, 2);
  assert.equal(run('status', 'nothing', '--root', root).code, 1);
});

test('measured voice: mapped in order, and the storyboard must contain the real speech', { skip: !hasFfmpeg && 'ffmpeg/ffprobe not installed' }, () => {
  const d = project(); const wav = path.join(tmp, 'vo.wav');
  const spans = [[0.35, 2.55], [3.4, 7.1], [8.3, 13.5], [14.3, 20.2], [21.3, 23.5], [25.3, 28.4]];
  const gate = spans.map(([a, b]) => `between(t,${a},${b})`).join('+');
  const g = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=300:d=29.2:r=24000', '-af', `volume='if(${gate},1,0)':eval=frame`, wav]); assert.equal(g.status, 0, String(g.stderr));
  assert.equal(run('vo', d, wav).code, 1, 'voice is blocked before the script is approved');
  run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  const v = run('vo', d, wav); assert.equal(v.code, 0, v.out); assert.match(v.out, /6 speech segment\(s\), 6 script line\(s\): mapped in order/);
  const ok = run('check', 'storyboard', d); assert.equal(ok.code, 0, ok.out); assert.doesNotMatch(ok.out, /ESTIMATES/);
  assert.equal(run('submit', 'storyboard', d).code, 0, 'measured audio satisfies the submit rule');
  const bad = project(); run('submit', 'script', bad); run('approve', 'script', bad, '--evidence', 'ya oke'); run('vo', bad, wav);
  edit(SB(bad), 'vo: 14.20–20.60', 'vo: 14.20–19.50'); // real speech ends at 20.2
  const r = run('check', 'storyboard', bad); assert.equal(r.code, 1); assert.match(r.out, /measured speech .* does not fit/);
  const len = project(); run('submit', 'script', len); run('approve', 'script', len, '--evidence', 'ya oke'); run('vo', len, wav);
  edit(SB(len), 'duration: 30', 'duration: 28.5'); edit(SB(len), '- time: 25.00–30.00', '- time: 25.00–28.50'); edit(SB(len), 'text: 25.40–29.60', 'text: 25.40–28.40'); edit(SB(len), 'vo: 25.20–28.95', 'vo: 25.20–28.45');
  const tail = run('check', 'storyboard', len); assert.equal(tail.code, 1); assert.match(tail.out, /last word ends at 28\.4\d s but the video ends at 28\.50 s; leave 0\.3 s\+/);
});

// ---------- assemble and vo-place ----------
function approved(d) {
  assert.equal(run('submit', 'script', d).code, 0); assert.equal(run('approve', 'script', d, '--evidence', 'ya oke').code, 0);
  assert.equal(run('submit', 'storyboard', d, '--estimate', 'test').code, 0); assert.equal(run('approve', 'storyboard', d, '--evidence', 'ya oke').code, 0);
}
function dummyClip(file, frames, size = '1920x1080') {
  const g = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${size}:r=60`, '-frames:v', String(frames), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', file], {encoding: 'utf8'});
  assert.equal(g.status, 0, g.stderr);
}
const canEncode = hasFfmpeg && spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=s=64x64:r=60', '-frames:v', '3', '-c:v', 'libx264', path.join(tmp, 'enc.mp4')]).status === 0;

test('assemble writes index.html from plan.json and checks every clip against the plan', { skip: !canEncode && 'ffmpeg cannot encode h264' }, () => {
  const d = project(); approved(d);
  fs.mkdirSync(path.join(d, 'Source/hyperframes'), {recursive: true}); fs.writeFileSync(path.join(d, 'Source/hyperframes/package.json'), '{}');
  assert.equal(run('assemble', d).code, 1, 'no clips yet'); // and vo.wav missing
  const plan = JSON.parse(fs.readFileSync(path.join(d, 'Storyboard/plan.json'), 'utf8')); const H = 15;
  const need = plan.frames.map((f) => Math.min(plan.totalFrames, f.endFrame + H) - Math.max(0, f.startFrame - H));
  plan.frames.forEach((f, i) => dummyClip(path.join(d, 'Asset/scenes', `0${f.id}-scene.mp4`), need[i]));
  spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=300:d=30', path.join(d, 'Asset/agen/vo.wav')]);
  const ok = run('assemble', d); assert.equal(ok.code, 0, ok.out);
  const html = fs.readFileSync(path.join(d, 'Source/hyperframes/index.html'), 'utf8');
  assert.match(html, /id="s1" class="clip" src="assets\/scenes\/01-scene.mp4" data-start="0" data-duration="3.25"/);
  assert.match(html, /id="s4" class="clip" src="assets\/scenes\/04-scene.mp4" data-start="13.75" data-duration="7.5"/); // frames 825..1274
  assert.match(html, /id="s6" class="clip" src="assets\/scenes\/06-scene.mp4" data-start="24.75" data-duration="5.25"/); // clamped at the last frame
  assert.equal((html.match(/tl\.fromTo/g) || []).length, 5); assert.match(html, /<audio id="vo" src="assets\/audio\/vo.wav" data-start="0" data-duration="30"/);
  assert.ok(fs.existsSync(path.join(d, 'Source/hyperframes/assets/scenes/03-scene.mp4')));
  assert.equal(run('assemble', d).code, 0, 'a generated file can be regenerated');
  // mutants
  const bad = (name, fn, re) => { const m = project(); approved(m); fs.mkdirSync(path.join(m, 'Source/hyperframes'), {recursive: true}); fs.writeFileSync(path.join(m, 'Source/hyperframes/package.json'), '{}'); spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=300:d=30', path.join(m, 'Asset/agen/vo.wav')]); plan.frames.forEach((f, i) => dummyClip(path.join(m, 'Asset/scenes', `0${f.id}-scene.mp4`), need[i])); fn(m); const r = run('assemble', m); assert.equal(r.code, 1, `${name}\n${r.out}`); assert.match(r.out, re, name); };
  bad('missing clip', (m) => fs.rmSync(path.join(m, 'Asset/scenes/03-scene.mp4')), /Frame 3: no clip/);
  bad('wrong frame count', (m) => dummyClip(path.join(m, 'Asset/scenes/02-scene.mp4'), need[1] - 1), /has 329 frames, the plan needs 330/);
  bad('wrong size', (m) => dummyClip(path.join(m, 'Asset/scenes/05-scene.mp4'), need[4], '1280x720'), /is 1280x720, the plan says 1920x1080/);
  bad('hand-edited index.html', (m) => fs.writeFileSync(path.join(m, 'Source/hyperframes/index.html'), '<html>my own edits</html>'), /edited by hand/);
  bad('stale plan', (m) => edit(SB(m), 'scene: Domain and a button, clean hold to the end.', 'scene: Domain and a bigger button, clean hold to the end.'), /GATE build: BLOCKED|STALE/);
});
test('vo-place puts each line at its script window and the measurement agrees', { skip: !hasFfmpeg && 'ffmpeg not installed' }, () => {
  const d = project(); run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  const r0 = run('vo-place', d); assert.equal(r0.code, 1); assert.match(r0.out, /missing per-line audio .*line1\.\*/s);
  const spans = [2.0, 3.5, 4.5, 5.0, 2.0, 3.0]; // seconds of speech per line, each inside its window
  spans.forEach((len, i) => spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=f=300:d=${len}:r=24000`, path.join(d, `Asset/agen/line${i + 1}.wav`)]));
  const r = run('vo-place', d, '--lead', '0.2'); assert.equal(r.code, 0, r.out); assert.match(r.out, /6 speech segment\(s\), 6 script line\(s\): mapped in order/);
  const rep = JSON.parse(fs.readFileSync(path.join(d, 'Asset/agen/vo-report.json'), 'utf8')); const starts = [0, 3, 8, 14, 21, 25];
  rep.segments.forEach((s, i) => { assert.ok(Math.abs(s.start - (starts[i] + 0.2)) < 0.06, `line ${i + 1} starts ${s.start}`); assert.ok(Math.abs(s.end - s.start - spans[i]) < 0.08, `line ${i + 1} length ${s.end - s.start}`); });
  assert.ok(Math.abs(rep.duration - 30) < 0.05);
  assert.equal(run('vo-place', project(), '--lead', '0.2').code, 1, 'blocked before the script is approved');
});
test('vo-place refuses a line that does not fit its window; --fit reschedules without touching the script', { skip: !hasFfmpeg && 'ffmpeg not installed' }, () => {
  const d = project(); run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  const before = fs.readFileSync(SC(d), 'utf8');
  const spans = [2.0, 3.5, 4.5, 5.0, 2.0, 4.6]; // the last line needs 4.6 s but its window (25 to 30) minus the lead leaves 4.9 s; make line 5 long enough to push it
  spans[4] = 4.4; // line 5: window 21..25 -> 4.0 s, overflows by about 0.5 s
  spans.forEach((len, i) => spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=f=300:d=${len}:r=24000`, path.join(d, `Asset/agen/line${i + 1}.wav`)]));
  const r = run('vo-place', d); assert.equal(r.code, 1, r.out); assert.match(r.out, /do not fit their script window: line 5 by 0\.\d\d s/); assert.match(r.out, /--fit/);
  const f = run('vo-place', d, '--fit'); assert.equal(f.code, 0, f.out); assert.match(f.out, /placed 6 lines \(fitted\)/);
  const rep = JSON.parse(fs.readFileSync(path.join(d, 'Asset/agen/vo-report.json'), 'utf8'));
  const gaps = rep.segments.slice(1).map((s, i) => s.start - rep.segments[i].end); gaps.forEach((g) => assert.ok(g >= 0.3, `gap ${g}`));
  assert.ok(rep.segments.at(-1).end <= 30 - 0.4, `the last word ends at ${rep.segments.at(-1).end}`);
  assert.equal(fs.readFileSync(SC(d), 'utf8'), before, 'the approved script is untouched'); assert.match(run('status', d).out, /gate script\s+approved/);
  const spans2 = [5.2, 5.2, 5.2, 5.2, 5.2, 5.2]; spans2.forEach((len, i) => spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=f=300:d=${len}:r=24000`, path.join(d, `Asset/agen/line${i + 1}.wav`)]));
  const bad = run('vo-place', d, '--fit'); assert.equal(bad.code, 1); assert.match(bad.out, /cannot be fitted into 30 s/);
});

test('vo-place --lufs levels the voice track', { skip: !fullFfmpeg && 'needs a full ffmpeg build (loudnorm)' }, () => {
  const d = project(); run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  [2.0, 3.5, 4.5, 5.0, 2.0, 3.0].forEach((len, i) => spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=f=300:d=${len}:r=24000`, '-af', `volume=${-34 + i * 4}dB`, path.join(d, `Asset/agen/line${i + 1}.wav`)])); // six lines, 20 dB apart in level
  const r = run('vo-place', d, '--lufs', '-15'); assert.equal(r.code, 0, r.out); assert.match(r.out, /levelling each line to -15 LUFS/);
  const m = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', path.join(d, 'Asset/agen/vo.wav'), '-af', 'ebur128', '-f', 'null', '-'], {encoding: 'utf8'});
  const lufs = parseFloat((m.stderr.match(/\n\s+I:\s+(-?[\d.]+) LUFS/g) || []).pop().match(/-?[\d.]+/)[0]); assert.ok(Math.abs(lufs + 15) < 1.2, /* 2 s synthetic lines carry about 1 dB of edge error in the loudness measure */ `integrated ${lufs} LUFS`);
});

test('script-init writes one tagged TODO paragraph per spoken beat, with no seconds, and TODOs still fail the check', () => {
  const d = project({empty: true});
  fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ai-critical/STRUCTURE.md'), path.join(d, 'Storyboard/STRUCTURE.md'));
  edit(path.join(d, 'PROJECT.md'), 'target_duration: 30', 'target_duration: 38');
  const r = run('script-init', d); assert.equal(r.code, 0, r.out);
  const text = fs.readFileSync(SC(d), 'utf8');
  const paras = text.replace(/<!--[\s\S]*?-->/g, '').split('\n').filter((l) => /^\[[a-z]+\] TODO$/.test(l));
  assert.equal(paras.length, 7); assert.ok(!/\d\s*[–-]\s*\d+\s*s|\[\d\d\.\d/.test(text.replace(/<!--[\s\S]*?-->/g, '')), 'no seconds in the skeleton');
  assert.notEqual(run('check', 'script', d).code, 0, 'unfilled TODOs must not pass');
  fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ai-critical/SCRIPT.md'), SC(d));
  const again = run('script-init', d); assert.notEqual(again.code, 0); assert.match(again.out, /already has words/);
  assert.equal(run('script-init', d, '--force').code, 0);
});

test('the Gate 1 contract is printed by intake (text and json) and by new', () => {
  assert.match(run('intake', 'video tentang evolusi').out, /GATE 1 CONTRACT/);
  assert.match(JSON.parse(run('intake', 'video tentang evolusi', '--json').out).gate1_contract, /Do not write the script or a plan in chat/);
  const r = run('new', 'Acme', 'x', '--root', path.join(tmp, 'rootc'), '--narration', 'yes', '--brief', 'b'); assert.match(r.out, /GATE 1 CONTRACT/);
});

const REPLIES = path.join(ROOT, 'tests/fixtures/ai-critical/replies');
function aiProject() {
  const d = project({empty: true}); edit(path.join(d, 'PROJECT.md'), 'target_duration: 30', 'target_duration: 38');
  for (const f of ['STRUCTURE.md', 'SCRIPT.md']) fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ai-critical', f), path.join(d, 'Storyboard', f));
  return d;
}
test('verify-reply accepts the owner\'s clean format and rejects every bad output the owner pasted', () => {
  const d = aiProject(); const v = (f, ...x) => run('verify-reply', d, path.join(REPLIES, f), ...x);
  assert.equal(v('good.txt').code, 0, v('good.txt').out);
  const cases = {'bad-timed-table.txt': /second, timed script/, 'bad-stages.txt': /labelled stage/, 'bad-asks-audio.txt': /audio path/, 'bad-block-dirty.txt': /seconds inside the line/, 'bad-block-edited.txt': /differs from Storyboard\/SCRIPT\.md/};
  for (const [f, re] of Object.entries(cases)) { const r = v(f); assert.notEqual(r.code, 0, `${f} must fail`); assert.match(r.out, re, f); }
});
test('verify-reply: a bare block works, a misspelled tag and a missing block fail, --format-only needs no project', () => {
  const bare = '[curious] Tau nggak?\n\n[calm, reassuring] Santai saja.\n';
  const f = path.join(tmp, 'bare.txt'); fs.writeFileSync(f, bare);
  assert.equal(run('verify-reply', '--format-only', f).code, 0);
  fs.writeFileSync(f, '[curoius] Tau nggak?\n\n[calm] Santai.\n'); const bad = run('verify-reply', '--format-only', f); assert.notEqual(bad.code, 0); assert.match(bad.out, /misspelled/);
  fs.writeFileSync(f, 'Hook: tau nggak?\nSantai saja.\n'); assert.match(run('verify-reply', '--format-only', f).out, /no VO script block/);
  fs.writeFileSync(f, '```\n[curious] Tau nggak?\nSanta saja.\n```\n'); assert.match(run('verify-reply', '--format-only', f).out, /one paragraph|line break/);
});
