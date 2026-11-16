#!/usr/bin/env node
// Turn a rea-video breakdown (https://github.com/JuneYaooo/rea-video, VIDEO.md package) into the reference analysis of a removid project.
//   node clone-import.mjs <package-dir> --project <proj> [--id ref1] [--note "the user's words"] [--force]
// Reads only VIDEO.md (the card), video/timeline.md (one line per shot) and video/sound.md. Writes <proj>/Reference/<id>.analysis.md in the
// analysis template's sections and adds a row to Reference/REFERENCES.md. Nothing is installed, downloaded or run: rea-video is the user's own
// tool; this script only reads what it wrote. The structure, tempo and technique are what a reference gives; its footage, music, voice and
// words are not ours (the analysis says so).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = {}, pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (['--project', '--id', '--note'].includes(a)) { if (i + 1 >= args.length) die(`${a} needs a value`, 2); opt[a] = args[++i]; }
  else if (a === '--force') opt[a] = true;
  else if (a.startsWith('--')) die(`unknown option ${a}`, 2);
  else pos.push(a);
}
function die(msg, code = 1) { console.error(msg); process.exit(code); }
if (pos.length !== 1 || !opt['--project']) die('usage: clone-import.mjs <rea-video package dir> --project <proj> [--id ref1] [--note "..."] [--force]', 2);
const pkg = path.resolve(pos[0]), proj = path.resolve(opt['--project']);
const read = (p) => fs.readFileSync(p, 'utf8');
if (!fs.existsSync(path.join(proj, 'PROJECT.md'))) die(`${proj} is not a removid project folder (no PROJECT.md)`);
const refDir = path.join(proj, 'Reference');
if (!fs.existsSync(path.join(refDir, 'REFERENCES.md'))) die(`${path.join(refDir, 'REFERENCES.md')} is missing: run project.mjs repair first`);
for (const f of ['VIDEO.md', 'video/timeline.md']) if (!fs.existsSync(path.join(pkg, f))) die(`${pkg} is not a rea-video package: ${f} is missing (run: rea-video decompose <video> -o <dir>)`);

// ---- the card: only the keys used here, read from the YAML front matter rea-video writes (yaml.safe_dump: flat keys, one nested level)
function front(text, what) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) die(`${what} has no front matter`);
  return {head: m[1], body: text.slice(m[0].length)};
}
const unq = (v) => { v = v.trim(); if (/^'.*'$/s.test(v)) return v.slice(1, -1).replace(/''/g, "'"); if (/^".*"$/s.test(v)) return v.slice(1, -1); return v; };
function card(head) {
  const c = {readers: [], made_mix: {}, source: {}};
  let sect = null;
  for (const ln of head.split('\n')) {
    let m;
    if ((m = ln.match(/^(\w+):\s*(.*)$/))) { sect = null; if (m[2] === '') sect = m[1]; else c[m[1]] = unq(m[2]); }
    else if (sect === 'readers' && (m = ln.match(/^- (.+)$/))) c.readers.push(unq(m[1]));
    else if ((sect === 'made_mix' || sect === 'source') && (m = ln.match(/^  (\w+):\s*(.*)$/))) c[sect][m[1]] = sect === 'made_mix' ? Number(m[2]) : unq(m[2]);
  }
  return c;
}
const vm = front(read(path.join(pkg, 'VIDEO.md')), 'VIDEO.md');
const c = card(vm.head);
if (c.videomd !== '1') die(`VIDEO.md is not videomd format 1 (videomd: ${c.videomd ?? 'missing'})`);
const tl = front(read(path.join(pkg, 'video/timeline.md')), 'video/timeline.md');
const block = tl.body.match(/```videomd-timeline\n([\s\S]*?)\n```/);
if (!block) die('video/timeline.md has no ```videomd-timeline block');

