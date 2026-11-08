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
  const stated = S.intake('buat motion graphics 20 detik untuk reels tentang tips hemat, narasi suara'); assert.ok(!stated.questions.some((q) => q.id === 'category'), 'stated in the brief'); assert.equal(stated.read.category, 'motion-graphics');
  assert.ok(stated.round2['motion-graphics'][0].id === 'style');
  const none = S.intake('buat video promo 30 detik untuk reels, narasi suara, gaya clay, tanpa karakter'); assert.ok(!none.questions.some((q) => q.id === 'category') && none.round2['motion-3d'].every((q) => q.id !== 'style'), 'a named style fixes the category and needs no style question');
  assert.equal(none.known.find((k) => k.field === 'duration').value, 30); assert.equal(none.known.find((k) => k.field === 'format').value, 'portrait'); assert.equal(none.known.find((k) => k.field === 'style').value, 'CLAY-3D');
  assert.ok(!none.questions.some((q) => q.id === 'proof'), '"30 detik" and "promo" are not claims');
  const open = S.intake('buat sebuah story sederhana tentang evolusi manusia dari purba hingga modern');
  assert.deepEqual(open.questions.map((q) => q.id), ['category', 'format', 'voice'], 'the type of video comes first; the style is a second round'); assert.ok(open.questions.length <= 4);
  assert.match(open.questions[0].options[0].label, /Motion 3D .*\(Recommended\)/, 'a story with a character leans to 3D');
  assert.deepEqual(Object.keys(open.round2), ['motion-graphics', 'video-editor', 'motion-3d']);
  for (const [cat, qs] of Object.entries(open.round2)) {
    assert.deepEqual(qs.map((q) => q.id), ['style', 'tech'], cat); const styleQ = qs[0], tech = qs[1]; assert.ok(styleQ.options.length <= 4 && tech.options.length <= 4 && tech.multiSelect === true, cat);
    const {styles} = S.loadStyles(); for (const o of styleQ.options.filter((x) => x.value.style !== 'other')) assert.equal(styles[o.value.style].category, cat, `${cat}: ${o.label} belongs to another category`);
    assert.match(styleQ.options.at(-1).description, /Other/); assert.match(styleQ.options[0].label, /\(Recommended\)/);
  }
  assert.ok(open.round2['video-editor'][1].options.some((o) => o.value.needs === 'footage') && !open.round2['motion-3d'][1].options.some((o) => o.value.needs === 'footage'), 'only video editing needs the user\'s footage');
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
  const r2 = run('intake', 'video tentang kopi', '--category', 'video-editor'); assert.equal(r2.code, 0, r2.out); assert.match(r2.out, /ROUND 2 for video-editor/); assert.match(r2.out, /Footage dari saya/); assert.equal(run('intake', 'x', '--category', 'nope').code, 2);
  assert.ok(JSON.parse(run('intake', 'video tentang kopi', '--category', 'motion-3d', '--json').out).questions.map((q) => q.id).join() === 'style,tech');
  assert.match(run('style', '--for', 'wayang dan legenda').out, /HIKAYAT/); assert.match(run('style', 'midnight').out, /palette: bg #0E1B3D/); assert.equal(run('style', 'zzz').code, 1);
});

