#!/usr/bin/env node
// removid project tool: one folder per video, a script and a storyboard that are CALCULATED, and approval gates.
//   node project.mjs new <Brand> <slug> [--type motion|footage] [--format landscape|portrait|square]
//                    [--duration N] [--narration yes|no] [--voice TEXT] [--character <id>|none|undecided]
//                    --brief "the user's own words" [--root DIR]
//   node project.mjs status [project]
//   node project.mjs check script|storyboard <project>
//   node project.mjs submit script|storyboard <project> [--estimate "reason"]
//   node project.mjs approve script|storyboard|sample|final <project> --evidence "user's words"
//   node project.mjs gate voice|storyboard|build|sample|full|deliver <project>
//   node project.mjs vo <project> <audio> [--min-gap S]
//   node project.mjs vo-place <project> [--lead 0.1] [--fit] [--lufs -15]   build Asset/agen/vo.wav from Asset/agen/line1..N.* placed at each script window, then measure it
//   node project.mjs set-character <project> <id>|none   record which character narrates (id from src/characters, none = voice only)
//   node project.mjs scaffold <project> [--preview]   copy the Remotion starter into Source/remotion (needs the storyboard ACC; --preview = only to design the character)
//   node project.mjs assemble <project> [--handle 15] [--force]   write Source/hyperframes/index.html from plan.json and the clips in Asset/scenes
//   node project.mjs log <project> "note"
// <project> = a project directory, or a fragment of its name under the root. Exit 0 ok, 1 check/gate failed, 2 usage.
// Needs Node 18+. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.join(HERE, '..', 'templates', 'project');
const FPS = 60;
const SIZES = {landscape: '1920x1080', portrait: '1080x1920', square: '1440x1440'};
// Same numbers the Remotion starter enforces (templates/remotion-starter/src/lib).
const ZOOM_IN = 0.8, ZOOM_OUT = 0.7, ZOOM_GAP_MIN = 0.15, ZOOM_GAP_SOFT = 0.5, ZOOM_HOLD_SOFT = 0.5, ZOOM_SCALE_MAX = 2;
const CURSOR_MIN_TRAVEL = 0.4, CURSOR_DWELL = 0.12, CURSOR_RELEASE = 0.12, CAM_STILL_BEFORE_ARRIVAL = 0.1; // release = CLICK_RELEASE * 0.6 in lib/cursor.ts
const CURSOR_MIN_GAP = CURSOR_MIN_TRAVEL + CURSOR_DWELL + CURSOR_RELEASE; // 0.64 s between two stops
const READ_SEC_PER_WORD = 0.3, READ_MIN = 1.0;
const DEFAULT_WPS = 2.4; // spoken words per second, SPEECH ONLY (silence trimmed). Measured Edge id-ID male TTS: 2.5-3.0. Always replaced by the measured audio

const out = (s = '') => process.stdout.write(s + '\n');
const out_ = out;
const die = (msg, code = 1) => { process.stderr.write(msg + '\n'); process.exit(code); };
const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
const num = (s) => parseFloat(String(s).replace(',', '.'));
const sha = (s) => crypto.createHash('sha256').update(s.replace(/[ \t]+$/gm, '').trimEnd() + '\n').digest('hex').slice(0, 12);
const now = () => new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

// ---------- tiny front matter (flat or one level of nesting) ----------
function unq(v) { v = v.trim(); if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) return v.slice(1, -1).replace(/''/g, "'"); return v; }
function parseYaml(src) {
  const root = {}; const stack = [{indent: -1, obj: root}];
  for (const raw of src.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^ */)[0].length;
    const m = raw.trim().match(/^([\w-]+):\s*(.*)$/); if (!m) continue;
    while (stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1).obj;
    if (m[2] === '') { const o = {}; parent[m[1]] = o; stack.push({indent, obj: o}); } else parent[m[1]] = unq(m[2]);
  }
  return root;
}
function dumpYaml(obj, ind = 0) {
  const pad = ' '.repeat(ind); let s = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') s += `${pad}${k}:\n${dumpYaml(v, ind + 2)}`;
    else { const t = String(v ?? ''); s += `${pad}${k}: ${t === '' || /[:#'"\[\]{}]|^\s|\s$/.test(t) ? `'${t.replace(/'/g, "''")}'` : t}\n`; }
  }
  return s;
}
function readFront(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? {data: parseYaml(m[1]), body: text.slice(m[0].length)} : {data: {}, body: text};
}

// ---------- project lookup / state ----------
function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) opt[k] = true; else { opt[k] = n; i++; } } else pos.push(a);
  }
  return {pos, opt};
}
const rootDir = (opt) => path.resolve(opt.root || process.env.REMOVID_ROOT || './Project-Motion');
function findProject(arg, opt) {
  if (!arg) die('usage: project.mjs <command> <project> ...  (project = directory or name fragment)', 2);
  if (exists(path.join(arg, 'PROJECT.md'))) return path.resolve(arg);
  const root = rootDir(opt); const hits = [];
  if (exists(root)) for (const b of fs.readdirSync(root)) { const bd = path.join(root, b); if (!fs.statSync(bd).isDirectory()) continue; for (const p of fs.readdirSync(bd)) if (p.toLowerCase().includes(arg.toLowerCase()) && exists(path.join(bd, p, 'PROJECT.md'))) hits.push(path.join(bd, p)); }
  if (hits.length === 1) return hits[0];
  die(hits.length ? `ambiguous project "${arg}":\n  ${hits.join('\n  ')}` : `no project "${arg}" under ${root} (use a path, --root or REMOVID_ROOT)`, hits.length ? 2 : 1);
}
const P = (proj, ...r) => path.join(proj, ...r);
function loadProject(proj) { const t = read(P(proj, 'PROJECT.md')); const {data, body} = readFront(t); return {data, body}; }
function saveProject(proj, data, body) { fs.writeFileSync(P(proj, 'PROJECT.md'), `---\n${dumpYaml(data)}---\n${body}`); }
function logLine(proj, text) { const {data, body} = loadProject(proj); saveProject(proj, data, body.replace(/\s*$/, '\n') + `- ${now()} — ${text}\n`); }
const narrated = (data) => String(data.narration).toLowerCase() === 'yes';

// ---------- script ----------
const BLOCK_RE = /^\s*(?:#{1,6}\s*)?\[\s*(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*s?\s*\]\s*(.*)$/;
const cleanSpoken = (t) => t.replace(/\[[^\]]*\]/g, ' ').replace(/^[>\-\s]+/, '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
function countWords(t) {
  let n = 0;
  for (const tok of t.split(/\s+/)) {
    if (!/[\p{L}\p{N}]/u.test(tok)) continue;
    const d = tok.replace(/[.,!?;:()]+$/, '');
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(d) && !/^\d+(\.\d+)+$/.test(d)) n += d.split(/[./]/).filter(Boolean).length * 2 - 1; // "a.id" is read "a titik id"
    else n += 1;
  }
  return n;
}
function speechSec(text, wps) {
  const words = countWords(text);
  const ends = (text.match(/[.!?…](?=\s|$)/g) || []).length - (/[.!?…]\s*$/.test(text) ? 1 : 0);
  const dashes = (text.match(/\s[—–-]\s|—/g) || []).length, commas = (text.match(/,/g) || []).length;
  return words / wps + Math.max(0, ends) * 0.25 + dashes * 0.15 + commas * 0.08;
}
function parseScript(text) {
  const {data, body} = readFront(text); const blocks = []; const sections = {}; let cur = null, sec = null;
  for (const line of body.split('\n')) {
    const m = line.match(BLOCK_RE);
    if (m) { cur = {start: num(m[1]), end: num(m[2]), label: m[3].trim(), raw: []}; blocks.push(cur); sec = null; continue; }
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { cur = null; sec = h[1].trim().toLowerCase(); sections[sec] = sections[sec] || []; continue; }
    if (cur) { if (line.trim() && !line.trim().startsWith('<!--')) cur.raw.push(line.trim()); } else if (sec) sections[sec].push(line);
  }
  for (const b of blocks) { b.rawText = b.raw.join(' '); b.text = cleanSpoken(b.rawText); b.words = countWords(b.text); }
  const claims = [];
  for (const [k, lines] of Object.entries(sections)) if (k.startsWith('claims')) for (const l of lines) {
    if (!l.trim().startsWith('|')) continue;
    const c = l.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
    if (c.every((x) => /^[-: ]*$/.test(x)) || c[0].toLowerCase() === 'claim') continue;
    claims.push({claim: c[0].replace(/^["“]|["”]$/g, ''), status: (c[1] || '').toLowerCase(), source: c[2] || ''});
  }
  return {meta: data, blocks, claims};
}
const NUMBER_WORDS = 'satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|belas|puluh|ratus|ribu|juta|miliar|triliun|seratus|seribu|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion';
const CLAIM_RE = new RegExp('(\\d+(?:[.,]\\d+)?\\s*%|\\d+|\\b(?:' + NUMBER_WORDS + ')\\b|' + String.raw`\bpuluhan\b|\bratusan\b|\bribuan\b|\bjutaan\b|\bterbaik\b|\bnomor\s*1\b|\bgaransi\b|\bdijamin\b|\bterpercaya\b|\bdipercaya\b|\bterbukti\b|\bgratis\b|\bdiskon\b|\bpromo\b|\bbest\b|\bleading\b|\bguarantee[d]?\b|\btrusted\b|\bfree\b` + ')', 'gi');
const DOMAIN_RE = /\b[a-z0-9-]+\.(?:id|com|site|io|co|net|app|dev|org|ai)\b/gi;
const CTA_RE = /\b(kunjungi|daftar|hubungi|coba|klik|unduh|download|ikuti|follow|mulai|pesan|beli|chat|dm|visit|try|start|join|sign up|call|get)\b/i;
const SFX_KINDS = ['click', 'tick', 'whoosh', 'impact', 'chime'];
const STATUSES = ['verified', 'owner-confirmed', 'placeholder'];
const claimTerms = (text) => new Set([...(text.match(CLAIM_RE) || []), ...(text.match(DOMAIN_RE) || [])].map((t) => t.toLowerCase().trim()));
const claimCovered = (term, claims) => claims.some((x) => x.claim.toLowerCase().includes(term) || (x.claim.length > 2 && term.includes(x.claim.toLowerCase())));