// ---- the timeline: `#01 0.0-3.0 | key value | key value ...`
const KEYS = ['story', 'seen', 'act', 'layers', 'camera', 'transition', 'overlay', 'made~', 'material~', 'remake', 'flag'];
const LABELS = { // rea-video's production-method labels, English and Chinese, to its ids
  live_action: ['live action', '实拍'], ai_video: ['AI-generated video', 'AI 生成视频'], avatar: ['AI avatar (talking head)', '数字人口播'], cg_3d: ['3D render', '3D 渲染'],
  code_render: ['code / template render', '代码/模板渲染'], screen_capture: ['screen recording / screenshot', '屏幕录制/截图'], still_motion: ['still image + pan/zoom', '静态图 + 推拉动效'],
  static_hold: ['static hold', '静帧停留'], anim_2d: ['2D animation', '2D 动画'], stop_motion: ['stop motion', '定格动画'], film_footage: ['film / TV footage', '影视片段'],
};
const idOf = (label) => Object.keys(LABELS).find((k) => LABELS[k].includes(label)) || null;
const shots = [];
const lines = block[1].split('\n').filter((l) => l.trim());
if (!lines.length) die('the timeline block has no shots');
for (const ln of lines) {
  const parts = ln.split(' | ');
  const h = parts[0].match(/^#(\d+) (\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (!h) die(`cannot read the timeline line: ${ln.slice(0, 100)}\n  (expected "#01 0.0-3.0 | key value | ...")`);
  const s = {n: Number(h[1]), start: Number(h[2]), end: Number(h[3]), f: {}};
  for (const p of parts.slice(1)) {
    const sp = p.indexOf(' '), k = sp < 0 ? p : p.slice(0, sp);
    if (!KEYS.includes(k)) die(`shot #${h[1]}: unknown timeline key "${k}" (rea-video writes: ${KEYS.join(', ')}). Is this a newer VIDEO.md format?`);
    s.f[k] = sp < 0 ? '' : p.slice(sp + 1).trim();
  }
  const mm = (s.f['made~'] || '').match(/^(.*?)\s+(\d+)%/);
  s.label = mm ? mm[1] : null; s.id = s.label ? idOf(s.label) : null; s.conf = mm ? Number(mm[2]) : null;
  shots.push(s);
}
// checks that can fail: count, order, overlap, size
if (c.shots && Number(c.shots) !== shots.length) die(`the card says ${c.shots} shots, the timeline has ${shots.length}: the package is incomplete or edited`);
shots.forEach((s, i) => {
  if (s.n !== i + 1) die(`shot numbers must run 1, 2, 3 ...: found #${String(s.n).padStart(2, '0')} at position ${i + 1}`);
  if (!(s.end > s.start)) die(`shot #${s.n}: ends (${s.end}) before it starts (${s.start})`);
  if (i && s.start < shots[i - 1].end - 0.11) die(`shot #${s.n} starts at ${s.start} s, before shot #${s.n - 1} ends (${shots[i - 1].end} s)`);
});
const total = shots.at(-1).end;
if (c.source.duration && Math.abs(Number(c.source.duration) - total) > 1) die(`the card says ${c.source.duration} s, the last shot ends at ${total} s`);

// ---- id, refusal to overwrite
const id = (opt['--id'] || String(c.name || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'video');
if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) die(`--id must be lowercase letters, digits and hyphens (got "${id}")`, 2);
const out = path.join(refDir, `${id}.analysis.md`);
const refs = read(path.join(refDir, 'REFERENCES.md'));
if ((fs.existsSync(out) || refs.split('\n').some((l) => l.startsWith(`| ${id} |`))) && !opt['--force']) die(`${path.relative(proj, out)} or its row in REFERENCES.md already exists (use --force to replace it)`);

// ---- what to say
const cell = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
const sec = (n) => n.toFixed(1);
const fmtRange = (a, b) => `${sec(a)}–${sec(b)} s`;
const mixById = {};
for (const s of shots) { const k = s.id || s.label || 'unlabelled'; mixById[k] = (mixById[k] || 0) + (s.end - s.start); }
const mix = Object.entries(mixById).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${(LABELS[k]?.[0] || k)} ${Math.round((100 * v) / total)}%`);
const dominant = Object.entries(mixById).sort((a, b) => b[1] - a[1])[0][0];
const reviewed = c.readers.some((r) => r === 'agent' || r === 'model' || r === 'human');
const flagged = shots.filter((s) => s.f.flag);
const lowConf = shots.filter((s) => s.conf !== null && s.conf < 60 && !s.f.flag);
const tech = (s) => [s.f['made~'] && `${s.f['made~'].replace(/ · .*$/, '')}`, s.f.camera && s.f.camera !== '—' && !/^—$/.test(s.f.camera) && `camera ${s.f.camera}`, s.f.transition && `in: ${s.f.transition}`, s.f.overlay && `overlay ${s.f.overlay}`].filter(Boolean).join('; ');
const what = (s) => [s.f.story, s.f.seen, s.f.act && `acting: ${s.f.act}`].filter(Boolean).join(' — ') || '(not described: no image reader ran; look at the frames)';
const hook = shots.filter((s) => s.start < 3);
const trans = shots.filter((s) => s.f.transition).map((s) => `#${String(s.n).padStart(2, '0')} ${s.f.transition}`);
const cuts = shots.length - 1;
let sound = '';
const sp = path.join(pkg, 'video/sound.md');
let bpm = null;
if (fs.existsSync(sp)) {
  const body = front(read(sp), 'video/sound.md').body;
  bpm = (body.match(/(\d{2,3}(?:\.\d+)?)\s*BPM/i) || [])[1] || null;
  sound = body.split('\n').filter((l) => l.trim() && !l.startsWith('#')).slice(0, 14).map((l) => '  ' + l.trim().slice(0, 220)).join('\n');
}
// Remotion can author the shots that were drawn by code; footage, recordings and generated video must come from the user's files.
const runs = []; // consecutive shots with the same authoring answer
for (const s of shots) {
  const code = s.id === 'code_render' || s.id === 'static_hold';
  const last = runs.at(-1);
  if (last && last.code === code) last.to = s; else runs.push({code, from: s, to: s});
}
const runText = (r) => `shots #${String(r.from.n).padStart(2, '0')}${r.to !== r.from ? `–#${String(r.to.n).padStart(2, '0')}` : ''} (${fmtRange(r.from.start, r.to.end)}): ` + (r.code ? 'drawn by code in the reference: rebuild as a Remotion scene from the layout, text and timing above' : `${[...new Set(shots.filter((s) => s.n >= r.from.n && s.n <= r.to.n).map((s) => s.label || '?'))].join(' / ')}: not authored in Remotion; needs the user's own clip in Asset/owner or Raw-Footage (HyperFrames cuts it)`);

const md = [
  `# ${cell(c.name || path.basename(pkg))}: ${LABELS[dominant]?.[0] || dominant} (rea-video breakdown)`,
  `- Source (URL/file): ${cell(c.source.file || '(unknown)')}${c.source.sha256 ? ` (sha256 ${String(c.source.sha256).slice(0, 12)}…)` : ''}; rea-video package at ${pkg} | Duration / BPM: ${sec(total)} s${c.source.size ? `, ${c.source.size}` : ''}${c.source.fps ? `, ${c.source.fps} fps` : ''} / ${bpm || 'no BPM found'}`,
  `- Imported by clone-import.mjs from VIDEO.md + video/timeline.md. Made-with (inferred, by duration): ${mix.join(', ')}. Readers: ${c.readers.join(', ') || 'unknown'}; shots: ${shots.length}; cuts: ${cuts} (one every ${(total / shots.length).toFixed(1)} s).`,
  ...(reviewed ? [] : ['', `> **NOT REVIEWED BY AN IMAGE READER.** Only pixel statistics ran: "live action / AI / 3D" calls are weak and nothing says what is on screen. Look at \`${pkg}/storyboard.jpg\` and the shot sheets (\`rea-video review\`, then \`apply-review\`) before using the table below. Writing the structure from this table alone is guessing.`]),
  ...(flagged.length || lowConf.length ? ['', `> Needs a second look: ${[...flagged, ...lowConf].map((s) => `#${String(s.n).padStart(2, '0')}${s.f.flag ? ` (${s.f.flag})` : ' (low confidence)'}`).join(', ')}.`] : []),
  '',
  '## Hook (0–3 s)',
  ...hook.map((s) => `- #${String(s.n).padStart(2, '0')} ${fmtRange(s.start, Math.min(s.end, 3))}: ${what(s)}`),
  '',
  '## Structure per scene (seconds → what happens → technique)',
  '| # | time | what happens | technique (inferred) | remake route | flag |',
  '|---|---|---|---|---|---|',
  ...shots.map((s) => `| ${String(s.n).padStart(2, '0')} | ${fmtRange(s.start, s.end)} | ${cell(what(s))} | ${cell(tech(s))} | ${cell(s.f.remake)} | ${cell(s.f.flag)} |`),
  '',
  '## Transitions and sound',
  `- Cuts: ${cuts}; shot length ${sec(Math.min(...shots.map((s) => s.end - s.start)))}–${sec(Math.max(...shots.map((s) => s.end - s.start)))} s. Transitions other than a plain cut: ${trans.length ? trans.join(', ') : 'none detected'}.`,
  `- Music tempo: ${bpm ? `about ${bpm} BPM (rea-video's estimate; measure the track the user supplies, \`references/hyperframes.md\`)` : 'none found'}.`,
  ...(sound ? ['- From video/sound.md:', sound] : []),
  '',
  '## What we reuse (and how, in Remotion terms)',
  ...runs.map((r) => `- ${runText(r)}`),
  '- TODO (agent): after looking at the frames, say which beats we keep, in which order, with what idea each; this goes into Storyboard/STRUCTURE.md (Gate 1), not into this file.',
  '',
  '## What we do NOT copy',
  "- The reference's footage, picture, music, voice, logos, product and wording. Only the structure, tempo and technique above are reused; every word, number and claim of our video is ours or the user's.",
  '',
].join('\n');

fs.writeFileSync(out, md);
const row = `| ${id} | ${cell(c.source.file || path.basename(pkg))} | rea-video package (${cell(path.basename(pkg))}) | ${cell(opt['--note'] || '')} | ${id}.analysis.md |`;
const kept = refs.split('\n').filter((l) => !l.startsWith(`| ${id} |`)).join('\n').replace(/\n*$/, '\n');
fs.writeFileSync(path.join(refDir, 'REFERENCES.md'), kept + row + '\n');
console.log(`${shots.length} shots, ${sec(total)} s -> ${path.relative(process.cwd(), out) || out}\nmade with: ${mix.join(', ')}\nreaders: ${c.readers.join(', ')}`);
if (!reviewed) console.log('WARNING: no image reader has looked at this video: review it (rea-video review / apply-review) before building the structure on it.');
if (flagged.length || lowConf.length) console.log(`WARNING: ${flagged.length + lowConf.length} shot(s) flagged for a second look.`);
