// Tests for the style library, the emotion table, the interview (intake), structure, emotion tags, style and transitions in project.mjs.
// Every check must be able to FAIL: the mutants below break one thing each and expect the matching message.
//   node --test tests/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SK = path.join(ROOT, 'skills/removid');
const PM = path.join(SK, 'scripts/project.mjs');
const FIX = path.join(ROOT, 'tests/fixtures/prvtech-30s');
const STARTER = path.join(SK, 'templates/remotion-starter');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'removid-style-test-'));
process.on('exit', () => fs.rmSync(tmp, {recursive: true, force: true}));
const S = await import(pathToFileURL(path.join(SK, 'scripts/lib-style.mjs')).href);
const E = await import(pathToFileURL(path.join(SK, 'scripts/lib-emotion.mjs')).href);

const run = (...args) => { const r = spawnSync('node', [PM, ...args], {encoding: 'utf8'}); return {code: r.status, out: (r.stdout || '') + (r.stderr || '')}; };
let n = 0;
function project(opts = {}) {
  const root = path.join(tmp, 'root' + n++);
  const a = ['new', 'PrvTech', 'promo-umkm', '--root', root, '--format', 'landscape', '--duration', '30', '--narration', opts.narration || 'yes', '--voice', 'cowok', '--character', opts.narration === 'no' ? 'none' : 'ayu', '--brief', 'brief in the user words'];
  if (opts.style !== null) a.push('--style', opts.style || 'flatlife');
  const r = run(...a); assert.equal(r.code, 0, r.out);
  const dir = path.join(root, 'PrvTech', fs.readdirSync(path.join(root, 'PrvTech'))[0]);
  for (const f of ['STRUCTURE.md', 'SCRIPT.md', 'STORYBOARD.md']) fs.copyFileSync(path.join(FIX, f), path.join(dir, 'Storyboard', f));
  return dir;
}
const edit = (file, from, to) => { const t = fs.readFileSync(file, 'utf8'); assert.ok(t.includes(from), `fixture no longer contains: ${from}`); fs.writeFileSync(file, t.replace(from, to)); };
const ST = (d) => path.join(d, 'Storyboard/STRUCTURE.md'), SC = (d) => path.join(d, 'Storyboard/SCRIPT.md'), SB = (d) => path.join(d, 'Storyboard/STORYBOARD.md');