function checkScript(proj) {
  const file = P(proj, 'Storyboard', 'SCRIPT.md'); const issues = [];
  const E = (m) => issues.push({level: 'error', msg: m}), W = (m) => issues.push({level: 'warn', msg: m}), I = (m) => issues.push({level: 'info', msg: m});
  if (!exists(file)) { E('Storyboard/SCRIPT.md is missing'); return {issues, rows: []}; }
  const {meta, blocks, claims} = parseScript(read(file));
  const proj0 = loadProject(proj).data; const talk = narrated(proj0);
  const wps = num(meta.wps) || DEFAULT_WPS; const dur = num(meta.duration) || num(proj0.target_duration);
  if (!blocks.length) { E('no timed blocks found; write them as "[00.0–03.0] HOOK" followed by the text'); return {issues, rows: []}; }
  if (!dur) E('script front matter needs duration');
  if (String(meta.narration || '').toLowerCase() !== (talk ? 'yes' : 'no')) E(`script front matter narration must equal PROJECT.md narration (${talk ? 'yes' : 'no'})`);
  const report = loadVoReport(proj); const rows = [];
  blocks.forEach((b, i) => {
    const tag = `block ${i + 1} [${f2(b.start)}–${f2(b.end)}] ${b.label}`; const win = b.end - b.start;
    if (/\b(TODO|TULIS|XXX|lorem|ipsum)\b/i.test(b.rawText) || !b.text) E(`${tag}: placeholder or empty text`);
    if (b.end <= b.start) { E(`${tag}: end must be after start`); return; }
    if (i && b.start < blocks[i - 1].end - 1e-9) E(`${tag}: overlaps the previous block (ends ${f2(blocks[i - 1].end)})`);
    if (i && b.start > blocks[i - 1].end + 1e-9) I(`${f2(b.start - blocks[i - 1].end)} s visual-only beat before ${tag}`);
    const need = talk ? speechSec(b.text, wps) : Math.max(READ_MIN, READ_SEC_PER_WORD * b.words);
    const room = Math.floor(Math.max(0, win - (talk ? 0.3 : 0)) * (talk ? wps : 1 / READ_SEC_PER_WORD));
    rows.push({i: i + 1, label: b.label, start: b.start, end: b.end, win, words: b.words, need, room});
    if (need > win) E(`${tag}: needs ~${f2(need)} s but the window is ${f2(win)} s (${b.words} words; about ${room} fit). Cut words or widen the window.`);
    else if (need > win - 0.3) W(`${tag}: needs ~${f2(need)} s of a ${f2(win)} s window, no breathing room`);
    if (talk && !report && win > 2 && need < 0.4 * win) I(`${tag}: speech fills only ${Math.round(100 * need / win)}% of the window (fine if it is a visual beat)`);
  });
  const last = blocks.at(-1);
  if (dur) { if (last.end > dur + 1e-9) E(`last block ends at ${f2(last.end)} s, after the target duration ${f2(dur)} s`); else if (dur - last.end > 1) W(`last block ends at ${f2(last.end)} s, ${f2(dur - last.end)} s before the end of ${f2(dur)} s`); }
  const totalWords = blocks.reduce((a, b) => a + b.words, 0); const totalNeed = rows.reduce((a, r) => a + r.need, 0);
  if (dur && talk) { if (totalNeed > dur) E(`total speech ~${f2(totalNeed)} s is longer than the video (${f2(dur)} s)`); else if (totalNeed > 0.85 * dur) W(`speech fills ${Math.round(100 * totalNeed / dur)}% of the video; keep it under 85% so visuals can breathe`); }
  if (blocks[0].start > 0.5) W(`the first block starts at ${f2(blocks[0].start)} s; open on the hook within 0.5 s`);
  if (blocks[0].words > 12) W(`hook has ${blocks[0].words} words; keep it under 12`);
  if (!CTA_RE.test(last.text)) W('last block has no call to action verb (visit, start, join, contact...)');
  // claims: every number / superlative / offer / domain in the text must be listed with a status
  const all = blocks.map((b) => b.text).join(' ');
  for (const t of claimTerms(all)) {
    if (!claimCovered(t, claims)) E(`"${t}" is a claim, offer, number or domain with no row in "## Claims". Add it with status verified, owner-confirmed or placeholder.`);
  }
  for (const c of claims) {
    if (!STATUSES.includes(c.status)) E(`claim "${c.claim}": status must be one of ${STATUSES.join(', ')}`);
    else if (c.status === 'placeholder') W(`claim "${c.claim}" is a PLACEHOLDER; it must be replaced or confirmed before the full render`);
    else if (!c.source) W(`claim "${c.claim}": no source noted`);
  }
  if (talk && report) {
    if (report.segments.length === blocks.length) blocks.forEach((b, i) => { const s = report.segments[i]; if (s.end > b.end + 0.05) W(`block ${i + 1}: measured speech ends ${f2(s.end)} s, after its window end ${f2(b.end)} s (storyboard windows follow the audio)`); });
    else W(`measured audio has ${report.segments.length} segments, script has ${blocks.length} blocks`);
  }
  return {issues, rows, meta: {wps, dur, totalWords, totalNeed, talk, report: !!report}};
}