// ---------- emotions ----------
test('the emotion table is complete and the voice, face and gestures agree', () => {
  const {tags, aliases} = E.loadEmotions(); const names = Object.keys(tags); assert.equal(names.length, 18, 'tuned presets');
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
  assert.equal(E.renderLine(raw, 'elevenlabs'), '[curious] Kenapa es mengapung? [laugh] Ternyata ringan.', "ElevenLabs tags are free-form: the author's own words go through");
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
  m('- emotion: serious', '- emotion: sereous', /emotion "sereous" looks like a misspelling of "serious"/);
  m('- source: remotion\n- info: Looking', '- source: footage\n- info: Looking', /source includes footage but there is no "- footage:/);
  m('- shows: The PrvTech wordmark, then a clean storefront assembling from cards.', '- shows: x', /"shows" must say what is on screen/);
  const d = project(); fs.rmSync(ST(d)); const r = run('check', 'script', d); assert.equal(r.code, 1); assert.match(r.out, /STRUCTURE\.md is missing/);
});
test('a script block must sit inside one beat and open with its emotion', () => {
  const m = (from, to, re) => { const d = project(); edit(SC(d), from, to); const r = run('check', 'script', d); assert.equal(r.code, 1, `${from} -> ${to}\n${r.out}`); assert.match(r.out, re); };
  m('\n\n[serious] Usaha', '\n\n[warm] Satu lagi.\n\n[serious] Usaha', /the script has 7 line\(s\) but STRUCTURE\.md has 6 spoken beat/);
  m('[warm] UMKM', 'UMKM', /line 1 .* no emotion tag/);
  m('[serious] Usaha kecil', 'Usaha kecil [serious] sulit', /the first tag comes after word|no emotion tag/);
  m('[proud] PrvTech', '[prowd] PrvTech', /\[prowd\]: "prowd" looks like a misspelling of "proud"/);
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
  assert.match(j.lines[3].engines.elevenlabs, /^\[excited\] Dari toko online, \[laugh\] sistem kasir/); assert.ok(!/\[/.test(j.lines[3].engines.plain)); assert.ok(!/\[/.test(j.lines[3].engines.edge.text));
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

test('a video-editing style makes a footage project; other styles do not', () => {
  const mk = (style) => { const root = path.join(tmp, 'ty' + n++); const r = run('new', 'Kopi', 'tips', '--root', root, '--format', 'portrait', '--duration', '12', '--narration', 'no', '--style', style, '--brief', 'x'); assert.equal(r.code, 0, r.out); const d = path.join(root, 'Kopi', fs.readdirSync(path.join(root, 'Kopi'))[0]); return {d, r}; };
  const e = mk('system'); assert.ok(fs.existsSync(path.join(e.d, 'Raw-Footage/SOURCES.md'))); assert.match(fs.readFileSync(path.join(e.d, 'PROJECT.md'), 'utf8'), /type: footage/); assert.match(e.r.out, /put the clips in Raw-Footage/);
  const m = mk('midnight'); assert.ok(!fs.existsSync(path.join(m.d, 'Raw-Footage'))); assert.match(fs.readFileSync(path.join(m.d, 'PROJECT.md'), 'utf8'), /type: motion/);
  assert.match(run('style', '--list', '--category', 'video-editor').out, /SYSTEM/); assert.ok(!/MIDNIGHT/.test(run('style', '--list', '--category', 'video-editor').out));
});

// ---------- the mandatory folder schema ----------
test('new creates the whole mandatory schema; a missing folder is an error and repair restores it without overwriting', () => {
  const must = ['PROJECT.md', 'Reference', 'Reference/REFERENCES.md', 'Reference/_TEMPLATE.analysis.md', 'Storyboard', 'Storyboard/STRUCTURE.md', 'Storyboard/SCRIPT.md', 'Storyboard/STORYBOARD.md', 'Asset/owner', 'Asset/agen', 'Asset/scenes', 'Asset/ASSETS.md', 'Source/remotion', 'Source/hyperframes', 'Result'];
  const d = project(); for (const f of must) assert.ok(fs.existsSync(path.join(d, f)), f); assert.ok(!fs.existsSync(path.join(d, 'Raw-Footage')), 'only footage projects have Raw-Footage');
  const root = path.join(tmp, 'ft' + n++); assert.equal(run('new', 'Kopi', 'tips', '--root', root, '--type', 'footage', '--narration', 'no', '--style', 'system', '--brief', 'x').code, 0);
  const f = path.join(root, 'Kopi', fs.readdirSync(path.join(root, 'Kopi'))[0]); assert.ok(fs.existsSync(path.join(f, 'Raw-Footage/SOURCES.md')));
  // a clone or an archive loses empty folders
  fs.rmSync(path.join(d, 'Asset/owner'), {recursive: true}); fs.rmSync(path.join(d, 'Asset/agen'), {recursive: true}); fs.rmSync(path.join(d, 'Result'), {recursive: true}); fs.rmSync(path.join(d, 'Asset/ASSETS.md'));
  for (const what of ['script', 'storyboard']) { const r = run('check', what, d); assert.equal(r.code, 1, what); assert.match(r.out, /project folder is missing: Asset\/owner\/, Asset\/agen\/, Result\/, Asset\/ASSETS\.md\. Run `project\.mjs repair/); }
  assert.match(run('status', d).out, /FOLDER INCOMPLETE: missing Asset\/owner\//); assert.equal(run('submit', 'script', d).code, 1);
  fs.writeFileSync(path.join(d, 'Reference/REFERENCES.md'), 'MY OWN NOTES'); const rep = run('repair', d); assert.equal(rep.code, 0, rep.out); assert.match(rep.out, /nothing existing was overwritten/);
  for (const x of must) assert.ok(fs.existsSync(path.join(d, x)), 'restored ' + x); assert.equal(fs.readFileSync(path.join(d, 'Reference/REFERENCES.md'), 'utf8'), 'MY OWN NOTES');
  assert.match(fs.readFileSync(path.join(d, 'Asset/ASSETS.md'), 'utf8'), /Project assets/); assert.match(run('repair', d).out, /nothing to do/); assert.equal(run('check', 'script', d).code, 0);
  assert.match(fs.readFileSync(path.join(d, 'PROJECT.md'), 'utf8'), /folder schema repaired/);
});
test('the asset ledger: files the build uses are listed, and files the storyboard names must exist', () => {
  const d = project(); let r = run('check', 'storyboard', d); assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Frame 3 \(Solution\): asset Asset\/owner\/prvtech-logo\.svg is not in the project yet/);
  fs.writeFileSync(path.join(d, 'Asset/owner/prvtech-logo.svg'), '<svg/>'); r = run('check', 'storyboard', d);
  assert.ok(!/is not in the project yet/.test(r.out)); assert.match(r.out, /not listed in Asset\/ASSETS\.md .*Asset\/owner\/prvtech-logo\.svg/);
  fs.appendFileSync(path.join(d, 'Asset/ASSETS.md'), '| prvtech-logo.svg | owner | the owner\'s logo | 3 |\n'); r = run('check', 'storyboard', d); assert.ok(!/not listed in Asset\/ASSETS\.md/.test(r.out) && !/is not in the project yet/.test(r.out));
});

// ---------- repository hygiene ----------
test('the style library in source-material mirrors styles.json, and no tracked path has a space', () => {
  const lib = path.join(ROOT, 'source-material/creative-agent-style-library/styles'); assert.ok(fs.existsSync(lib), 'source-material/creative-agent-style-library/styles');
  const slugs = fs.readdirSync(lib).flatMap((c) => fs.readdirSync(path.join(lib, c)).map((f) => f.replace(/\.md$/, ''))).sort();
  assert.deepEqual(slugs, Object.keys(S.loadStyles().styles).sort(), 'a style exists in the library or in styles.json only');
  assert.ok(!fs.existsSync(path.join(ROOT, 'NEW FOLDER SKILL AND STYLE')));
  for (const f of ['AGENTS.upstream.md', 'CLAUDE.upstream.md']) assert.ok(fs.existsSync(path.join(ROOT, 'source-material/creative-agent-style-library', f)), f);
  for (const f of ['AGENTS.md', 'CLAUDE.md']) assert.ok(!fs.existsSync(path.join(ROOT, 'source-material/creative-agent-style-library', f)), `${f} in the library would load a second workflow`);
  const g = spawnSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'}); if (g.status === 0) assert.deepEqual(g.stdout.split('\n').filter((p) => / /.test(p)), [], 'tracked paths with spaces');
});

// ---------- the clean voice script, compound tags, cutting a recording, the storyboard in words ----------
const AI = path.join(ROOT, 'tests/fixtures/ai-critical');
function aiProject() {
  const root = path.join(tmp, 'ai' + n++); const r = run('new', 'Edu', 'ai-kritis', '--root', root, '--format', 'portrait', '--duration', '38', '--narration', 'yes', '--character', 'ayu', '--style', 'flatlife', '--brief', 'x'); assert.equal(r.code, 0, r.out);
  const d = path.join(root, 'Edu', fs.readdirSync(path.join(root, 'Edu'))[0]); for (const f of ['STRUCTURE.md', 'SCRIPT.md']) fs.copyFileSync(path.join(AI, f), path.join(d, 'Storyboard', f)); return d;
}
test('the owner\'s own script, with compound tags like [thoughtful, slower], passes and comes out as a clean voice script', () => {
  const d = aiProject(); const c = run('check', 'script', d); assert.equal(c.code, 0, c.out); assert.match(c.out, /thoughtful\+slower/); assert.match(c.out, /calm\+reassuring/); assert.match(c.out, /serious\+emphatic/);
  const s = run('submit', 'script', d); assert.equal(s.code, 0, s.out); const expected = fs.readFileSync(path.join(AI, 'VO-SCRIPT.expected.txt'), 'utf8');
  assert.equal(fs.readFileSync(path.join(d, 'Asset/agen/vo-script.txt'), 'utf8'), expected, 'exactly the lines the owner pasted: tags kept, one blank line between, nothing else');
  assert.ok(s.out.includes(expected.trim()), 'the same text is printed at the stop');
  const f = fs.readFileSync(path.join(d, 'Asset/agen/vo-script.txt'), 'utf8'); assert.ok(!/\d\d\.\d|HOOK|BALANCE|Claims|##|scene|zoom/i.test(f), 'no times, labels, claims or directions in the voice script');
  assert.equal(f.trim().split(/\n\s*\n/).length, 7); assert.ok(f.trim().split(/\n\s*\n/).every((l) => /^\[[a-z, ]+\] \S/.test(l) && !l.includes('\n')), 'every line opens with its tag');
  assert.match(s.out, /show the user TWO separate things/); assert.match(s.out, /never ask how long their audio is/); assert.ok(!/Zoom highlights|Frame \d/.test(s.out), 'the storyboard is not explained at Gate 1');
  assert.equal(run('vo-script', d).out, expected); assert.ok(!/\[/.test(fs.readFileSync(path.join(d, 'Asset/agen/vo.txt'), 'utf8')), 'vo.txt stays tag-free');
  const j = JSON.parse(fs.readFileSync(path.join(d, 'Asset/agen/vo-lines.json'), 'utf8')).lines; assert.deepEqual(j[4].modifiers, ['slower']); assert.equal(j[4].engines.edge.rate, '-16%'); assert.equal(j[4].engines.elevenlabs, '[thoughtful, slower] Dan ketika semua keputusan kamu serahkan pada AI... kapan terakhir kali kamu benar-benar berpikir sendiri?');
  assert.ok(j[6].engines.elevenlabs.startsWith('[firm, emphatic] '), 'ElevenLabs gets the author\'s own words'); assert.ok(!/\[/.test(j[6].engines.edge.text));
  assert.equal(j[6].emotion, 'serious', 'firm is serious');
});
test('a misspelled word in a tag is an error with a suggestion (a new word is not)', () => {
  const m = (from, to, re) => { const d = aiProject(); edit(SC(d), from, to); const r = run('check', 'script', d); assert.equal(r.code, 1, `${from} -> ${to}\n${r.out}`); assert.match(r.out, re); };
  m('[thoughtful, slower]', '[thoughtful, slowr]', /"slowr" looks like a misspelling of "slower"/);
  m('[concerned]', '[worriedd]', /looks like a misspelling of "worried"/);
});
test('modifiers change the delivery numbers, not the emotion', () => {
  const {tags} = E.loadEmotions(); const a = E.voiceSettings('thoughtful'), b = E.voiceSettings('thoughtful', ['slower']); assert.equal(b.rate, a.rate - 8); assert.equal(E.voiceSettings('serious', ['emphatic']).volume, tags.serious.voice.volume + 3);
  assert.ok(E.moodFor('calm', ['reassuring']).face.smile > tags.calm.face.smile); assert.ok(E.moodFor('serious', ['emphatic']).body.bounce > tags.serious.body.bounce);
  assert.ok(E.moodFor('calm', ['reassuring']).face.smile <= 1 && E.moodFor('excited', ['reassuring']).face.smile <= 1, 'clamped');
  assert.ok(Math.abs(E.voiceSettings('sad', ['slower', 'slower', 'whisper']).rate) <= 20, 'the rate stays natural however many modifiers pile up');
  assert.deepEqual(E.parseTag('firm, emphatic'), {tag: 'serious', found: true, also: [], mods: ['emphatic'], free: [], typos: []}); assert.deepEqual(E.parseTag('calm reassuring'), {tag: 'calm', found: true, also: [], mods: ['reassuring'], free: [], typos: []});
});
test('vo-split cuts one recording into the line files at its pauses', { skip: !hasFfmpegHere && 'needs ffmpeg' }, () => {
  const d = project(); const wav = path.join(tmp, 'one-take.wav'); const spans = [[0.4, 2.5], [3.6, 7.0], [8.4, 13.2], [14.4, 19.8], [21.2, 23.3], [25.0, 28.0]];
  const g = spawnSync(process.env.REMOVID_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=300:d=29:r=24000', '-af', `volume='if(${spans.map(([a, b]) => `between(t,${a},${b})`).join('+')},1,0)':eval=frame`, wav]); assert.equal(g.status, 0, String(g.stderr));
  assert.equal(run('vo-split', d, wav).code, 1, 'blocked before the script is approved'); run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke');
  const r = run('vo-split', d, wav); assert.equal(r.code, 0, r.out); assert.match(r.out, /6 lines cut from 29\.00 s/);
  spans.forEach(([a, b], i) => { const f = path.join(d, `Asset/agen/line${i + 1}.wav`); assert.ok(fs.existsSync(f), f); const dur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], {encoding: 'utf8'}).stdout); assert.ok(dur >= b - a && dur <= b - a + 0.5, `line ${i + 1} is ${dur} s, speech is ${b - a} s`); });
  assert.equal(run('vo-split', d, wav).code, 1, 'it will not overwrite line files by accident'); assert.equal(run('vo-split', d, wav, '--force').code, 0);
  const fit = run('vo-place', d, '--fit'); assert.equal(fit.code, 0, fit.out); assert.match(fit.out, /6 speech segment\(s\), 6 script line\(s\)/);
  const bad = project(); run('submit', 'script', bad); run('approve', 'script', bad, '--evidence', 'ya oke'); const one = path.join(tmp, 'few.wav');
  spawnSync(process.env.REMOVID_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=300:d=10:r=24000', '-af', "volume='if(between(t,1,4)+between(t,6,9),1,0)':eval=frame", one]);
  const x = run('vo-split', bad, one); assert.equal(x.code, 1); assert.match(x.out, /found 2 speech run\(s\) but the script has 6 lines/);
});
test('explain tells the storyboard in words, and only at Gate 2', () => {
  const d = project(); const e = run('explain', d); assert.equal(e.code, 0, e.out);
  assert.match(e.out, /Frame 4 — Features demo\s+14\.00–21\.00 s/); assert.match(e.out, /On screen:\s+Dashboard with three tabs/); assert.match(e.out, /Zoom:\s+laporan-chart 18\.40–20\.90 scale=1\.5/); assert.match(e.out, /Cursor:\s+tab-toko @15\.00 click/); assert.match(e.out, /Narrator:\s+point 4\.00–6\.50 R at headline/);
  assert.match(e.out, /Zoom highlights: Frame 4: laporan-chart/); assert.match(e.out, /Still needed from the user: Asset\/owner\/prvtech-logo\.svg \(Frame 3\)/); assert.ok(!/wps|PROBLEM|## Claims/.test(e.out), 'not the script');
  run('check', 'storyboard', d); const x = e.out; assert.ok(x.length > 500);
  run('submit', 'script', d); run('approve', 'script', d, '--evidence', 'ya oke'); const s = run('submit', 'storyboard', d, '--estimate', 'r'); assert.equal(s.code, 0, s.out);
  assert.match(s.out, /STORYBOARD, in plain words/); assert.match(s.out, /explain ONLY the storyboard/); assert.match(s.out, /Delivery arc:\s+warm → serious → proud → excited → proud → excited/); assert.match(s.out, /Transition in: fade 0\.4 s/);
});

// ---------- an open vocabulary ----------
test('any emotion word works: presets are tuned, other words are placed between them, nothing is a closed list', () => {
  const E0 = E.loadEmotions(); const {tags, lexicon, aliases, valence} = E0;
  assert.ok(Object.keys(lexicon).length >= 150, 'a wide shipped lexicon'); assert.ok(E.lexiconWords().length >= 150);
  for (const [w, [v, a]] of Object.entries(lexicon)) { assert.ok(v >= -1 && v <= 1 && a >= 0 && a <= 1, `${w} point`); assert.ok(!tags[w] && !aliases[w] && !E0.modifiers[w] && !E0.modifierAliases[w], `${w} must not shadow a preset, alias or delivery word`); }
  for (const k of Object.keys(tags)) assert.ok(typeof valence[k] === 'number', `valence of ${k}`);
  for (const [w, to] of Object.entries(aliases)) assert.ok(tags[to], `alias ${w} -> ${to}`);
  const near = (w) => E.profileOf(w).nearest;
  // words land among the right presets, and fear is not anger
  assert.equal(near('furious'), 'mad'); assert.equal(near('melancholic'), 'sad'); assert.ok(['excited', 'laugh'].includes(near('ecstatic')), 'ecstatic sits between excited and laugh'); assert.equal(near('tender'), 'warm'); assert.equal(near('bored'), 'tired');
  assert.equal(E.resolveEmotion('terrified'), 'afraid', 'fear has its own face, not mad\'s'); assert.equal(E.resolveEmotion('exhausted'), 'tired'); assert.equal(E.resolveEmotion('firm'), 'serious'); assert.equal(E.resolveEmotion('zzzzzz'), null);
  for (const w of [...Object.keys(lexicon)]) { const p = E.profileOf(w); const f = p.face; assert.ok(f.smile >= -1 && f.smile <= 1 && f.brow >= -1 && f.brow <= 1 && f.raise >= 0 && f.raise <= 1 && f.eye >= 0.6 && f.eye <= 1.4 && Math.abs(f.tilt) <= 0.2, w); assert.ok(Math.abs(p.voice.rate) <= 15 && p.gestures.every((g) => ['wave', 'point', 'present'].includes(g)), w); }
  // the blend follows the point: more energetic = more energy and a faster voice; more pleasant = more smile
  assert.ok(E.profileOf('furious').energy > E.profileOf('gloomy').energy && E.profileOf('furious').voice.rate > E.profileOf('gloomy').voice.rate); assert.ok(E.profileOf('delighted').face.smile > E.profileOf('disappointed').face.smile);
  assert.ok(E.profileOf('furious').face.brow > 0.8 && E.profileOf(E.resolveEmotion('terrified')).face.raise > 0.8, 'furious frowns hard, terrified lifts its brows');
  assert.deepEqual(E.profileOf('mad'), E.profileOf(E.resolveEmotion('angry')), 'an alias is its preset exactly');
  // families: anger, fear and disgust cannot be told apart by valence and arousal alone, so the words of a family take that preset's face, scaled by intensity
  const brow = (w) => E.profileOf(w).face.brow; assert.ok(brow('furious') >= brow('indignant') && brow('indignant') > brow('irritated') && brow('irritated') >= brow('annoyed') && brow('annoyed') > 0.5, 'anger grows with intensity');
  assert.equal(near('indignant'), 'mad'); assert.equal(near('nervous'), 'afraid'); assert.ok(E.profileOf('nervous').face.raise > 0.5 && brow('nervous') < 0, 'a nervous face lifts worried brows, it does not frown'); assert.equal(near('gloomy'), 'sad'); assert.ok(E.profileOf('bored').face.eye < 0.8);
  for (const [w, v] of Object.entries(lexicon)) if (v[2]) assert.ok(tags[v[2]], `${w}: family ${v[2]} is not a preset`);
  assert.ok(E.profileOf('calm', ['afraid']).face.eye > E.profileOf('calm').face.eye && E.profileOf('calm', ['afraid']).energy > E.profileOf('calm').energy, 'a second emotion in the tag mixes in');
});
test('a new word is a warning, a misspelling is an error, and the project can define its own words', () => {
  const t = (raw) => E.parseTag(raw);
  assert.deepEqual([t('nostalgic').found, t('nostalgic').tag, t('gembira').found], [true, 'nostalgic', true]);
  assert.deepEqual([t('Applause').found, t('Applause').free, t('Applause').typos], [false, ['Applause'], []], 'unknown and not a typo: free');
  assert.equal(t('serios').typos[0].suggestion, 'serious'); assert.deepEqual(t('mad').typos, [], 'short real words are never "corrected"'); assert.deepEqual(t('excited, nervous').also, ['nervous']);
  const d = aiProject(); edit(SC(d), '[impressed] Cepat', '[Applause] Cepat'); edit(SC(d), '[curious] Pernah', '[nostalgic] Pernah'); edit(SC(d), '[concerned]', '[terrified]');
  const r = run('check', 'script', d); assert.equal(r.code, 0, r.out); assert.match(r.out, /\[Applause\] is not a known emotion: the face stays neutral/); assert.ok(!/nostalgic.*not a known/.test(r.out) && !/terrified.*not a known/.test(r.out));
  assert.match(r.out, /nostalgic\s/); assert.match(r.out, /afraid/, 'terrified is shown as afraid');
  run('submit', 'script', d); const j = JSON.parse(fs.readFileSync(path.join(d, 'Asset/agen/vo-lines.json'), 'utf8')).lines;
  assert.equal(j[0].emotion, 'nostalgic'); assert.equal(j[0].engines.elevenlabs.startsWith('[nostalgic] '), true); assert.ok(!/\[/.test(j[0].engines.edge.text)); assert.match(j[1].engines.elevenlabs, /^\[Applause\] Cepat/, 'ElevenLabs takes free-form tags as written'); assert.ok(!/Applause/.test(j[1].engines.edge.text) && !/Applause/.test(j[1].engines.voicestudio), 'engines that cannot use it never read it aloud');
  // the project's own words
  const c = aiProject(); fs.writeFileSync(path.join(c, 'Storyboard/emotions.custom.json'), JSON.stringify({bittersweet: {va: [0.1, 0.25]}, gloomish: {like: 'sad'}}));
  edit(SC(c), '[impressed] Cepat', '[bittersweet] Cepat'); edit(SC(c), '[serious] Tapi', '[gloomish] Tapi'); const k = run('check', 'script', c); assert.equal(k.code, 0, k.out); assert.ok(!/bittersweet.*not a known|gloomish.*not a known/.test(k.out)); assert.match(k.out, /bittersweet/);
  run('submit', 'script', c); const lc = JSON.parse(fs.readFileSync(path.join(c, 'Asset/agen/vo-lines.json'), 'utf8')).lines; assert.equal(lc[1].emotion, 'bittersweet'); E.loadCustomLexicon(path.join(c, 'Storyboard/emotions.custom.json')); assert.equal(E.profileOf('gloomish').nearest, 'sad'); assert.equal(E.profileOf('bittersweet').source, 'custom');
  E.setCustomLexicon({});
});
test('the plan carries an open-vocabulary delivery as numbers, so Remotion needs no table', () => {
  const d = project(); edit(SC(d), '[serious] Usaha', '[melancholic] Usaha'); edit(SC(d), '[proud] PrvTech', '[triumphant, emphatic] PrvTech');
  assert.equal(run('check', 'script', d).code, 0); const r = run('check', 'storyboard', d); assert.equal(r.code, 0, r.out);
  const plan = JSON.parse(fs.readFileSync(path.join(d, 'Storyboard/plan.json'), 'utf8')); const seg = (t) => plan.emotions.segments.find((x) => x.tag === t);
  assert.ok(seg('melancholic') && seg('triumphant')); assert.deepEqual(seg('triumphant').mods, ['emphatic']); assert.ok(seg('melancholic').face.smile < 0 && seg('triumphant').face.smile > 0.5 && seg('melancholic').energy < 0.3 && seg('triumphant').energy > 0.7);
  assert.ok(seg('triumphant').gestures.includes('present') && !seg('melancholic').gestures.includes('wave'));
});

// ---------- the skill file itself ----------
test('SKILL.md front matter is valid YAML: an unquoted value with ": " broke GitHub and strict parsers', () => {
  const t = fs.readFileSync(path.join(SK, 'SKILL.md'), 'utf8'); const m = t.match(/^---\n([\s\S]*?)\n---\n/); assert.ok(m, 'front matter'); const lines = m[1].split('\n');
  const kv = Object.fromEntries(lines.map((l) => { const i = l.indexOf(': '); return [l.slice(0, i), l.slice(i + 2)]; })); assert.equal(kv.name, 'removid', 'name equals the directory'); assert.ok(kv.description && kv['argument-hint']);
  for (const l of lines) { const v = l.slice(l.indexOf(': ') + 2); if (/^["'>|\[{]/.test(v)) continue; assert.ok(!/: |\s#/.test(v), `unquoted value with ": " or " #" is invalid YAML: ${l.slice(0, 70)}...`); }
  assert.ok(kv.description.startsWith('"') && kv.description.endsWith('"'), 'quote the description'); assert.ok(kv.description.length < 1100, 'a long description costs context in every session');
  const py = spawnSync('python3', ['-c', 'import sys,yaml; d=yaml.safe_load(sys.stdin.read()); assert d["name"]=="removid" and isinstance(d["description"],str)'], {input: m[1], encoding: 'utf8'});
  if (!/No module named/.test(py.stderr || '')) assert.equal(py.status, 0, py.stderr);
  const mut = m[1].replace('description: "', 'description: '); const yamlBad = spawnSync('python3', ['-c', 'import sys,yaml; yaml.safe_load(sys.stdin.read())'], {input: mut.replace(/"$/m, ''), encoding: 'utf8'}); if (!/No module named/.test(yamlBad.stderr || '')) assert.notEqual(yamlBad.status, 0, 'the unquoted form must fail, or this test proves nothing');
});

// ---------- which version is the agent running ----------
test('the skill carries a version, a changelog that matches it, and a command that shows it', () => {
  const v = fs.readFileSync(path.join(SK, 'VERSION'), 'utf8').trim(); assert.match(v, /^\d+\.\d+\.\d+$/);
  assert.match(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8'), new RegExp(`^## ${v.replace(/\./g, '\\.')}$`, 'm'), 'CHANGELOG top entry must be the VERSION');
  const r = run('version', '--no-fetch'); assert.equal(r.code, 0, r.out); assert.match(r.out, new RegExp(`^removid ${v.replace(/\./g, '\\.')}`)); for (const f of ['intake (two rounds)', 'checked styles', 'clean voice script', 'cut one recording', 'storyboard walkthrough', 'folder repair', 'voice routes']) assert.ok(r.out.includes(f), f);
  const j = JSON.parse(run('version', '--no-fetch', '--json').out); assert.equal(j.version, v); assert.ok(j.features.length >= 7);
  const inst = spawnSync('bash', [path.join(ROOT, 'install.sh'), '--project', path.join(tmp, 'instproj')], {encoding: 'utf8'}); assert.equal(inst.status, 0, inst.stderr); assert.ok(inst.stdout.includes(`installed removid ${v}`) && inst.stdout.includes('project.mjs version'), 'the installer says which version it installed and how to check it');
});
test('SKILL.md starts with the rules whose absence produced the wrong flow in a real session', () => {
  const t = fs.readFileSync(path.join(SK, 'SKILL.md'), 'utf8'); const body = t.slice(t.indexOf('# removid')); const start = body.indexOf('## Start here'); assert.ok(start >= 0 && start < body.indexOf('## Defaults'), 'Start here comes before everything else');
  const block = body.slice(start, body.indexOf('## Defaults'));
  for (const must of ['project.mjs version', 'BEHIND', 'Draft nothing in chat', 'VO SCRIPT', 'Tahap 1', 'no zoom ideas', 'has no seconds at all', 'Never ask where the user\'s audio is', 'messages.md']) assert.ok(block.includes(must), `Start here must say: ${must}`);
  assert.ok(t.split('\n').length <= 100, 'SKILL.md stays under 100 lines');
});

// ---------- the script has no seconds ----------
test('the script holds only what is said: no seconds, labels or directions, and it goes to a TTS as it is', () => {
  const body = (d) => fs.readFileSync(SC(d), 'utf8').split('## Claims')[0].replace(/^---[\s\S]*?---\n/, '');
  for (const proj of [project(), aiProject()]) { const b = body(proj); assert.ok(!/\d\s*[–-]\s*\d|\bdetik\b|\d\s*s\b/.test(b.replace(/^# .*$/m, '')), 'no seconds in the shipped fixtures'); assert.ok(b.trim().split(/\n\s*\n/).every((p) => /^(#.*\n\n)?\[[a-z, ]+\] /.test(p.trim()) || /^# /.test(p.trim()))); }
  const m = (from, to, re) => { const d = project(); edit(SC(d), from, to); const r = run('check', 'script', d); assert.equal(r.code, 1, `${from} -> ${to}\n${r.out}`); assert.match(r.out, re); };
  m('[warm] UMKM kamu sudah punya website?', '[00.0–03.0] HOOK\n[warm] UMKM kamu sudah punya website?', /contains seconds .*Seconds belong to STRUCTURE\.md/);
  m('UMKM kamu sudah punya website?', 'UMKM kamu sudah punya website? (3–9s)', /a time inside the line/);
  m('[warm] UMKM', '[warm] Tahap 1: UMKM', /starts with a stage label/);
  m('[warm] UMKM', '[warm] Hook (0–3s): UMKM', /a time inside the line|stage label/);
  m('Tampil rapi di mata pelanggan.', 'Tampil rapi (zoom ke laptop) di mata pelanggan.', /a stage direction in brackets/);
  m('[warm] UMKM', 'Tahap 1 [warm] UMKM', /the first tag comes after word|stage label/);
  // the budget still comes from the structure, so a line that does not fit its beat is still caught
  const d = project(); edit(ST(d), '- time: 0.0–3.0', '- time: 0.0–1.0'); edit(ST(d), '- time: 3.0–8.0', '- time: 1.0–8.0'); const r = run('check', 'script', d); assert.equal(r.code, 1); assert.match(r.out, /line 1 \(beat 1, budget 0\.00–1\.00 s\): needs ~2\.\d\d s but the window is 1\.00 s/);
  // old projects that never had a structure keep working with their timed script
  const old = project(); fs.rmSync(ST(old)); const pm = path.join(old, 'PROJECT.md'); fs.writeFileSync(pm, fs.readFileSync(pm, 'utf8').replace('structure: yes\n', '')); fs.copyFileSync(path.join(FIX, 'SCRIPT.timed.md'), SC(old));
  const o = run('check', 'script', old); assert.equal(o.code, 0, o.out); assert.ok(!/contains seconds/.test(o.out), 'a legacy project is not nagged');
  // and the same timed file in a NEW project is an error that says where the seconds go
  const nu = project(); fs.copyFileSync(path.join(FIX, 'SCRIPT.timed.md'), SC(nu)); const n2 = run('check', 'script', nu); assert.equal(n2.code, 1); assert.match(n2.out, /contains seconds/);
  // the printed VO SCRIPT has no seconds either, and the file is the same text as the script's lines
  const s = run('submit', 'script', project()); assert.equal(s.code, 0, s.out); const vo = s.out.split('================ VO SCRIPT')[1].split('================ end of VO SCRIPT')[0]; assert.ok(!/\d\s*[–-]\s*\d|\bdetik\b/.test(vo));
});
test('a new project\'s SCRIPT.md template is the plain format', () => {
  const root = path.join(tmp, 'tpl' + n++); assert.equal(run('new', 'T', 'x', '--root', root, '--narration', 'yes', '--brief', 'x').code, 0); const d = path.join(root, 'T', fs.readdirSync(path.join(root, 'T'))[0]); const t = fs.readFileSync(path.join(d, 'Storyboard/SCRIPT.md'), 'utf8');
  assert.ok(!/\[\d\d\.\d/.test(t) && !/^duration:/m.test(t), 'no seconds in the template'); assert.match(t, /THE SCRIPT IS ONLY WHAT IS SAID/); assert.match(t, /^\[curious\] TODO$/m);
  const r = run('check', 'script', d); assert.equal(r.code, 1); assert.match(r.out, /placeholder or empty|TODO/);
});