// ---------- the 36 styles ----------
test('all 36 styles are complete, readable and inside the limits the checks and the starter enforce', () => {
  const {styles} = S.loadStyles(); const all = Object.values(styles);
  assert.equal(all.length, 36); assert.deepEqual(S.CATEGORIES.map((c) => all.filter((s) => s.category === c).length), [13, 13, 10]);
  const easeSrc = fs.readFileSync(path.join(STARTER, 'src/lib/ease.ts'), 'utf8'); const easesObj = easeSrc.slice(easeSrc.indexOf('export const EASES'), easeSrc.indexOf('export type EaseName'));
  const aliases = new Map();
  for (const s of all) {
    const tag = s.name;
    assert.deepEqual(S.paletteIssues(s), [], `${tag} palette`);
    for (const k of ['bg', 'fg', 'accent', 'accent2', 'muted']) assert.match(s.palette[k], /^#[0-9a-f]{6}$/i, `${tag} ${k}`);
    for (const e of Object.values(s.ease)) { assert.ok(S.EASES.includes(e), `${tag}: ease ${e}`); assert.match(easesObj, new RegExp(`\\b${e}\\b`), `${tag}: ${e} is missing from the starter's EASES`); }
    assert.ok(S.TRANSITIONS.includes(s.transition.kind), `${tag} transition`); assert.ok(s.transition.sec >= 0 && s.transition.sec <= 0.5, `${tag}: transition ${s.transition.sec} s must fit the 0.5 s of clip overlap`);
    assert.ok(s.shotSec[0] > 0 && s.shotSec[0] < s.shotSec[1], `${tag} shotSec`); assert.ok(s.zoomMax >= 1 && s.zoomMax <= 2, `${tag} zoomMax`); assert.ok(s.maxWords >= 3 && s.maxWords <= 12, `${tag} maxWords`);
    assert.ok(s.sfx.every((x) => S.SFX.includes(x)), `${tag} sfx`); assert.ok(s.about.length > 15 && s.look.length > 15 && s.avoid.length >= 2 && s.topics.length >= 1, `${tag} text`);
    assert.ok([0, 8, 9, 10, 12].includes(s.stepFps), `${tag} stepFps`); assert.ok(s.gestures >= 1 && s.gestures <= 5, `${tag} gestures`);
    for (const a of [s.name, s.id, ...s.aliases]) { const k = a.toLowerCase().replace(/[^a-z0-9]+/g, ''); if (aliases.has(k) && aliases.get(k) !== s.id) assert.fail(`"${a}" names both ${aliases.get(k)} and ${s.id}`); aliases.set(k, s.id); }
  }
  assert.equal(S.resolveStyle('clay').id, 'clay-3d'); assert.equal(S.resolveStyle('Tanah Liat').id, 'clay-3d'); assert.equal(S.resolveStyle('MOGRAPH MIX').id, 'mograph-mix'); assert.equal(S.resolveStyle('nope'), null);
});
test('the palette check can fail', () => {
  const s = structuredClone(S.resolveStyle('midnight')); s.palette.fg = '#2a3a60'; assert.match(S.paletteIssues(s).join(), /text .* is [\d.]+:1, needs 4.5/);
  const t = structuredClone(S.resolveStyle('clay-3d')); t.palette.accent = '#b09070'; assert.match(S.paletteIssues(t).join(), /accent .* can neither be read/);
  const u = structuredClone(S.resolveStyle('midnight')); u.palette.accent = '#101c3f'; assert.deepEqual(S.paletteIssues(u), [], 'on a dark ground an accent close to it can still carry light text, so the rule allows it');
  assert.ok(S.contrast('#000000', '#ffffff') > 20.9 && S.contrast('#777777', '#777777') === 1);
});
test('a style is named only when the brief names it', () => {
  const names = (t) => S.namedStyles(t).map((s) => s.id);
  assert.deepEqual(names('buat story tentang evolusi manusia dari purba hingga modern'), [], 'a topic word is not a style');
  assert.deepEqual(names('payment system untuk toko'), [], 'an ordinary word is not a style');
  assert.deepEqual(names('pakai gaya system untuk tips produktivitas'), ['system']);
  assert.deepEqual(names('video gaya clay tentang fotosintesis'), ['clay-3d']);
  assert.deepEqual(names('buat voxelverse adventure'), ['voxelverse'], 'a coined name needs no cue');
});
test('recommend ranks styles by the brief and explains why', () => {
  const r = S.recommend('promo aplikasi saas untuk umkm', {n: 3}); assert.equal(r.length, 3); assert.ok(r[0].score > 0 && r[0].why.length);
  assert.ok(r.map((x) => x.style.id).some((id) => ['midnight', 'flatlife', 'mograph-mix'].includes(id)));
  assert.equal(S.recommend('legenda wayang dan folklor', {n: 1})[0].style.id, 'hikayat');
});

// ---------- the interview ----------
test('intake asks only what the brief leaves open, at most 4 questions, recommended answer first', () => {
  const none = S.intake('buat video promo 30 detik untuk reels, narasi suara, gaya clay, tanpa karakter');
  assert.equal(none.known.find((k) => k.field === 'duration').value, 30); assert.equal(none.known.find((k) => k.field === 'format').value, 'portrait'); assert.equal(none.known.find((k) => k.field === 'style').value, 'CLAY-3D');
  assert.ok(!none.questions.some((q) => q.id === 'proof'), '"30 detik" and "promo" are not claims');
  const open = S.intake('buat sebuah story sederhana tentang evolusi manusia dari purba hingga modern');
  assert.deepEqual(open.questions.map((q) => q.id), ['format', 'style', 'voice']); assert.ok(open.questions.length <= 4);
  for (const q of open.questions) { assert.match(q.options[0].label, /\(Recommended\)/, q.id); assert.ok(q.options.length >= 2 && q.options.length <= 4); }
  const proof = S.intake('promo 15 detik reels, gaya midnight, narasi, diskon 50% dan gratis ongkir di toko.id');
  assert.ok(proof.questions.some((q) => q.id === 'proof')); assert.match(proof.questions.find((q) => q.id === 'proof').question, /50%|diskon|gratis/);
  const silent = S.intake('video demo 20 detik tanpa suara untuk youtube pakai midnight'); assert.ok(!silent.questions.some((q) => q.id === 'voice') && !silent.questions.some((q) => q.id === 'format'));
  assert.ok(open.assumed.some((a) => a.field === 'fps' && a.value === 60));
});
test('intake CLI prints the card and valid JSON', () => {
  const t = run('intake', 'video 30 detik untuk reels tentang kopi'); assert.equal(t.code, 0, t.out); assert.match(t.out, /KNOWN from the brief/); assert.match(t.out, /ASSUMED/);
  const j = JSON.parse(run('intake', 'video 30 detik untuk reels tentang kopi', '--json').out); assert.ok(Array.isArray(j.questions) && Array.isArray(j.known));
  assert.equal(run('intake').code, 2);
  assert.match(run('style', '--for', 'wayang dan legenda').out, /HIKAYAT/); assert.match(run('style', 'midnight').out, /palette: bg #0E1B3D/); assert.equal(run('style', 'zzz').code, 1);
});

// ---------- emotions ----------
test('the emotion table is complete and the voice, face and gestures agree', () => {
  const {tags, aliases} = E.loadEmotions(); const names = Object.keys(tags); assert.equal(names.length, 12);
  for (const [k, t] of Object.entries(tags)) {
    assert.ok(t.face.smile >= -1 && t.face.smile <= 1 && t.face.brow >= -1 && t.face.brow <= 1 && t.face.raise >= 0 && t.face.raise <= 1 && t.face.eye >= 0.7 && t.face.eye <= 1.4 && Math.abs(t.face.tilt) <= 0.2, k);
    assert.ok(t.energy >= 0 && t.energy <= 1 && t.body.bounce >= 0 && t.body.bounce <= 1.6, k); assert.ok(t.gestures.every((g) => ['wave', 'point', 'present'].includes(g)), k);
    assert.ok(Math.abs(t.voice.rate) <= 15 && Math.abs(t.voice.pitch) <= 12 && Math.abs(t.voice.volume) <= 8, `${k} voice values must stay natural`);
  }
  for (const [a, t] of Object.entries(aliases)) assert.ok(tags[t], `alias ${a} -> ${t}`);
  assert.equal(E.canonical('Happy'), 'warm'); assert.equal(E.canonical('mad'), 'mad'); assert.equal(E.canonical('zzz'), null); assert.equal(E.suggest('curios'), 'curious'); assert.equal(E.suggest('qqqqqqqq'), null);
  assert.ok(tags.sad.energy < tags.excited.energy && tags.sad.voice.rate < 0 && tags.excited.voice.rate > 0 && tags.sad.face.smile < 0 && tags.mad.face.brow > 0 && tags.sad.face.brow < 0, 'the numbers must point the way the names do');
});
test('the starter carries exactly the table (no drift) and its sample moods use real values', async () => {
  assert.equal(fs.readFileSync(path.join(STARTER, 'src/emotions.ts'), 'utf8'), E.emotionsTs(), 'run: node -e "import(\'./skills/removid/scripts/lib-emotion.mjs\').then(m=>require(\'fs\').writeFileSync(\'skills/removid/templates/remotion-starter/src/emotions.ts\',m.emotionsTs()))"');
  let data; try { data = await import(pathToFileURL(path.join(STARTER, 'src/scenes/narrator.data.ts')).href); } catch (e) { if (/ERR_UNKNOWN_FILE_EXTENSION|Unknown file extension/.test(String(e))) return; throw e; }
  const {tags} = E.loadEmotions(); for (const seg of data.MOODS.segments) { assert.deepEqual(seg.face, tags[seg.tag].face, seg.tag); assert.equal(seg.body.bounce, tags[seg.tag].body.bounce); assert.equal(seg.energy, tags[seg.tag].energy); }
});
test('each engine gets the line it can use', () => {
  const raw = '[curious] Kenapa es mengapung? [laugh] Ternyata ringan.';
  assert.equal(E.renderLine(raw, 'plain'), 'Kenapa es mengapung? Ternyata ringan.'); assert.equal(E.renderLine(raw, 'edge'), 'Kenapa es mengapung? Ternyata ringan.', 'Edge reads tags aloud, so none');
  assert.equal(E.renderLine(raw, 'elevenlabs'), '[curious] Kenapa es mengapung? [laughs] Ternyata ringan.');
  assert.equal(E.renderLine(raw, 'chatterbox'), 'Kenapa es mengapung? [laugh] Ternyata ringan.', 'only the sound tags the engine has');
  assert.deepEqual(E.edgeArgs('excited'), {rate: '+10%', pitch: '+8Hz', volume: '+5%', pauseBefore: 0}); assert.equal(E.edgeArgs('sad').rate, '-12%');
  assert.throws(() => E.renderLine(raw, 'nope'));
  const t = E.timeline([{at: 0.3, tag: 'warm'}, {at: 4, tag: 'sad'}], 9);
  assert.deepEqual(t.segments.map((x) => [x.tag, x.start, x.end]), [['warm', 0, 3.8], ['sad', 3.8, 9.5], ['neutral', 9.5, null]]);
});

// ---------- structure ----------
test('the structure fixture passes; structure mutants are rejected', () => {
  const ok = run('check', 'script', project()); assert.equal(ok.code, 0, ok.out); assert.match(ok.out, /warm/); assert.match(ok.out, /0 errors/);
  const m = (from, to, re, what = 'script') => { const d = project(); edit(ST(d), from, to); const r = run('check', what, d); assert.equal(r.code, 1, `${from} -> ${to}\n${r.out}`); assert.match(r.out, re); };
  m('- time: 3.0–8.0', '- time: 3.5–8.0', /starts at 3\.50 but the previous beat ends at 3\.00 \(gap\)/);
  m('- purpose: problem', '- purpose: hook', /exactly one beat must be the hook \(found 2\)/);
  m('- purpose: cta', '- purpose: setup', /the last beat must be cta, outro or payoff/);
  m('- time: 0.0–3.0', '- time: 0.0–4.6', /hook of 4\.60 s|starts at 4\.60|overlap/);
  m('- info: A direct question: does your business have a website?', '- info: TODO', /"info" must state the ONE thing/);
  m('- emotion: serious', '- emotion: sereous', /emotion "sereous" is not known \(did you mean serious\?\)/);
  m('- source: remotion\n- info: Looking', '- source: footage\n- info: Looking', /source includes footage but there is no "- footage:/);
  m('- shows: The PrvTech wordmark, then a clean storefront assembling from cards.', '- shows: x', /"shows" must say what is on screen/);
  const d = project(); fs.rmSync(ST(d)); const r = run('check', 'script', d); assert.equal(r.code, 1); assert.match(r.out, /STRUCTURE\.md is missing/);
});
test('a script block must sit inside one beat and open with its emotion', () => {
  const m = (from, to, re) => { const d = project(); edit(SC(d), from, to); const r = run('check', 'script', d); assert.equal(r.code, 1, `${from} -> ${to}\n${r.out}`); assert.match(r.out, re); };
  m('[03.0–08.0] PROBLEM', '[02.0–08.0] PROBLEM', /crosses a beat boundary/);
  m('[00.0–03.0] HOOK\n[warm] UMKM', '[00.0–03.0] HOOK\nUMKM', /block 1 .* no emotion tag/);
  m('[serious] Usaha kecil', 'Usaha kecil [serious] sulit', /the first tag comes after word|no emotion tag/);
  m('[proud] PrvTech', '[prowd] PrvTech', /\[prowd\] is not an emotion tag \(did you mean \[proud\]\?\)/);
  m('[excited] Dari toko online, sistem kasir, sampai laporan keuangan, sesuai kebutuhan bisnismu.', '[excited] Dari toko online, [calm] sistem kasir, [sad] sampai laporan keuangan, sesuai kebutuhan bisnismu.', /3 emotion tags in one block/);
  m('[excited] Dari toko online, sistem kasir,', '[excited] Dari [calm] toko online, sistem kasir,', /\[excited\] covers 1 word/);
});
test('the delivery arc is checked: flat reads, a weak hook and abrupt jumps are warned', () => {
  const d = project(); let t = fs.readFileSync(SC(d), 'utf8'); for (const tag of ['serious', 'proud', 'excited']) t = t.split(`[${tag}]`).join('[warm]'); fs.writeFileSync(SC(d), t);
  let r = run('check', 'script', d); assert.match(r.out, /every block is \[warm\]/);
  const h = project(); edit(SC(h), '[warm] UMKM', '[calm] UMKM'); r = run('check', 'script', h); assert.match(r.out, /the hook is delivered \[calm\]/);
  const l = project(); edit(SC(l), '[excited] Yuk', '[sad] Yuk'); r = run('check', 'script', l); assert.match(r.out, /the last block is \[sad\]/);
});
test('tags are not spoken, not counted as words, and part of what the user approves', () => {
  const d = project(); const r = run('check', 'script', d); assert.match(r.out, /total 47 words/);
  assert.equal(run('submit', 'script', d).code, 0); const vo = fs.readFileSync(path.join(d, 'Asset/agen/vo.txt'), 'utf8'); assert.ok(!/\[/.test(vo), 'vo.txt must be clean'); assert.equal(vo.trim().split('\n').length, 6);
  assert.equal(run('approve', 'script', d, '--evidence', 'naskahnya oke').code, 0); assert.match(run('status', d).out, /gate script\s+approved/);
  edit(SC(d), '[proud] PrvTech', '[warm] PrvTech'); assert.match(run('status', d).out, /gate script\s+stale/, 'changing a delivery cancels the approval');
  const e = project(); run('submit', 'script', e); run('approve', 'script', e, '--evidence', 'ya oke'); edit(ST(e), 'Looking unprofessional keeps small businesses from growing.', 'Looking unprofessional costs small businesses customers.');
  assert.match(run('status', e).out, /gate script\s+stale/, 'changing the structure cancels the approval');
});

// ---------- voice lines ----------
test('vo-lines writes each engine its own version of every line', () => {
  const d = project(); edit(SC(d), '[excited] Dari toko online, sistem kasir,', '[excited] Dari toko online, [laugh] sistem kasir,'); edit(SC(d), 'sesuai kebutuhan bisnismu.', 'sesuai kebutuhan bisnismu, ya.');
  const r = run('vo-lines', d, '--engine', 'elevenlabs'); assert.equal(r.code, 0, r.out); assert.match(r.out, /edge-tts --voice id-ID-GadisNeural/);
  const j = JSON.parse(fs.readFileSync(path.join(d, 'Asset/agen/vo-lines.json'), 'utf8')); assert.equal(j.lines.length, 6);
  assert.equal(j.lines[0].emotion, 'warm'); assert.deepEqual(j.lines[0].engines.edge, {text: 'UMKM kamu sudah punya website?', rate: '-3%', pitch: '+2Hz', volume: '+0%', pauseBefore: 0});
  assert.match(j.lines[3].engines.elevenlabs, /^\[excited\] Dari toko online, \[laughs\] sistem kasir/); assert.ok(!/\[/.test(j.lines[3].engines.plain)); assert.ok(!/\[/.test(j.lines[3].engines.edge.text));
  assert.equal(j.lines[3].emotions.length, 2); assert.equal(fs.readFileSync(path.join(d, 'Asset/agen/lines/line4.txt'), 'utf8').trim(), j.lines[3].engines.elevenlabs);
  assert.equal(run('vo-lines', d, '--engine', 'zzz').code, 2); assert.equal(run('vo-lines', project({narration: 'no'})).code, 1);
});

// ---------- style in the storyboard ----------
test('check storyboard: the style is required, and its limits are enforced', () => {
  const none = project({style: null}); let r = run('check', 'storyboard', none); assert.equal(r.code, 1); assert.match(r.out, /video style is undecided/);
  assert.match(run('status', none).out, /choose the video style/); assert.equal(run('set-style', none, 'zzz').code, 1); assert.equal(run('set-style', none, 'clay').code, 0);
  r = run('check', 'storyboard', none); assert.equal(r.code, 0, r.out); const plan = JSON.parse(fs.readFileSync(path.join(none, 'Storyboard/plan.json'), 'utf8'));
  assert.equal(plan.style.id, 'clay-3d'); assert.equal(plan.style.palette.bg, '#F3E8D6'); assert.equal(plan.frames[0].transition.kind, 'none'); assert.equal(plan.frames[1].transition.kind, 'fade'); assert.equal(plan.frames[1].transition.sec, 0.4);
  assert.deepEqual(plan.emotions.segments.map((x) => x.tag), ['warm', 'serious', 'proud', 'excited', 'proud', 'excited', 'neutral']);
  assert.ok(plan.emotions.segments.slice(0, -1).every((x) => x.end - x.start >= 0.8) && plan.emotions.segments[1].start > 3 && plan.emotions.segments[1].start < 3.3, 'serious starts just before its first word (3.2 s window start + 0.1)');
  const m = (from, to, re, level = 1) => { const d = project(); edit(SB(d), from, to); const x = run('check', 'storyboard', d); assert.equal(x.code, level, `${from} -> ${to}\n${x.out}`); assert.match(x.out, re); };
  m('- text: 0.30–2.70 "WEBSITE UNTUK UMKM"', '- text: 0.30–2.70 "WEBSITE UNTUK UMKM DAN SEMUA USAHA KECIL YANG MAU TUMBUH BESAR"', /keeps on-screen text to 8|needs [\d.]+ s/);
  m('- zoom: laporan-chart 18.40–20.90 scale=1.5', '- zoom: laporan-chart 18.40–20.90 scale=1.9', /scale 1\.9 is above FLATLIFE's 1\.6|above FLATLIFE/, 0);
  m('- sfx: impact @0.00 gain=0.8', '- sfx: chime @0.00 gain=0.8\n- sfx: impact @0.00 gain=0.8', /./, 0);
  m('## Frame 2 — Problem\n- time: 3.00–8.00', '## Frame 2 — Problem\n- time: 3.00–8.00\n- transition: dissolve 9', /transition must look like/);
  m('## Frame 2 — Problem\n- time: 3.00–8.00', '## Frame 2 — Problem\n- time: 3.00–8.00\n- transition: slide 0.9', /longer than the 0\.5 s of overlap/);
  m('- narrator: point 4.00–6.50 R at headline', '- narrator: wave 4.00–6.50 R', /wave 4\.00–6\.50 plays while the delivery is \[serious\]/, 0);
  const st = project(); edit(SB(st), '- time: 8.00–14.00', '- time: 8.00–14.00'); // untouched: alignment holds
  const straddle = project(); edit(SB(straddle), '- time: 3.00–8.00', '- time: 3.00–7.00'); edit(SB(straddle), '- time: 8.00–14.00', '- time: 7.00–14.00');
  r = run('check', 'storyboard', straddle); assert.match(r.out, /vo|ERROR/, 'moving a frame edge is caught somewhere'); assert.equal(r.code, 1);
});
test('a frame may split a beat but never straddle its boundary', () => {
  const d = project(); edit(ST(d), '- time: 3.0–8.0', '- time: 3.0–7.0'); edit(ST(d), '- time: 8.0–14.0', '- time: 7.0–14.0');
  const r = run('check', 'script', d); assert.equal(r.code, 1); assert.match(r.out, /crosses a beat boundary/);
  const e = project(); const t = fs.readFileSync(ST(e), 'utf8').replace('- time: 21.0–25.0', '- time: 21.0–24.0').replace('- time: 25.0–30.0', '- time: 24.0–30.0'); fs.writeFileSync(ST(e), t);
  const x = run('check', 'storyboard', e); assert.equal(x.code, 1); assert.match(x.out, /beat 5 \(payoff\) ends at 24\.00 s, inside a storyboard frame/);
});
test('the style is part of what the user approved', () => {
  const d = project(); run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke'); run('submit', 'storyboard', d, '--estimate', 'r'); run('approve', 'storyboard', d, '--evidence', 'ya oke');
  assert.match(run('status', d).out, /gate storyboard\s+approved/); const r = run('set-style', d, 'midnight'); assert.equal(r.code, 0); assert.match(r.out, /storyboard approval is now stale/);
  assert.match(run('status', d).out, /gate storyboard\s+stale/); assert.equal(run('gate', 'build', d).code, 1);
  const s = JSON.parse(fs.readFileSync(path.join(d, 'Storyboard/style.json'), 'utf8')); assert.equal(s.id, 'midnight');
});
test('scaffold hands the style and the emotion table to the Remotion project', () => {
  const d = project(); run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke'); run('submit', 'storyboard', d, '--estimate', 'r'); run('approve', 'storyboard', d, '--evidence', 'ya oke');
  const r = run('scaffold', d); assert.equal(r.code, 0, r.out);
  const style = fs.readFileSync(path.join(d, 'Source/remotion/src/style.ts'), 'utf8'); assert.match(style, /id: 'flatlife'|"id": "flatlife"/); assert.match(style, /#FFE9DC/); assert.match(style, /StyleTokens/);
  assert.equal(fs.readFileSync(path.join(d, 'Source/remotion/src/emotions.ts'), 'utf8'), E.emotionsTs());
  const plan = JSON.parse(fs.readFileSync(path.join(d, 'Source/remotion/src/plan.json'), 'utf8')); assert.equal(plan.style.name, 'FLATLIFE'); assert.ok(plan.emotions.segments.length >= 6);
});

// ---------- transitions ----------
const canEncode = spawnSync(process.env.REMOVID_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=s=64x64:r=60', '-frames:v', '3', '-c:v', 'libx264', path.join(tmp, 'enc.mp4')]).status === 0;
test('assemble joins each clip with the transition planned for it', { skip: !canEncode && 'ffmpeg cannot encode h264' }, () => {
  const FF = process.env.REMOVID_FFMPEG || 'ffmpeg';
  const d = project({style: 'lantang'}); // cut style
  run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  edit(SB(d), '## Frame 3 — Solution\n- time: 8.00–14.00', '## Frame 3 — Solution\n- time: 8.00–14.00\n- transition: slide 0.4');
  edit(SB(d), '## Frame 5 — Payoff\n- time: 21.00–25.00', '## Frame 5 — Payoff\n- time: 21.00–25.00\n- transition: wipe 0.3');
  edit(SB(d), '## Frame 6 — CTA\n- time: 25.00–30.00', '## Frame 6 — CTA\n- time: 25.00–30.00\n- transition: fade 0.5');
  const c = run('check', 'storyboard', d); assert.equal(c.code, 0, c.out);
  run('submit', 'storyboard', d, '--estimate', 'r'); run('approve', 'storyboard', d, '--evidence', 'ya oke');
  fs.mkdirSync(path.join(d, 'Result/sample'), {recursive: true}); fs.writeFileSync(path.join(d, 'Result/sample/s.mp4'), 'x');
  fs.mkdirSync(path.join(d, 'Source/hyperframes'), {recursive: true}); fs.writeFileSync(path.join(d, 'Source/hyperframes/package.json'), '{}');
  const plan = JSON.parse(fs.readFileSync(path.join(d, 'Storyboard/plan.json'), 'utf8'));
  assert.deepEqual(plan.frames.map((f) => f.transition.kind), ['none', 'cut', 'slide', 'cut', 'wipe', 'fade']);
  plan.frames.forEach((f) => { const frames = Math.min(plan.totalFrames, f.endFrame + 15) - Math.max(0, f.startFrame - 15); fs.mkdirSync(path.join(d, 'Asset/scenes'), {recursive: true}); spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=s=1920x1080:r=60', '-frames:v', String(frames), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(d, 'Asset/scenes', `0${f.id}-scene.mp4`)]); });
  spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=300:d=30', path.join(d, 'Asset/agen/vo.wav')]);
  const r = run('assemble', d); assert.equal(r.code, 0, r.out); const html = fs.readFileSync(path.join(d, 'Source/hyperframes/index.html'), 'utf8');
  assert.match(html, /tl\.set\("#s2", \{opacity: 0\}, 0\);\n\s+tl\.set\("#s2", \{opacity: 1\}, 3\);/, 'cut: hidden, then shown on the boundary');
  assert.match(html, /tl\.fromTo\("#s3", \{x: 1920\}, \{x: 0, duration: 0\.4, ease: "power3\.inOut"\}, 7\.8\);/, 'slide centred on 8.0 s');
  assert.match(html, /tl\.fromTo\("#s5", \{clipPath: "inset\(0% 100% 0% 0%\)"\}, \{clipPath: "inset\(0% 0% 0% 0%\)", duration: 0\.3, ease: "power2\.inOut"\}, 20\.85\);/);
  assert.match(html, /tl\.fromTo\("#s6", \{opacity: 0\}, \{opacity: 1, duration: 0\.5, ease: "power2\.inOut"\}, 24\.75\);/, 'fade of the full overlap starts where the clip starts');
});

// ---------- the optional local speech server ----------
const V = await import(pathToFileURL(path.join(SK, 'scripts/lib-voice.mjs')).href);
const runAsync = (args, env = {}) => new Promise((resolve) => { const c = spawn('node', [PM, ...args], {env: {...process.env, ...env}}); let o = ''; c.stdout.on('data', (d) => (o += d)); c.stderr.on('data', (d) => (o += d)); c.on('close', (code) => resolve({code, out: o})); });
function fakeSpeechServer() {
  const wav = Buffer.alloc(44 + 4800); wav.write('RIFF', 0); wav.writeUInt32LE(36 + 4800, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4800, 40);
  for (let i = 0; i < 2400; i++) wav.writeInt16LE(Math.round(8000 * Math.sin(i / 6)), 44 + 2 * i);
  const seen = [];
  const srv = http.createServer((req, res) => {
    if (req.url === '/.well-known/voicestudio-speech') { res.writeHead(200, {'content-type': 'application/json'}); return res.end('{"schema":"voicestudio.speech.v1"}'); }
    if (req.method === 'POST' && req.url === '/v1/audio/speech') { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { seen.push(JSON.parse(b)); res.writeHead(200, {'content-type': 'audio/wav'}); res.end(wav); }); return; }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({url: `http://127.0.0.1:${srv.address().port}`, seen, close: () => srv.close()})));
}
test('the speech connector only talks to this machine, and starts nothing', async () => {
  assert.equal(V.assertLocal('http://127.0.0.1:3900'), 'http://127.0.0.1:3900'); assert.equal(V.assertLocal('http://localhost:3900'), 'http://localhost:3900');
  assert.throws(() => V.assertLocal('http://voice.example.com:3900'), /not a loopback address/); assert.throws(() => V.assertLocal('http://192.168.1.20:3900'), /not a loopback address/); assert.throws(() => V.assertLocal('nonsense'), /not a URL/);
  process.env.REMOVID_VOICE_ALLOW_REMOTE = '1'; assert.doesNotThrow(() => V.assertLocal('http://voice.example.com:3900')); delete process.env.REMOVID_VOICE_ALLOW_REMOTE;
  assert.deepEqual(await V.probe('http://127.0.0.1:9', 800).then((r) => [r.up, r.status]), [false, 0]);
  const d = project(); run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  const down = await runAsync(['vo-synth', d, '--url', 'http://127.0.0.1:9']); assert.equal(down.code, 1); assert.match(down.out, /no speech server answers .* removid does not start one/);
  const remote = await runAsync(['vo-synth', d, '--url', 'http://voice.example.com:3900']); assert.equal(remote.code, 1); assert.match(remote.out, /not a loopback address/);
  const gated = project(); const g = await runAsync(['vo-synth', gated, '--url', 'http://127.0.0.1:9']); assert.equal(g.code, 1); assert.match(g.out, /Gate 1/, 'no voice before the script is approved');
  const check = await runAsync(['voice-check', '--url', 'http://127.0.0.1:9']); assert.equal(check.code, 0); assert.match(check.out, /not reachable.*removid never does/); assert.match(check.out, /own audio: always possible/);
});
test('vo-synth speaks each line with a server the owner runs, translating the emotion tags it cannot read', async () => {
  const srv = await fakeSpeechServer();
  try {
    const d = project(); edit(SC(d), '[serious] Usaha kecil', '[sad] Usaha kecil'); edit(SC(d), '[excited] Yuk', '[laugh] Yuk');
    run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
    const ok = await runAsync(['voice-check', '--url', srv.url]); assert.match(ok.out, /ANSWERS/);
    const r = await runAsync(['vo-synth', d, '--url', srv.url, '--voice', 'nara']); assert.equal(r.code, 0, r.out); assert.match(r.out, /6 lines written/);
    assert.equal(srv.seen.length, 6); assert.ok(srv.seen.every((x) => x.voice === 'nara' && x.response_format === 'wav' && x.model === 'tts-1'));
    assert.equal(srv.seen[0].input, 'UMKM kamu sudah punya website?', 'warm has no reaction tag: nothing is added');
    assert.equal(srv.seen[1].input, '[sigh] Usaha kecil sulit berkembang kalau terlihat kurang profesional.', 'sad becomes the documented [sigh]');
    assert.equal(srv.seen[5].input, '[laughter] Yuk, kunjungi prvtech.id, konsultasi gratis!', 'laugh becomes [laughter]');
    assert.ok(srv.seen.every((x) => !/\[(warm|sad|serious|proud|excited|laugh)\]/.test(x.input)), 'an emotion word is never sent: the engine would read it aloud');
    for (let i = 1; i <= 6; i++) assert.ok(fs.existsSync(path.join(d, `Asset/agen/line${i}.wav`)), `line${i}.wav`);
    const lines = JSON.parse(fs.readFileSync(path.join(d, 'Asset/agen/vo-lines.json'), 'utf8')).lines; assert.equal(lines[1].engines.voicestudio, '[sigh] Usaha kecil sulit berkembang kalau terlihat kurang profesional.');
    if (hasFfmpegHere) { const dur = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(d, 'Asset/agen/line2.wav')], {encoding: 'utf8'}).stdout; const d1 = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(d, 'Asset/agen/line1.wav')], {encoding: 'utf8'}).stdout; assert.ok(parseFloat(dur) > parseFloat(d1) * 1.05, `sad (tempo 0.88) must run longer than warm (0.97): ${dur} vs ${d1}`); }
  } finally { srv.close(); }
});
const hasFfmpegHere = spawnSync(process.env.REMOVID_FFMPEG || 'ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0 && /atempo/.test(spawnSync(process.env.REMOVID_FFMPEG || 'ffmpeg', ['-hide_banner', '-filters'], {encoding: 'utf8'}).stdout || '');
test('the voice-studio line version follows its docs: reactions and pauses only, never an emotion word', () => {
  const t = (tag, text) => E.renderLine(`[${tag}] ${text}`, 'voicestudio');
  assert.equal(t('laugh', 'Halo'), '[laughter] Halo'); assert.equal(t('surprised', 'Wah'), '[surprise-oh] Wah'); assert.equal(t('mad', 'Cukup'), '[dissatisfaction-hnn] Cukup'); assert.equal(t('confused', 'Hm'), '[pause 300ms] Hm'); assert.equal(t('curious', 'Apa?'), 'Apa?');
  for (const tag of E.vocabulary()) assert.ok(!new RegExp(`\\[${tag}\\]`).test(t(tag, 'x')), `[${tag}] must never reach the engine`);
  const allowed = /^\[(laughter|sigh|surprise-oh|dissatisfaction-hnn|pause \d+ms)\]$/; const {tags} = E.loadEmotions();
  for (const [k, v] of Object.entries(tags)) if (v.voicestudio) assert.match(v.voicestudio, allowed, k);
  assert.ok(Math.abs(E.tempoFor('sad') - 0.88) < 1e-9 && E.tempoFor('excited') <= 1.12 && E.tempoFor('neutral') === 1);
});
test('an own-audio project needs no engine: vo-lines lists what to record, vo-place takes the files', () => {
  const d = project(); run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  const r = run('vo-lines', d); assert.equal(r.code, 0, r.out); assert.match(r.out, /warm/); assert.ok(fs.existsSync(path.join(d, 'Asset/agen/vo-lines.json')));
  assert.match(run('vo-place', d).out, /missing per-line audio in Asset\/agen\/[\s\S]*line1\.\*/);
});