// ---------- measured voice ----------
function loadVoReport(proj) {
  const f = P(proj, 'Asset', 'agen', 'vo-report.json'); if (!exists(f)) return null;
  try {
    const j = JSON.parse(read(f)); const segs = (j.segments || j.segmen || []).map((s) => ({text: s.text ?? s.teks ?? '', start: Number(s.start), end: Number(s.end)}));
    const duration = Number(j.duration ?? j.durasi); if (!segs.length || !duration) return null;
    return {duration, segments: segs, mapped: j.mapped !== false};
  } catch { return null; }
}
function ffbin(name) {
  if (name === 'ffprobe') return process.env.REMOVID_FFPROBE || 'ffprobe';
  return process.env.REMOVID_FFMPEG || process.env.HYPERFRAMES_FFMPEG_PATH || 'ffmpeg';
}
function measureVoice(proj, audio, minGap) {
  if (!exists(audio)) die(`audio file not found: ${audio}`);
  const pr = spawnSync(ffbin('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio], {encoding: 'utf8'});
  const duration = parseFloat((pr.stdout || '').trim()); if (!(duration > 0)) die(`ffprobe could not read the duration of ${audio}\n${pr.stderr || ''}`);
  // Always detect at fine resolution so the edges are exact, then merge speech runs whose gap is shorter than minGap.
  const sd = spawnSync(ffbin('ffmpeg'), ['-hide_banner', '-nostats', '-i', audio, '-af', 'silencedetect=noise=-35dB:d=0.1', '-f', 'null', '-'], {encoding: 'utf8'});
  const log = (sd.stderr || ''); if (sd.status !== 0) die(`ffmpeg silencedetect failed (a minimal ffmpeg may lack the filter; set REMOVID_FFMPEG to a full build):\n${log.split('\n').slice(-4).join('\n')}`);
  const sil = []; let st = null;
  for (const l of log.split('\n')) { let m; if ((m = l.match(/silence_start: (-?[\d.]+)/))) st = Math.max(0, parseFloat(m[1])); else if ((m = l.match(/silence_end: ([\d.]+)/)) && st !== null) { sil.push([st, parseFloat(m[1])]); st = null; } }
  if (st !== null) sil.push([st, duration]);
  const raw = []; let cur = 0;
  for (const [a, b] of sil) { if (a - cur > 0.05) raw.push([cur, a]); cur = b; }
  if (duration - cur > 0.05) raw.push([cur, duration]);
  const merge = (gap) => raw.reduce((acc, r) => { const l = acc.at(-1); if (l && r[0] - l[1] < gap) l[1] = r[1]; else acc.push([...r]); return acc; }, []);
  const script = exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? parseScript(read(P(proj, 'Storyboard', 'SCRIPT.md'))).blocks.filter((b) => b.text) : [];
  let gap = minGap, speech;
  if (gap) speech = merge(gap);
  else { // find the smallest gap that gives one run per script line
    for (const g of [0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0]) { const m = merge(g); if (m.length === script.length) { gap = g; speech = m; break; } }
    if (!speech) { gap = 0.3; speech = merge(gap); }
  }
  const mapped = speech.length === script.length && script.length > 0;
  const segments = speech.map(([a, b], i) => ({text: mapped ? script[i].text : '', start: +a.toFixed(3), end: +b.toFixed(3)}));
  const report = {source: path.basename(audio), duration: +duration.toFixed(3), mapped, minGap: gap, segments};
  fs.mkdirSync(P(proj, 'Asset', 'agen'), {recursive: true});
  fs.writeFileSync(P(proj, 'Asset', 'agen', 'vo-report.json'), JSON.stringify(report, null, 1) + '\n');
  return {report, script};
}

// Speech-only span of one audio file: where the first word starts and the last one ends (silence trimmed).
function speechSpan(file) {
  const sd = spawnSync(ffbin('ffmpeg'), ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-35dB:d=0.1', '-f', 'null', '-'], {encoding: 'utf8'});
  const log = sd.stderr || ''; if (sd.status !== 0) die(`ffmpeg silencedetect failed on ${file} (a minimal ffmpeg may lack the filter; set REMOVID_FFMPEG)`);
  const pr = spawnSync(ffbin('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}); const total = parseFloat((pr.stdout || '').trim());
  const sil = []; let st = null;
  for (const l of log.split('\n')) { let m; if ((m = l.match(/silence_start: (-?[\d.]+)/))) st = Math.max(0, parseFloat(m[1])); else if ((m = l.match(/silence_end: ([\d.]+)/)) && st !== null) { sil.push([st, parseFloat(m[1])]); st = null; } }
  if (st !== null) sil.push([st, total]);
  let a = 0, b = total;
  if (sil.length && sil[0][0] < 0.02) a = sil[0][1];
  if (sil.length && sil.at(-1)[1] >= total - 0.02) b = sil.at(-1)[0];
  return {s: a, e: Math.max(a, b), total};
}

// ---------- storyboard ----------
function parseStoryboard(text) {
  const {data, body} = readFront(text); const frames = []; let cur = null;
  for (const line of body.split('\n')) {
    const h = line.match(/^##\s+Frame\s+(\d+)\s*(?:[—–:-]\s*(.*))?$/i);
    if (h) { cur = {n: Number(h[1]), name: (h[2] || '').trim(), kv: []}; frames.push(cur); continue; }
    if (/^##\s/.test(line)) { cur = null; continue; }
    const b = cur && line.match(/^\s*-\s+([\w-]+):\s*(.*)$/); if (b) cur.kv.push([b[1].toLowerCase(), b[2].trim()]);
  }
  return {meta: data, frames};
}
const RANGE = '(\\d+(?:[.,]\\d+)?)\\s*[–—-]\\s*(\\d+(?:[.,]\\d+)?)';
const rangeOf = (s) => { const m = s.match(new RegExp('^' + RANGE)); return m ? {a: num(m[1]), b: num(m[2]), rest: s.slice(m[0].length).trim()} : null; };
const norm = (t) => cleanSpoken(t).toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

function checkStoryboard(proj) {
  const issues = []; const E = (m) => issues.push({level: 'error', msg: m}), W = (m) => issues.push({level: 'warn', msg: m}), I = (m) => issues.push({level: 'info', msg: m});
  const file = P(proj, 'Storyboard', 'STORYBOARD.md'); if (!exists(file)) { E('Storyboard/STORYBOARD.md is missing'); return {issues}; }
  const proj0 = loadProject(proj).data; const talk = narrated(proj0);
  const {meta, frames} = parseStoryboard(read(file));
  const fps = num(meta.fps) || FPS; const dur = num(meta.duration) || num(proj0.target_duration);
  if (talk && String(proj0.character).toLowerCase() === 'undecided') E('the narrator character is undecided. Design it, show the user its sheet, then `set-character <proj> <id>` (or `none` for a voice-only video).');
  if (fps !== 60 && !meta.fps_reason) E(`fps is ${fps}; the default is 60. Use 60, or set fps_reason with the user's words.`);
  if (!dur) E('storyboard front matter needs duration');
  if (meta.size && proj0.size && meta.size !== proj0.size) E(`size ${meta.size} differs from PROJECT.md ${proj0.size}`);
  if (!frames.length) { E('no "## Frame N — name" sections found'); return {issues}; }
  const report = talk ? loadVoReport(proj) : null; const wps = (exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? num(parseScript(read(P(proj, 'Storyboard', 'SCRIPT.md'))).meta.wps) : 0) || DEFAULT_WPS;
  const plan = []; const vos = [], zooms = [], curs = [], cues = [];
  frames.forEach((fr, i) => {
    const tag = `Frame ${fr.n}${fr.name ? ' (' + fr.name + ')' : ''}`;
    const get = (k) => fr.kv.filter(([x]) => x === k).map(([, v]) => v);
    const t = get('time')[0] && rangeOf(get('time')[0]);
    if (!t) { E(`${tag}: needs "- time: 0.00–3.00" in seconds`); return; }
    if (fr.n !== i + 1) E(`${tag}: frames must be numbered 1..N in order`);
    const prev = plan.at(-1);
    if (!prev && Math.abs(t.a) > 1e-9) E(`${tag}: the first frame must start at 0`);
    if (prev && Math.abs(t.a - prev.end) > 1e-9) E(`${tag}: starts at ${f2(t.a)} but the previous frame ends at ${f2(prev.end)} (${t.a > prev.end ? 'gap' : 'overlap'})`);
    if (t.b <= t.a) { E(`${tag}: end must be after start`); return; }
    if (t.b - t.a < 1 - 1e-9) W(`${tag}: lasts ${f2(t.b - t.a)} s; frames under 1 s are hard to read`);
    const sf = Math.round(t.a * fps), ef = Math.round(t.b * fps);
    const p = {id: fr.n, name: fr.name, start: t.a, end: t.b, startFrame: sf, endFrame: ef, durationFrames: ef - sf, clipFrames: ef - sf + 2 * (fps / 2), vo: [], zoom: [], cursor: [], narrator: [], text: [], sfx: []};
    plan.push(p);
    const inside = (x, y, what) => { if (x < t.a - 1e-9 || y > t.b + 1e-9) { E(`${tag}: ${what} ${f2(x)}–${f2(y)} is outside the frame ${f2(t.a)}–${f2(t.b)}`); return false; } return true; };
    for (const k of ['scene', 'engine', 'asset', 'reads']) if (!get(k).length || !get(k)[0]) E(`${tag}: missing "- ${k}:"`);
    if (get('scene')[0] && get('scene')[0].length < 8) E(`${tag}: scene description is too short to build from`);
    const eng = (get('engine')[0] || '').toLowerCase();
    if (eng && !['remotion', 'footage', 'remotion+footage'].includes(eng)) E(`${tag}: engine "${eng}" is not allowed. Remotion authors scenes (remotion); HyperFrames only cuts raw footage (footage).`);
    const vo = get('vo'); if (!vo.length) E(`${tag}: missing "- vo:" (use "- vo: none" for a silent frame)`);
    for (const v of vo) {
      if (v.toLowerCase() === 'none') { if (talk && t.b - t.a > 4) W(`${tag}: ${f2(t.b - t.a)} s without voice; say in "reads" what carries it`); continue; }
      const r = rangeOf(v); const q = v.match(/["“](.*)["”]/);
      if (!r || !q) { E(`${tag}: vo must look like: 0.30–2.60 "spoken text"`); continue; }
      if (!talk) { E(`${tag}: narration is off in PROJECT.md, so vo must be none`); continue; }
      if (!inside(r.a, r.b, 'vo')) continue;
      const e = {frame: fr.n, start: r.a, end: r.b, text: q[1].trim(), words: countWords(cleanSpoken(q[1]))}; vos.push(e); p.vo.push(e);
    }
    for (const z of get('zoom')) {
      const r = rangeOf(z.replace(/^\S+\s+/, '')); const target = z.split(/\s+/)[0];
      if (!r) { E(`${tag}: zoom must look like: target 2.10–5.30 [scale=1.6 in=0.8 out=0.7]`); continue; }
      const kvs = Object.fromEntries([...r.rest.matchAll(/(\w+)=([\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
      const e = {frame: fr.n, target, start: r.a, end: r.b, in: kvs.in ?? ZOOM_IN, out: kvs.out ?? ZOOM_OUT, scale: kvs.scale ?? 1.6};
      e.hold = e.end - e.start - e.in - e.out; zooms.push(e); p.zoom.push(e);
      if (!inside(e.start, e.end, `zoom "${target}"`)) continue;
      if (e.in < 0.6 && e.scale > 1.3) E(`${tag}: zoom "${target}" in=${e.in}s is stiff for scale ${e.scale} (min 0.6 s)`);
      if (e.in < 0.4 || e.out < 0.4) E(`${tag}: zoom "${target}" ramps must be at least 0.4 s`);
      if (e.hold < 0) E(`${tag}: zoom "${target}" window ${f2(e.end - e.start)} s is shorter than its ramps (${f2(e.in + e.out)} s)`);
      else if (e.hold < ZOOM_HOLD_SOFT) W(`${tag}: zoom "${target}" holds only ${f2(e.hold)} s; the viewer needs 0.5 s+ to read`);
      if (e.scale > ZOOM_SCALE_MAX) W(`${tag}: zoom "${target}" scale ${e.scale} > ${ZOOM_SCALE_MAX}; bitmaps look soft`);
      if (e.scale <= 1.05) W(`${tag}: zoom "${target}" scale ${e.scale} is barely visible`);
    }
    for (const c of get('cursor')) {
      const m = c.match(/^(\S+)\s+@(\d+(?:[.,]\d+)?)\s*(click|hover|move)?/i);
      if (!m) { E(`${tag}: cursor must look like: target @1.20 click`); continue; }
      const e = {frame: fr.n, target: m[1], at: num(m[2]), action: (m[3] || 'move').toLowerCase()}; if (!inside(e.at, e.at, `cursor "${e.target}"`)) continue;
      curs.push(e); p.cursor.push(e);
    }
    for (const n of get('narrator')) {
      const m = n.match(new RegExp('^(wave|point|present)\\s+' + RANGE + '(?:\\s+(L|R))?(?:\\s+at\\s+(\\S+))?', 'i'));
      if (!m) { E(`${tag}: narrator must look like: point 4.00–7.50 [L|R] at <target>`); continue; }
      const e = {frame: fr.n, kind: m[1].toLowerCase(), start: num(m[2]), end: num(m[3]), arm: (m[4] || 'R').toUpperCase(), target: m[5]};
      if (e.kind === 'point' && !e.target) E(`${tag}: a point cue needs "at <target>"`);
      if (['none', 'undecided'].includes(String(proj0.character).toLowerCase()) || !talk) E(`${tag}: narrator cue but PROJECT.md has no narrator character (character: ${proj0.character}; narration: ${proj0.narration}). Decide it with set-character.`);
      if (inside(e.start, e.end, `narrator ${e.kind}`)) { cues.push(e); p.narrator.push(e); }
    }
    for (const x of get('sfx')) {
      const m = x.match(/^(\w+)\s+@(\d+(?:[.,]\d+)?)(?:\s+gain=([\d.]+))?/);
      if (!m || !SFX_KINDS.includes(m[1].toLowerCase())) { E(`${tag}: sfx must look like: ${SFX_KINDS.join('|')} @1.20 [gain=0.6]`); continue; }
      const e = {frame: fr.n, kind: m[1].toLowerCase(), at: num(m[2]), gain: m[3] ? Number(m[3]) : 1, source: 'storyboard'};
      if (inside(e.at, e.at, `sfx ${e.kind}`)) p.sfx.push(e);
    }
    if (get('sound').length && !get('sfx').length && !get('cursor').some((c) => /click/i.test(c))) W(`${tag}: "sound:" is only a note; no "- sfx: kind @time" line, so nothing will be produced for it`);
    for (const x of get('text')) {
      const r = rangeOf(x); const q = x.match(/["“](.*)["”]/);
      if (!r || !q) { E(`${tag}: text must look like: 0.40–2.80 "ON SCREEN TEXT"`); continue; }
      const words = countWords(q[1]), need = Math.max(READ_MIN, READ_SEC_PER_WORD * words);
      if (!inside(r.a, r.b, 'text')) continue;
      if (r.b - r.a < need - 1e-9) E(`${tag}: "${q[1].slice(0, 30)}" is on screen ${f2(r.b - r.a)} s but needs ${f2(need)} s (${words} words x ${READ_SEC_PER_WORD} s, min ${READ_MIN} s)`);
      p.text.push({start: r.a, end: r.b, text: q[1], words});
    }
  });
  if (!plan.length) return {issues, plan};
  const total = plan.at(-1).end;
  if (dur && Math.abs(total - dur) > 1e-9) E(`frames end at ${f2(total)} s but duration is ${f2(dur)} s`);
  const sum = plan.reduce((a, p) => a + p.durationFrames, 0); const want = Math.round(total * fps);
  if (sum !== want) E(`frame counts add up to ${sum} but the video has ${want} frames`);

  // voice: windows fit the words, and the words are exactly the approved script
  vos.sort((a, b) => a.start - b.start);
  vos.forEach((v, k) => { if (k && v.start < vos[k - 1].end - 1e-9) E(`vo ${f2(v.start)}–${f2(v.end)} overlaps the previous vo (ends ${f2(vos[k - 1].end)})`); });
  if (talk) {
    const sc = exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? parseScript(read(P(proj, 'Storyboard', 'SCRIPT.md'))) : null;
    if (sc) {
      const a = norm(vos.map((v) => v.text).join(' ')), b = norm(sc.blocks.map((x) => x.text).join(' '));
      let d = 0; while (d < a.length && d < b.length && a[d] === b[d]) d++;
      if (a.length !== b.length || d < a.length) E(`vo text differs from Storyboard/SCRIPT.md at word ${d + 1}: storyboard "${a.slice(d, d + 4).join(' ')}" vs script "${b.slice(d, d + 4).join(' ')}"`);
    }
    if (report && report.mapped) {
      if (report.segments.length !== vos.length) E(`measured audio has ${report.segments.length} segments but the storyboard has ${vos.length} vo lines`);
      else vos.forEach((v, k) => { const s = report.segments[k]; if (s.start < v.start - 0.05 || s.end > v.end + 0.05) E(`vo ${k + 1}: measured speech ${f2(s.start)}–${f2(s.end)} does not fit the storyboard window ${f2(v.start)}–${f2(v.end)}`); else if (v.end - s.end > 1.5) W(`vo ${k + 1}: window ends ${f2(v.end - s.end)} s after the measured speech; tighten it`); });
      const speechEnd = Math.max(...report.segments.map((x) => x.end));
      if (speechEnd > total - 0.3) E(`the last word ends at ${f2(speechEnd)} s but the video ends at ${f2(total)} s; leave 0.3 s+ after the voice`);
      if (report.duration > total + 0.05) W(`the audio file is ${f2(report.duration)} s, longer than the video (${f2(total)} s); the end will be cut`);
    } else {
      if (report && !report.mapped) W('Asset/agen/vo-report.json is not mapped to the script lines; windows below are checked as estimates');
      else W('no measured audio (Asset/agen/vo-report.json): vo windows are ESTIMATES. Record or synthesize the voice, run `project.mjs vo`, then check again.');
      vos.forEach((v, k) => { const need = speechSec(cleanSpoken(v.text), wps); if (need > v.end - v.start) E(`vo ${k + 1} "${v.text.slice(0, 28)}…" needs ~${f2(need)} s at ${wps} words/s but its window is ${f2(v.end - v.start)} s`); });
      const lastVo = vos.at(-1); if (lastVo && total - lastVo.end < 0.5) W(`the video ends ${f2(total - lastVo.end)} s after the last word; hold the last frame 0.5 s+`);
    }
  }
  // on-screen text is held to the same claims rule as the spoken script
  const sc2 = exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? parseScript(read(P(proj, 'Storyboard', 'SCRIPT.md'))).claims : [];
  for (const p of plan) for (const x of p.text) for (const t of claimTerms(x.text)) if (!claimCovered(t, sc2)) E(`Frame ${p.id}: on-screen "${x.text.slice(0, 40)}" contains the claim, number or domain "${t}" with no row in SCRIPT.md "## Claims"`);
  // zoom order and gaps
  zooms.sort((a, b) => a.start - b.start);
  zooms.forEach((z, k) => { const n = zooms[k + 1]; if (!n) return; const gap = n.start - z.end;
    if (gap < -1e-9) E(`zoom "${z.target}" and "${n.target}" overlap`); else if (gap < ZOOM_GAP_MIN) E(`zoom "${z.target}" to "${n.target}": gap ${f2(gap)} s, need ≥ ${ZOOM_GAP_MIN} s`); else if (gap < ZOOM_GAP_SOFT) W(`zoom "${z.target}" out then "${n.target}" in after only ${f2(gap)} s; that reads as zoom in-out-in`); });
  // cursor: travel time, and never while the camera moves
  const byFrame = {}; curs.forEach((c) => (byFrame[c.frame] ||= []).push(c));
  for (const [fn, list] of Object.entries(byFrame)) {
    list.sort((a, b) => a.at - b.at); const fr = plan[fn - 1];
    if (list[0].at < fr.start + CURSOR_MIN_TRAVEL + 0.1) W(`Frame ${fn}: first cursor stop "${list[0].target}" at ${f2(list[0].at)} s is less than ${f2(CURSOR_MIN_TRAVEL + 0.1)} s after the frame starts`);
    list.forEach((c, k) => { if (k && c.at - list[k - 1].at < CURSOR_MIN_GAP - 1e-9) E(`Frame ${fn}: cursor "${list[k - 1].target}"→"${c.target}" gives ${f2(c.at - list[k - 1].at)} s; travel ${CURSOR_MIN_TRAVEL} s + dwell ${CURSOR_DWELL} s + click release ${CURSOR_RELEASE} s = ${f2(CURSOR_MIN_GAP)} s minimum (more for a long distance: 900 px/s)`); });
  }
  for (const c of curs) {
    const tail = c.action === 'click' ? CURSOR_DWELL : 0;
    for (const z of zooms) {
      const inEnd = z.start + z.in, outStart = z.end - z.out;
      const ok = c.at + tail <= z.start + 1e-9 || (c.at >= inEnd + CAM_STILL_BEFORE_ARRIVAL - 1e-9 && c.at + tail <= outStart + 1e-9) || c.at >= z.end + CAM_STILL_BEFORE_ARRIVAL - 1e-9;
      if (!ok) E(`cursor "${c.target}" ${c.action === 'click' ? 'click ' : ''}at ${f2(c.at)} s lands while the camera moves (zoom "${z.target}" ${f2(z.start)}–${f2(z.end)}: ramps ${f2(z.start)}–${f2(inEnd)} and ${f2(outStart)}–${f2(z.end)}). Arrive ≥ ${CAM_STILL_BEFORE_ARRIVAL} s after the zoom-in ends and click before the zoom-out starts.`);
    }
  }
  // narrator cues: one arm, one cue at a time
  cues.sort((a, b) => a.start - b.start);
  cues.forEach((c, k) => { for (let j = 0; j < k; j++) if (cues[j].arm === c.arm && cues[j].end > c.start + 1e-9) E(`narrator ${cues[j].kind} (${f2(cues[j].start)}–${f2(cues[j].end)}) and ${c.kind} (${f2(c.start)}–${f2(c.end)}) use the same arm (${c.arm}) at once`); });
  const sfx = [...plan.flatMap((p) => p.sfx), ...curs.filter((c) => c.action === 'click').map((c) => ({frame: c.frame, kind: 'click', at: +(c.at + CURSOR_DWELL).toFixed(3), gain: 1, source: 'cursor'}))].sort((a, b) => a.at - b.at);
  return {issues, plan, sfx, meta: {fps, total, vos: vos.length, zooms: zooms.length, cursor: curs.length, cues: cues.length}};
}

// ---------- gates ----------
// The script hash covers timing and words only, so updating a claim's status or a note does not cancel the approvals.
const hashScript = (proj) => (exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? sha(parseScript(read(P(proj, 'Storyboard', 'SCRIPT.md'))).blocks.map((b) => `${b.start}-${b.end} ${b.text}`).join('\n')) : '');
function hashStoryboard(proj, talk) {
  if (!exists(P(proj, 'Storyboard', 'STORYBOARD.md'))) return '';
  return sha(read(P(proj, 'Storyboard', 'STORYBOARD.md')) + (talk ? '\n#script ' + hashScript(proj) : ''));
}
function currentHash(proj, gate, data) { return gate === 'script' ? hashScript(proj) : hashStoryboard(proj, narrated(data)); }
function accState(proj, gate, data) {
  const a = data.acc?.[gate]; if (!a || !a.status || a.status === 'none') return 'none';
  const cur = gate === 'script' ? hashScript(proj) : hashStoryboard(proj, narrated(data));
  if (a.status === 'waiting') return a.hash === cur ? 'waiting' : 'stale';
  if (a.status === 'approved') {
    if (gate === 'sample' || gate === 'final') return a.hash === hashStoryboard(proj, narrated(data)) && accState(proj, 'storyboard', data) === 'approved' ? 'approved' : 'stale';
    return a.hash === cur ? 'approved' : 'stale';
  }
  return a.status;
}
function placeholders(proj) { return exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? parseScript(read(P(proj, 'Storyboard', 'SCRIPT.md'))).claims.filter((c) => c.status === 'placeholder') : []; }
const hasMp4 = (d) => exists(d) && fs.readdirSync(d).some((f) => /\.(mp4|webm|mov|gif)$/i.test(f));
function gate(proj, action) {
  const {data} = loadProject(proj); const talk = narrated(data); const why = [];
  const need = (g, label) => { const s = accState(proj, g, data); if (s !== 'approved') why.push(`${label} is ${s === 'none' ? 'not approved yet' : s === 'stale' ? 'STALE (the file changed after it was approved or submitted)' : 'waiting for the user'}`); };
  if (['voice', 'storyboard'].includes(action) && talk) need('script', 'Gate 1 (script)');
  if (['build', 'sample', 'full', 'deliver'].includes(action)) { if (talk) need('script', 'Gate 1 (script)'); need('storyboard', 'Gate 2 (storyboard)'); }
  if (['sample', 'full'].includes(action)) {
    const f = P(proj, 'Storyboard', 'plan.json');
    if (!exists(f)) why.push('Storyboard/plan.json is missing; run `check storyboard`'); else if (JSON.parse(read(f)).hash !== hashStoryboard(proj, talk)) why.push('Storyboard/plan.json is out of date; run `check storyboard`');
  }
  if (['full', 'deliver'].includes(action)) { need('sample', 'Gate 3 (sample)'); if (!hasMp4(P(proj, 'Result', 'sample'))) why.push('Result/sample has no video'); }
  if (action === 'full') { const ph = placeholders(proj); if (ph.length) why.push(`placeholder claims remain: ${ph.map((c) => '"' + c.claim + '"').join(', ')}. Replace them or get them confirmed, then update ## Claims.`); }
  if (action === 'deliver') { need('final', 'Gate 4 (final)'); const ph = placeholders(proj); if (ph.length) why.push(`placeholder claims remain: ${ph.map((c) => '"' + c.claim + '"').join(', ')}`); }
  return why;
}

// ---------- printing ----------
function printIssues(issues) {
  const order = {error: 0, warn: 1, info: 2}; const lab = {error: 'ERROR', warn: 'warn ', info: 'note '};
  for (const i of [...issues].sort((a, b) => order[a.level] - order[b.level])) out(`  ${lab[i.level]} ${i.msg}`);
  const e = issues.filter((i) => i.level === 'error').length, w = issues.filter((i) => i.level === 'warn').length;
  out(e ? `\n${e} error(s), ${w} warning(s): FAIL` : `\n0 errors, ${w} warning(s): OK`);
  return e;
}
function printScriptTable(r) {
  out('  #  window            win(s)  words  need(s)  max words');
  for (const x of r.rows) out(`  ${String(x.i).padStart(1)}  ${f2(x.start).padStart(5)}–${f2(x.end).padEnd(6)}   ${f2(x.win).padStart(5)}  ${String(x.words).padStart(5)}  ${f2(x.need).padStart(7)}  ${String(x.room).padStart(8)}  ${x.need > x.win ? '<- too long' : ''}`);
  if (r.meta) out(`  total ${r.meta.totalWords} words, ~${f2(r.meta.totalNeed)} s of ${r.meta.dur ? f2(r.meta.dur) : '?'} s at ${r.meta.wps} words/s${r.meta.report ? '' : ' (estimate until the audio is measured)'}`);
}
function printPlan(plan) {
  out('  frame  time             frames   vo words  zoom  cursor');
  for (const p of plan) out(`  ${String(p.id).padStart(5)}  ${f2(p.start).padStart(5)}–${f2(p.end).padEnd(6)}  ${String(p.durationFrames).padStart(6)}  ${String(p.vo.reduce((a, v) => a + v.words, 0)).padStart(8)}  ${String(p.zoom.length).padStart(4)}  ${String(p.cursor.length).padStart(6)}`);
}

function writePlan(proj, r, data) {
  fs.writeFileSync(P(proj, 'Storyboard', 'plan.json'), JSON.stringify({fps: r.meta.fps, size: data.size, totalSec: r.meta.total, totalFrames: Math.round(r.meta.total * r.meta.fps), hash: hashStoryboard(proj, narrated(data)), sfx: r.sfx, frames: r.plan}, null, 1) + '\n');
}

function printVoice(proj, audio, minGap, pre) {
  const {report, script} = pre || measureVoice(proj, audio, minGap);
  out(`audio ${f2(report.duration)} s, ${report.segments.length} speech segment(s), ${script.length} script line(s): ${report.mapped ? 'mapped in order' : 'NOT mapped'} ${report.minGap ? `(runs closer than ${report.minGap} s merged)` : '(exact: taken from the schedule of the placed lines)'}`);
  report.segments.forEach((s, i) => out(`  ${i + 1}. ${f2(s.start)}–${f2(s.end)}  (${f2(s.end - s.start)} s)${script[i] && report.mapped ? `  ${countWords(script[i].text)} words, ${f2(countWords(script[i].text) / (s.end - s.start))} words/s` : ''}`));
  if (!report.mapped) out('\nno gap setting gives one speech run per script line. Re-record with clear pauses between lines, or set --min-gap to try one value.');
  else { const tw = script.reduce((a, b) => a + countWords(b.text), 0), sp = report.segments.reduce((a, s) => a + (s.end - s.start), 0); out(`\nmeasured pace ${f2(tw / sp)} words/s (script assumed ${DEFAULT_WPS}; put the measured value in SCRIPT.md wps so the next script is checked against it). Write the storyboard vo windows from these times with ~0.1 s of margin.`); }
  logLine(proj, `voice measured: ${path.basename(audio)} ${f2(report.duration)} s, ${report.segments.length} segments`);
}

// ---------- commands ----------
const COMMANDS = {
  new(pos, opt) {
    const [brand, slug] = pos; if (!brand || !slug) die('usage: new <Brand> <slug> --brief "the user\'s own words" [options]', 2);
    if (!/^[A-Za-z0-9][\w-]*$/.test(brand) || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) die('Brand: letters/digits/-/_; slug: lowercase letters, digits and dashes', 2);
    if (!opt.brief || opt.brief === true) die('--brief is required: the user\'s request in their own words (no paraphrase, nothing added)', 2);
    const type = opt.type || 'motion', format = opt.format || 'landscape', narration = String(opt.narration || 'no').toLowerCase();
    const character = String(opt.character === undefined || opt.character === true ? (narration === 'yes' ? 'undecided' : 'none') : opt.character).toLowerCase();
    if (!/^(none|undecided|[a-z][a-z0-9-]*)$/.test(character)) die('--character: a character id (lowercase letters, digits, dashes), none (voice only) or undecided', 2);
    if (!['motion', 'footage'].includes(type) || !SIZES[format] || !['yes', 'no'].includes(narration)) die('--type motion|footage, --format landscape|portrait|square, --narration yes|no', 2);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); const proj = path.join(rootDir(opt), brand, `${date}-${slug}`);
    if (exists(proj)) die(`already exists: ${proj}`);
    for (const d of ['Reference', 'Storyboard', 'Asset/owner', 'Asset/agen', 'Asset/scenes', 'Source/remotion', 'Source/hyperframes', 'Result', ...(type === 'footage' ? ['Raw-Footage'] : [])]) fs.mkdirSync(P(proj, d), {recursive: true});
    const dur = num(opt.duration) || 30; const sub = (s) => s.replace(/{{brand}}/g, brand).replace(/{{slug}}/g, slug).replace(/{{duration}}/g, dur).replace(/{{narration}}/g, narration).replace(/{{size}}/g, SIZES[format]).replace(/{{wps}}/g, DEFAULT_WPS);
    const put = (from, to) => fs.writeFileSync(P(proj, to), sub(read(path.join(TPL, from))));
    put('SCRIPT.md', 'Storyboard/SCRIPT.md'); put('STORYBOARD.md', 'Storyboard/STORYBOARD.md'); put('REFERENCES.md', 'Reference/REFERENCES.md'); put('ANALYSIS.md', 'Reference/_TEMPLATE.analysis.md'); put('ASSETS.md', 'Asset/ASSETS.md'); if (type === 'footage') put('SOURCES.md', 'Raw-Footage/SOURCES.md');
    const g = () => ({status: 'none', at: '', evidence: '', hash: ''});
    const data = {project: slug, brand, title: slug, type, format, size: SIZES[format], fps: FPS, target_duration: dur, created: now(), stage: 'new', narration, voice: opt.voice || (narration === 'yes' ? 'undecided' : 'none'), character, acc: {script: g(), storyboard: g(), sample: g(), final: g()}};
    const body = `# ${slug}\n\n## Brief (the user's own words, do not paraphrase)\n> ${String(opt.brief).replace(/\n/g, '\n> ')}\n\n## Goal, audience, CTA\n-\n\n## Final decisions (do not reopen on revisions)\n-\n\n## History\n- ${now()} — project created (${type}, ${format} ${SIZES[format]}, ${dur}s, ${FPS} fps, narration ${narration})\n`;
    saveProject(proj, data, body);
    out(`created ${proj}\nnext: ${narration === 'yes' ? 'write Storyboard/SCRIPT.md, then `check script`, `submit script`, and STOP for the user' : 'analyse references, then write Storyboard/STORYBOARD.md'}`);
  },
  status(pos, opt) {
    const list = [];
    if (pos[0]) list.push(findProject(pos[0], opt)); else { const root = rootDir(opt); if (exists(root)) for (const b of fs.readdirSync(root)) { const bd = path.join(root, b); if (fs.statSync(bd).isDirectory()) for (const p of fs.readdirSync(bd)) if (exists(path.join(bd, p, 'PROJECT.md'))) list.push(path.join(bd, p)); } }
    if (!list.length) out(`no projects under ${rootDir(opt)}`);
    for (const proj of list) {
      const {data} = loadProject(proj); const talk = narrated(data);
      const rel = path.relative(process.cwd(), proj); out(`${rel && !rel.startsWith('..') ? rel : proj}\n  ${data.type} ${data.format} ${data.size} ${data.fps} fps ${data.target_duration}s  narration=${data.narration}  character=${data.character}  voice=${data.voice}`);
      const gates = [...(talk ? ['script'] : []), 'storyboard', 'sample', 'final'];
      for (const g of gates) out(`  gate ${g.padEnd(10)} ${accState(proj, g, data)}${data.acc?.[g]?.evidence ? `   "${String(data.acc[g].evidence).slice(0, 60)}"` : ''}`);
      const st = Object.fromEntries(gates.map((g) => [g, accState(proj, g, data)])); const nx = [];
      if (talk && st.script !== 'approved') nx.push(st.script === 'waiting' ? 'ask the user to approve the script' : 'write/fix SCRIPT.md: check script, submit script');
      else if (talk && String(data.character).toLowerCase() === 'undecided') nx.push('design the narrator character: scaffold --preview, npm run character -- <id>, show the sheet, set-character (or none for voice only)');
      else if (talk && !loadVoReport(proj)) nx.push('produce the voice, then `vo <project> <audio>`');
      else if (st.storyboard !== 'approved') nx.push(st.storyboard === 'waiting' ? 'ask the user to approve the storyboard' : 'write/fix STORYBOARD.md: check storyboard, submit storyboard');
      else if (!hasMp4(P(proj, 'Result', 'sample'))) nx.push('scaffold, build scenes, render the 10 s sample');
      else if (st.sample !== 'approved') nx.push(st.sample === 'waiting' ? 'waiting for the sample verdict' : 'show the sample and ask');
      else if (st.final !== 'approved') nx.push('render full, then ask for the final approval');
      else nx.push('approved; deliver');
      out(`  next: ${nx[0]}`);
    }
  },
  check(pos, opt) {
    const [what, p] = pos; if (!['script', 'storyboard'].includes(what)) die('usage: check script|storyboard <project>', 2);
    const proj = findProject(p, opt);
    if (what === 'script') { const r = checkScript(proj); if (r.rows.length) printScriptTable(r); const e = printIssues(r.issues); process.exit(e ? 1 : 0); }
    const r = checkStoryboard(proj); if (r.plan?.length) printPlan(r.plan); const e = printIssues(r.issues);
    if (!e && r.plan) { writePlan(proj, r, loadProject(proj).data); out('wrote Storyboard/plan.json (frame counts for the Remotion compositions)'); }
    process.exit(e ? 1 : 0);
  },
  submit(pos, opt) {
    const [what, p] = pos; if (!['script', 'storyboard'].includes(what)) die('usage: submit script|storyboard <project>', 2);
    const proj = findProject(p, opt); const {data, body} = loadProject(proj); const talk = narrated(data);
    if (what === 'script' && !talk) die('narration is off: there is no script gate. Submit the storyboard.');
    if (what === 'storyboard') { const why = gate(proj, 'storyboard'); if (why.length) die('cannot submit the storyboard: ' + why.join('; ')); }
    const r = what === 'script' ? checkScript(proj) : checkStoryboard(proj);
    if (what === 'script') printScriptTable(r); else if (r.plan) printPlan(r.plan);
    const e = printIssues(r.issues); if (e) die('\nfix the errors, then submit again.');
    if (what === 'storyboard' && talk && !loadVoReport(proj) && !opt.estimate) die('\nno measured audio. Produce the voice and run `vo` first, or pass --estimate "the user\'s reason" (for example: the user records later and the visuals are fitted to the real file).');
    if (opt.estimate && opt.estimate !== true) logLine(proj, `storyboard submitted on ESTIMATED voice timing: ${opt.estimate}`);
    const f = P(proj, 'Storyboard', what === 'script' ? 'SCRIPT.md' : 'STORYBOARD.md'); const ts = now().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
    fs.copyFileSync(f, f.replace(/\.md$/, `.submitted-${ts}.md`));
    if (what === 'script') fs.writeFileSync(P(proj, 'Asset', 'agen', 'vo.txt'), parseScript(read(f)).blocks.map((b) => b.text).join('\n') + '\n');
    if (what === 'storyboard') writePlan(proj, r, data);
    const fresh = loadProject(proj); fresh.data.acc[what] = {status: 'waiting', at: now(), evidence: '', hash: currentHash(proj, what, fresh.data)}; fresh.data.stage = `acc-${what}`; saveProject(proj, fresh.data, fresh.body);
    logLine(proj, `${what} submitted (hash ${fresh.data.acc[what].hash}), waiting for the user`);
    out(`\nSUBMITTED ${what}. STOP: show the user the table and the warnings above and wait for their answer. Do not continue until they approve in their own words.`);
  },
  approve(pos, opt) {
    const [what, p] = pos; if (!['script', 'storyboard', 'sample', 'final'].includes(what)) die('usage: approve script|storyboard|sample|final <project> --evidence "..."', 2);
    const proj = findProject(p, opt); const {data, body} = loadProject(proj);
    const ev = opt.evidence === true ? '' : String(opt.evidence || '').trim(); if (ev.length < 3) die('--evidence is required: the user\'s own words approving this, quoted. Silence, a teammate\'s message or your own judgement is not approval.', 2);
    const s = accState(proj, what, data);
    if (what === 'script' || what === 'storyboard') { if (s !== 'waiting') die(`cannot approve ${what}: state is ${s}. ${s === 'stale' ? 'The file changed after submit; check and submit again.' : 'Submit it first.'}`); }
    else { const why = gate(proj, what === 'sample' ? 'build' : 'sample'); if (what === 'sample' && !hasMp4(P(proj, 'Result', 'sample'))) why.push('Result/sample has no video'); if (what === 'final' && (accState(proj, 'sample', data) !== 'approved' || !fs.readdirSync(P(proj, 'Result')).some((d) => /^v\d+$/.test(d) && hasMp4(P(proj, 'Result', d))))) why.push('needs an approved sample and a full render in Result/vN'); if (why.length) die(`cannot approve ${what}: ${why.join('; ')}`); }
    data.acc[what] = {status: 'approved', at: now(), evidence: ev, hash: what === 'sample' || what === 'final' ? hashStoryboard(proj, narrated(data)) : currentHash(proj, what, data)};
    data.stage = `${what}-approved`; saveProject(proj, data, body); logLine(proj, `${what} APPROVED by the user: "${ev}"`); out(`approved ${what}`);
  },
  gate(pos, opt) {
    const [action, p] = pos; if (!['voice', 'storyboard', 'build', 'sample', 'full', 'deliver'].includes(action)) die('usage: gate voice|storyboard|build|sample|full|deliver <project>', 2);
    const why = gate(findProject(p, opt), action);
    if (why.length) { out(`GATE ${action}: BLOCKED`); why.forEach((w) => out('  - ' + w)); process.exit(1); }
    out(`GATE ${action}: open`);
  },
  vo(pos, opt) {
    const [p, audio] = pos; if (!audio) die('usage: vo <project> <audio> [--min-gap S]', 2);
    const proj = findProject(p, opt); const {data} = loadProject(proj);
    if (!narrated(data)) die('narration is off for this project');
    const why = gate(proj, 'voice'); if (why.length) die('blocked: ' + why.join('; '));
    printVoice(proj, path.resolve(audio), num(opt['min-gap']) || 0);
  },
  'vo-place'(pos, opt) {
    const proj = findProject(pos[0], opt); const {data} = loadProject(proj);
    if (!narrated(data)) die('narration is off for this project');
    const why = gate(proj, 'voice'); if (why.length) die('blocked: ' + why.join('; '));
    const sc = parseScript(read(P(proj, 'Storyboard', 'SCRIPT.md'))); const blocks = sc.blocks.filter((b) => b.text);
    const lead = opt.lead === undefined ? 0.1 : num(opt.lead); const dur = num(sc.meta.duration) || num(data.target_duration);
    const GAP = 0.35, TAIL = 0.5;
    const dir = P(proj, 'Asset', 'agen'); const files = [], missing = [];
    blocks.forEach((b, i) => { const f = fs.existsSync(dir) && fs.readdirSync(dir).find((x) => new RegExp(`^line${i + 1}\\.(mp3|wav|m4a|ogg|opus|flac)$`, 'i').test(x)); if (f) files.push(path.join(dir, f)); else missing.push(`line${i + 1}.* (${blocks[i].label}: "${blocks[i].text.slice(0, 40)}")`); });
    if (missing.length) die(`missing per-line audio in Asset/agen/:\n  ${missing.join('\n  ')}\nSynthesize or record one file per script block (text in Asset/agen/vo.txt, one line per block).`);
    // when does each line's SPEECH want to start, and how long does it really take?
    const spans = files.map(speechSpan); const durs = spans.map((x) => x.e - x.s);
    let start = blocks.map((b, i) => Math.max(b.start + lead, spans[i].s)); // a file's own leading silence cannot be removed by a negative delay
    const overflow = blocks.map((b, i) => start[i] + durs[i] - b.end).map((d, i) => ({i, d})).filter((x) => x.d > 0.02);
    if (opt.fit) { // push lines apart from the front, then pull the tail back so the last word ends TAIL s before the end
      for (let i = 1; i < start.length; i++) start[i] = Math.max(start[i], start[i - 1] + durs[i - 1] + GAP);
      let limit = dur - TAIL;
      for (let i = start.length - 1; i >= 0; i--) { start[i] = Math.min(start[i], limit - durs[i]); limit = start[i] - GAP; }
      if (start[0] < 0.05 || start.some((x, i) => i && x < start[i - 1] + durs[i - 1] + GAP - 1e-6)) die(`the lines cannot be fitted into ${dur} s: speech takes ${f2(durs.reduce((a, b) => a + b, 0))} s plus gaps. Shorten the script or speed up the voice.`);
    }
    out('  #  window            speech  starts  ends    fits its window');
    blocks.forEach((b, i) => out(`  ${i + 1}  ${f2(b.start).padStart(5)}–${f2(b.end).padEnd(6)}  ${f2(durs[i]).padStart(6)}  ${f2(start[i]).padStart(6)}  ${f2(start[i] + durs[i]).padStart(6)}  ${start[i] + durs[i] <= b.end + 0.02 && start[i] >= b.start - 0.02 ? 'yes' : 'no (outside its script window; the storyboard windows follow the audio)'}`));
    if (overflow.length && !opt.fit) die(`\n${overflow.length} line(s) do not fit their script window: ${overflow.map((x) => `line ${x.i + 1} by ${f2(x.d)} s`).join(', ')}. Run with --fit to reschedule the lines (the approved script stays untouched), or shorten them.`);
    // TTS lines differ in level; level each line to the target so the voice is even from line to line.
    // Measured the way the video carries it: the voice copied unattenuated to left and right (a mono file reads 3 dB louder that way).
    const lufsOf = (f) => { const m = spawnSync(ffbin('ffmpeg'), ['-hide_banner', '-nostats', '-i', f, '-af', 'pan=stereo|c0=c0|c1=c0,ebur128', '-f', 'null', '-'], {encoding: 'utf8'}); const x = ((m.stderr || '').match(/\n\s+I:\s+(-?[\d.]+) LUFS/g) || []).pop(); return x ? parseFloat(x.match(/-?[\d.]+/)[0]) : null; };
    const target = opt.lufs && opt.lufs !== true ? num(opt.lufs) : null;
    const gains = files.map((f) => { if (target === null) return 0; const l = lufsOf(f); if (l === null || !isFinite(l)) die('cannot measure loudness (a minimal ffmpeg lacks ebur128; set REMOVID_FFMPEG to a full build)'); return target - l; });
    if (target !== null) out(`  levelling each line to ${target} LUFS: ${gains.map((g) => (g >= 0 ? '+' : '') + g.toFixed(1)).join(', ')} dB`);
    const chains = blocks.map((b, i) => `[${i}:a]volume=${gains[i].toFixed(2)}dB,aformat=sample_rates=48000:channel_layouts=mono,adelay=${Math.max(0, Math.round((start[i] - spans[i].s) * 1000))}:all=1[a${i}]`);
    const mix = `${blocks.map((_, i) => `[a${i}]`).join('')}amix=inputs=${blocks.length}:normalize=0,apad=whole_dur=${dur},atrim=0:${dur},pan=stereo|c0=c0|c1=c0${target !== null ? ',alimiter=limit=0.84:level=disabled' : ''}[o]`;
    const outFile = P(dir, 'vo.wav'); const r = spawnSync(ffbin('ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', [...chains, mix].join(';'), '-map', '[o]', '-ar', '48000', '-ac', '2', outFile], {encoding: 'utf8'});
    if (r.status !== 0) die('ffmpeg failed:\n' + (r.stderr || '').split('\n').slice(-5).join('\n'));
    if (target !== null) out(`  voice track now ${lufsOf(outFile)} LUFS`);
    out(`\nplaced ${blocks.length} lines${opt.fit ? ' (fitted)' : ` at their script windows (+${lead} s)`} -> Asset/agen/vo.wav (${dur} s)`);
    if (opt.fit) logLine(proj, `voice lines rescheduled with --fit (gap ${GAP} s, tail ${TAIL} s); script windows unchanged`);
    // The schedule is exact, so the report comes from it; re-detecting silence would split a line at its inner pause.
    const report = {source: 'vo-place', duration: dur, mapped: true, minGap: 0, segments: blocks.map((b, i) => ({text: b.text, start: +start[i].toFixed(3), end: +(start[i] + durs[i]).toFixed(3)}))};
    fs.writeFileSync(P(dir, 'vo-report.json'), JSON.stringify(report, null, 1) + '\n');
    printVoice(proj, outFile, 0, {report, script: blocks});
  },
  scaffold(pos, opt) {
    const proj = findProject(pos[0], opt); const dest = P(proj, 'Source', 'remotion'); fs.mkdirSync(dest, {recursive: true});
    const {data} = loadProject(proj); const has = exists(P(dest, 'package.json'));
    if (opt.preview) { // character design happens before the storyboard: the starter is needed to render the character sheet, nothing is built
      if (!narrated(data)) die('--preview is for designing the narrator character; narration is off');
      if (has) die('Source/remotion already holds the starter');
    } else {
      const why = gate(proj, 'build'); if (why.length) { out('GATE build: BLOCKED'); why.forEach((w) => out('  - ' + w)); process.exit(1); }
    }
    if (!has) {
      if (fs.readdirSync(dest).length) die(`${dest} is not empty and has no package.json`);
      const r = spawnSync('bash', [path.join(HERE, 'new-project.sh'), dest, '--no-install'], {encoding: 'utf8'}); process.stdout.write(r.stdout || ''); if (r.status !== 0) die(r.stderr || 'new-project.sh failed');
    }
    if (opt.preview) { logLine(proj, 'Remotion starter copied for character design only (scaffold --preview); no scenes are built before Gate 2'); out('\npreview only: npm install in Source/remotion, then `npm run character -- <id>` and show the sheet. Scenes wait for Gate 2.'); return; }
    if (exists(P(proj, 'Storyboard', 'plan.json'))) fs.copyFileSync(P(proj, 'Storyboard', 'plan.json'), P(dest, 'src', 'plan.json'));
    logLine(proj, has ? 'plan.json refreshed in Source/remotion/src' : 'Remotion starter scaffolded into Source/remotion (plan.json copied to src/plan.json)'); out(`\n${has ? 'plan.json refreshed' : 'run `npm install` in Source/remotion'}; compositions take their length from src/plan.json (frames[n].durationFrames).`);
  },
  assemble(pos, opt) {
    const proj = findProject(pos[0], opt); const {data} = loadProject(proj); const talk = narrated(data);
    const why = gate(proj, 'sample'); if (why.length) { out('GATE build: BLOCKED'); why.forEach((w) => out('  - ' + w)); process.exit(1); }
    const plan = JSON.parse(read(P(proj, 'Storyboard', 'plan.json'))); const handle = opt.handle === undefined ? 15 : Number(opt.handle);
    const [W, H] = String(plan.size).split('x').map(Number); const fps = plan.fps; const hf = P(proj, 'Source', 'hyperframes');
    if (!exists(P(hf, 'package.json')) && !exists(P(hf, 'hyperframes.json'))) die(`Source/hyperframes is not a HyperFrames project yet. Run (once): cd ${hf} && npx -y hyperframes init . --example blank --non-interactive --skip-skills --skip-transcribe`);
    const target = P(hf, 'index.html'); const MARK = '<!-- generated by project.mjs assemble -->';
    if (exists(target) && !opt.force) { const t = read(target); if (!t.includes(MARK) && !(t.includes('Placeholders: replace all three') && /id="title"/.test(t))) die('Source/hyperframes/index.html was edited by hand; pass --force to replace it'); }
    const sdir = P(proj, 'Asset', 'scenes'); const problems = []; const clips = [];
    for (const f of plan.frames) {
      const nn = String(f.id).padStart(2, '0'); const file = exists(sdir) && fs.readdirSync(sdir).find((x) => x.startsWith(nn + '-') && /\.(mp4|mov|webm)$/i.test(x));
      const from = Math.max(0, f.startFrame - handle), to = Math.min(plan.totalFrames, f.endFrame + handle);
      if (!file) { problems.push(`Frame ${f.id}: no clip Asset/scenes/${nn}-*.mp4`); continue; }
      const pr = spawnSync(ffbin('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames', '-of', 'csv=p=0', P(sdir, file)], {encoding: 'utf8'});
      const [w, h, rate, nb] = (pr.stdout || '').trim().split(',');
      if (pr.status !== 0 || !w) { problems.push(`Frame ${f.id}: ffprobe cannot read ${file}`); continue; }
      const [rn, rd] = String(rate).split('/').map(Number);
      if (Number(w) !== W || Number(h) !== H) problems.push(`Frame ${f.id}: ${file} is ${w}x${h}, the plan says ${W}x${H}`);
      if (Math.abs(rn / (rd || 1) - fps) > 0.01) problems.push(`Frame ${f.id}: ${file} is ${f2(rn / (rd || 1))} fps, the plan says ${fps}`);
      if (Number(nb) !== to - from) problems.push(`Frame ${f.id}: ${file} has ${nb} frames, the plan needs ${to - from} (frames ${from}..${to - 1}); render it again from plan.json`);
      clips.push({id: f.id, file, from, to});
    }
    if (problems.length) { problems.forEach((x) => out('  ERROR ' + x)); die(`\n${problems.length} problem(s): fix the clips, then assemble again.`); }
    fs.mkdirSync(P(hf, 'assets', 'scenes'), {recursive: true}); fs.mkdirSync(P(hf, 'assets', 'audio'), {recursive: true});
    clips.forEach((c) => fs.copyFileSync(P(sdir, c.file), P(hf, 'assets', 'scenes', c.file)));
    const agen = P(proj, 'Asset', 'agen'); const audio = [];
    const voFile = talk && exists(agen) && fs.readdirSync(agen).find((x) => /^vo\.(wav|mp3|m4a|ogg|flac)$/i.test(x)); if (talk && !voFile) die('narrated project but Asset/agen/vo.(wav|mp3|...) is missing');
    if (voFile) audio.push({id: 'vo', file: voFile, track: 9}); if (exists(P(agen, 'sfx.wav'))) audio.push({id: 'sfx', file: 'sfx.wav', track: 8});
    audio.forEach((a) => fs.copyFileSync(P(agen, a.file), P(hf, 'assets', 'audio', a.file)));
    const total = plan.totalSec; const xf = (2 * handle) / fps;
    const vids = clips.map((c) => `      <video id="s${c.id}" class="clip" src="assets/scenes/${c.file}" data-start="${+(c.from / fps).toFixed(4)}" data-duration="${+((c.to - c.from) / fps).toFixed(4)}" data-media-start="0" data-track-index="${c.id - 1}" data-has-audio="false" muted></video>`).join('\n');
    const auds = audio.map((a) => `      <audio id="${a.id}" src="assets/audio/${a.file}" data-start="0" data-duration="${total}" data-track-index="${a.track}"></audio>`).join('\n');
    const fades = clips.slice(1).map((c) => `      tl.fromTo("#s${c.id}", {opacity: 0}, {opacity: 1, duration: ${+xf.toFixed(4)}, ease: "power2.inOut"}, ${+(c.from / fps).toFixed(4)});`).join('\n');
    const html = `<!doctype html>
${MARK}
<html lang="en" data-resolution="${W >= H ? 'landscape' : 'portrait'}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
${vids}
${auds}
    </div>
    <script>
      // Generated from Storyboard/plan.json: each clip carries ${handle} frames of picture on both sides of its range, and the next clip fades in over the overlap.
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({paused: true});
${fades}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
    fs.writeFileSync(target, html);
    out('  clip  file                      data-start  data-duration  frames');
    clips.forEach((c) => out(`  ${String(c.id).padStart(4)}  ${c.file.padEnd(24)}  ${f2(c.from / fps).padStart(10)}  ${f2((c.to - c.from) / fps).padStart(13)}  ${c.from}..${c.to - 1}`));
    out(`  audio: ${audio.map((a) => a.file).join(', ') || 'none'}   crossfade ${f2(xf)} s   total ${total} s\nwrote Source/hyperframes/index.html. Next: npx hyperframes check, then render with --fps ${fps}.`);
    logLine(proj, `HyperFrames index.html generated from plan.json (${clips.length} clips, handle ${handle} frames)`);
  },
  'set-character'(pos, opt) {
    const [p, id] = pos; const c = String(id || '').toLowerCase();
    if (!/^(none|[a-z][a-z0-9-]*)$/.test(c)) die('usage: set-character <project> <id>|none   (id = lowercase letters, digits, dashes)', 2);
    const proj = findProject(p, opt); const {data, body} = loadProject(proj);
    if (c !== 'none' && !narrated(data)) die('narration is off for this project; a character needs a voice');
    data.character = c; saveProject(proj, data, body); logLine(proj, `character set to ${c}`); out(`character: ${c}`);
  },
  log(pos, opt) { const [p, ...t] = pos; if (!t.length) die('usage: log <project> "note"', 2); logLine(findProject(p, opt), t.join(' ')); out('logged'); },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !COMMANDS[cmd]) die(`usage: project.mjs ${Object.keys(COMMANDS).join('|')} ...  (see the header of this file)`, 2);
const {pos, opt} = parseArgs(rest);
COMMANDS[cmd](pos, opt);
