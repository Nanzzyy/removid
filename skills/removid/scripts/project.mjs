#!/usr/bin/env node
// removid project tool: one folder per video, a script and a storyboard that are CALCULATED, and approval gates.
//   node project.mjs new <Brand> <slug> [--type motion|footage] [--format landscape|portrait|square]
//                    [--duration N] [--narration yes|no] [--voice TEXT] [--character <id>|none|undecided] [--style NAME] [--language id-ID]
//                    --brief "the user's own words" [--root DIR]
//   node project.mjs intake "<the user's brief>" [--json]   what the brief already says, what is assumed, and the (at most 4) questions still worth asking
//   node project.mjs style [name] [--list] [--for "<brief>"]   style card, the 36 styles, or the styles that fit a brief
//   node project.mjs set-style <project> <name>   fix the video style (tokens go to Storyboard/style.json and the Remotion starter)
//   node project.mjs vo-lines <project> [--engine plain|edge|elevenlabs|chatterbox|voicestudio]   per-line text and voice settings from the script's emotion tags
//   node project.mjs vo-script <project>   the CLEAN voice script: only the lines with their emotion tags, a blank line between, nothing else (Asset/agen/vo-script.txt)
//   node project.mjs vo-split <project> <audio> [--min-gap S] [--force]   cut ONE recording into Asset/agen/line1..N.wav at the pauses (the user's TTS output, cut for them)
//   node project.mjs explain <project>   the storyboard in plain words, frame by frame (what is on screen, zoom highlights, transitions): what to tell the user at Gate 2
//   node project.mjs version [--json] [--no-fetch]   the skill version this agent is running, its features, and whether it is behind origin/main
//   node project.mjs voice-check [--url URL]   read-only: which voice routes exist here (agent default, a local speech server, the user's own audio)
//   node project.mjs vo-synth <project> [--url URL] [--voice NAME]   OPTIONAL: speak each line with a local speech server the owner already runs (loopback only; installs nothing)
//   node project.mjs repair <project>   recreate any missing mandatory folder or template file (never overwrites)
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
import {resolveStyle, loadStyles, recommend, intake as intakeBrief, TRANSITIONS} from './lib-style.mjs';
import {voiceUrl, probe, synth, assertLocal} from './lib-voice.mjs';
import {canonical, resolveEmotion, typoOf, loadCustomLexicon, lexiconWords, suggest, suggestAny, vocabulary, modifiers as allModifiers, extractTags, renderLine, edgeArgs, timeline as emoTimeline, energy as emoEnergy, loadEmotions, emotionsTs, tempoFor, ENGINES} from './lib-emotion.mjs';

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
function loadProject(proj) { loadCustomLexicon(P(proj, 'Storyboard', 'emotions.custom.json')); const t = read(P(proj, 'PROJECT.md')); const {data, body} = readFront(t); return {data, body}; }
function saveProject(proj, data, body) { fs.writeFileSync(P(proj, 'PROJECT.md'), `---\n${dumpYaml(data)}---\n${body}`); }
function logLine(proj, text) { const {data, body} = loadProject(proj); saveProject(proj, data, body.replace(/\s*$/, '\n') + `- ${now()} — ${text}\n`); }
const narrated = (data) => String(data.narration).toLowerCase() === 'yes';

// ---------- the mandatory folder schema ----------
// Git does not keep empty folders, so a cloned or archived project loses Asset/owner, Asset/agen ...; the checks and `status` notice, `repair` restores.
const FOLDERS = ['Reference', 'Storyboard', 'Asset/owner', 'Asset/agen', 'Asset/scenes', 'Source/remotion', 'Source/hyperframes', 'Result'];
const folderList = (data) => [...FOLDERS, ...(data.type === 'footage' ? ['Raw-Footage'] : [])];
const folderFiles = (data) => [['Reference/REFERENCES.md', 'REFERENCES.md'], ['Reference/_TEMPLATE.analysis.md', 'ANALYSIS.md'], ['Asset/ASSETS.md', 'ASSETS.md'], ...(data.type === 'footage' ? [['Raw-Footage/SOURCES.md', 'SOURCES.md']] : [])];
/** What of the schema is missing from a project: folders and the ledger/index files every project carries. */
function folderIssues(proj, data) {
  const dirs = folderList(data).filter((d) => !exists(P(proj, d))); const files = folderFiles(data).filter(([f]) => !exists(P(proj, f))).map(([f]) => f);
  return {dirs, files, any: dirs.length + files.length > 0, text: [...dirs.map((d) => d + '/'), ...files].join(', ')};
}
/** The files of Asset/owner and Raw-Footage that Asset/ASSETS.md (the ledger) does not mention, and files the storyboard's `asset:` lines name that do not exist. */
function ledgerIssues(proj, data) {
  const ledger = exists(P(proj, 'Asset', 'ASSETS.md')) ? read(P(proj, 'Asset', 'ASSETS.md')) : '';
  const held = [];
  for (const d of ['Asset/owner', ...(data.type === 'footage' ? ['Raw-Footage'] : [])]) if (exists(P(proj, d))) for (const f of fs.readdirSync(P(proj, d))) if (!/^(SOURCES\.md|\.gitkeep|\.DS_Store)$/.test(f) && fs.statSync(P(proj, d, f)).isFile()) held.push({file: f, dir: d});
  return {unlisted: held.filter((h) => !ledger.includes(h.file)).map((h) => `${h.dir}/${h.file}`)};
}
const pathLike = (t) => (t.match(/(?:[\w.-]+\/)*[\w.-]+\.(?:mp4|mov|webm|mkv|wav|mp3|m4a|png|jpe?g|svg|webp|gif|json|ttf|otf|woff2?)\b/gi) || []);
const assetExists = (proj, ref) => [ref, `Asset/owner/${ref}`, `Raw-Footage/${ref}`, `Asset/${ref}`].some((c) => exists(P(proj, c)));

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
/**
 * The script has two formats. PLAIN (every new project): paragraphs, one per spoken beat of STRUCTURE.md in order, each opening with its emotion
 * tag, then `## Claims`. There is NO time in it: what a TTS or a microphone receives is the file as it is. The time budget of each line is its beat's
 * window, taken from the structure (`beats`). TIMED (older projects): "[00.0–03.0] LABEL" headers; still read, but a project that has a
 * STRUCTURE.md is told to remove the seconds.
 */
function parseScript(text, beats) {
  const {data, body} = readFront(text); const blocks = []; const sections = {}; let cur = null, sec = null;
  const timed = body.split('\n').some((l) => BLOCK_RE.test(l));
  if (timed) {
    for (const line of body.split('\n')) {
      const m = line.match(BLOCK_RE);
      if (m) { cur = {start: num(m[1]), end: num(m[2]), label: m[3].trim(), raw: []}; blocks.push(cur); sec = null; continue; }
      const h = line.match(/^#{1,6}\s+(.*)$/);
      if (h) { cur = null; sec = h[1].trim().toLowerCase(); sections[sec] = sections[sec] || []; continue; }
      if (cur) { if (line.trim() && !line.trim().startsWith('<!--')) cur.raw.push(line.trim()); } else if (sec) sections[sec].push(line);
    }
  } else {
    let para = [], beat = null;
    const flush = () => { if (para.length) blocks.push({start: NaN, end: NaN, label: '', beat, raw: para}); para = []; };
    for (const line of body.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
      const h = line.match(/^#{1,6}\s+(.*)$/);
      if (h) { flush(); const t = h[1].trim(); const bm = t.match(/^beat\s+(\d+)/i); if (bm) { beat = Number(bm[1]); sec = null; } else if (/^claims/i.test(t)) { sec = t.toLowerCase(); sections[sec] = sections[sec] || []; } else sec = null; continue; }
      if (sec) { sections[sec].push(line); continue; }
      if (!line.trim()) { flush(); continue; }
      para.push(line.trim());
    }
    flush();
    if (beats) assignBeats(blocks, beats);
  }
  for (const b of blocks) { b.rawText = b.raw.join(' '); b.text = cleanSpoken(b.rawText); b.words = countWords(b.text); b.tags = extractTags(b.rawText, countWords, cleanSpoken); }
  const claims = [];
  for (const [k, lines] of Object.entries(sections)) if (k.startsWith('claims')) for (const l of lines) {
    if (!l.trim().startsWith('|')) continue;
    const c = l.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
    if (c.every((x) => /^[-: ]*$/.test(x)) || c[0].toLowerCase() === 'claim') continue;
    claims.push({claim: c[0].replace(/^["“]|["”]$/g, ''), status: (c[1] || '').toLowerCase(), source: c[2] || ''});
  }
  return {meta: data, blocks, claims, format: timed ? 'timed' : 'plain'};
}
/** Give each paragraph the window of its beat: by `## Beat N` when every paragraph has one, else the n-th paragraph to the n-th spoken beat. */
function assignBeats(blocks, beats) {
  const spoken = beats.filter((b) => b.vo !== 'none'); const explicit = blocks.length && blocks.every((b) => b.beat);
  blocks.forEach((b, i) => { const beat = explicit ? beats.find((x) => x.n === b.beat) : spoken[i]; if (beat) { b.start = beat.start; b.end = beat.end; b.beatN = beat.n; b.label = (beat.purpose || '').toUpperCase() + (beat.name ? ` — ${beat.name}` : ''); b.mapped = true; } });
}
/** The beats of STRUCTURE.md as plain numbers (best effort: a malformed beat is skipped; `check` reports it). */
function structureBeats(proj) {
  if (!exists(P(proj, 'Storyboard', 'STRUCTURE.md'))) return null;
  const out = []; for (const b of parseStructure(read(P(proj, 'Storyboard', 'STRUCTURE.md'))).beats) {
    const get = (k) => b.kv.filter(([x]) => x === k).map(([, v]) => v); const t = get('time')[0] && rangeOf(get('time')[0]);
    if (t && t.b > t.a) out.push({n: b.n, name: b.name, start: t.a, end: t.b, purpose: (get('purpose')[0] || '').toLowerCase(), vo: (get('vo')[0] || 'yes').toLowerCase() === 'none' ? 'none' : 'yes'});
  }
  return out;
}
/** How a script line is named in a message: its number and the beat budget it is held to (the seconds come from the structure, never from the script). */
/** Printed by the first commands an agent runs, so the format is seen even when SKILL.md was skimmed. */
const GATE1_CONTRACT = [
  'GATE 1 CONTRACT (what your chat message is, and what the script file is):',
  '  - Storyboard/SCRIPT.md holds ONLY spoken words: one paragraph per spoken beat of STRUCTURE.md, each opening with an emotion tag, a blank line between.',
  '    No seconds, no "Tahap 1"/"Hook:" labels, no (scene or zoom directions). Time budgets live in STRUCTURE.md; picture and camera live in STORYBOARD.md.',
  '  - Do not write the script or a plan in chat. Write the files, run `check script`, `submit script`, and paste the VO SCRIPT block the tool prints.',
  '  - Before you send that message, save it to a file and run `verify-reply <project> <file>`: it fails on a timed or labelled second script, an edited VO block, or a question about the audio path. Fix, then send.',
  '  - Start the script file with `script-init <project>`: it writes one tagged paragraph per spoken beat; you replace each TODO with the words.',
].join('\n');
const lineTag = (b, i) => (b.beatN ? `line ${i + 1} (beat ${b.beatN}, budget ${f2(b.start)}–${f2(b.end)} s)` : `block ${i + 1} [${f2(b.start)}–${f2(b.end)}] ${b.label}`);
/** The script of a project, with each line's window taken from the structure. */
function loadScript(proj) { return parseScript(read(P(proj, 'Storyboard', 'SCRIPT.md')), structureBeats(proj)); }
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
  { const fi = folderIssues(proj, loadProject(proj).data); if (fi.any) E(`the project folder is missing: ${fi.text}. Run \`project.mjs repair <project>\` (mandatory schema: project-folder.md)`); }
  if (!exists(file)) { E('Storyboard/SCRIPT.md is missing'); return {issues, rows: []}; }
  const parsed = loadScript(proj); const {meta, blocks, claims} = parsed;
  const proj0 = loadProject(proj).data; const talk = narrated(proj0);
  const wps = num(meta.wps) || DEFAULT_WPS; const dur = num(meta.duration) || num(proj0.target_duration);
  const plain = parsed.format === 'plain'; const beats = structureBeats(proj);
  if (!blocks.length) { E(plain ? 'no lines found: write one paragraph per spoken beat of STRUCTURE.md, each opening with its emotion tag, for example "[curious] Tau nggak? ..."' : 'no timed blocks found; write them as "[00.0–03.0] HOOK" followed by the text'); return {issues, rows: []}; }
  if (plain) {
    // The script is only the lines. Its time budget comes from the beats of the structure, in order (or "## Beat N" above a line).
    if (!beats?.length) { E(exists(structFile(proj)) ? 'Storyboard/STRUCTURE.md has no valid beats: each script line takes its time budget from its beat' : 'Storyboard/STRUCTURE.md is missing: each script line takes its time budget from its beat, so write the structure first'); return {issues, rows: []}; }
    const spoken = beats.filter((b) => b.vo !== 'none'); const explicit = blocks.every((b) => b.beat);
    if (!explicit && blocks.length !== spoken.length) { E(`the script has ${blocks.length} line(s) but STRUCTURE.md has ${spoken.length} spoken beat(s). Write one line per spoken beat, in order (or put "## Beat N" above a line; mark a beat "- vo: none" when nothing is said).`); return {issues, rows: []}; }
    const lost = blocks.map((b, i) => (b.mapped ? 0 : i + 1)).filter(Boolean); if (lost.length) { E(`line(s) ${lost.join(', ')} point to a beat that does not exist`); return {issues, rows: []}; }
    for (const [i, b] of blocks.entries()) {
      const where = `line ${i + 1}`;
      if (/\b\d{1,2}(?:[.,]\d+)?\s*[–—-]\s*\d{1,2}(?:[.,]\d+)?\s*(?:s|dtk|detik|sec)\b|\(\s*\d+(?:[.,]\d+)?\s*(?:s|dtk|detik)\s*\)/i.test(b.rawText)) E(`${where}: a time inside the line. Seconds live in STRUCTURE.md and STORYBOARD.md, never in the script.`);
      if (/^(?:hook|tahap|beat|scene|adegan|frame|shot|segmen|bagian|purba|outro|cta|closing)\s*(?:\d+|\(|:|—|–|-)/i.test(b.text)) E(`${where}: it starts with a stage label ("${b.text.slice(0, 24)}"). The script is only what is said; labels belong to the structure.`);
      if (/\((?:[^)]*\b(?:zoom|kamera|camera|visual|layar|tampil|scene|transisi|shot|cut to|fade)\b[^)]*)\)/i.test(b.rawText)) E(`${where}: a stage direction in brackets. What is on screen is the storyboard's, not the script's.`);
    }
  } else if (proj0.structure === 'yes' || beats) {
    E('the script contains seconds ("[00.0–03.0] HOOK"). Seconds belong to STRUCTURE.md (the time budget of each beat) and STORYBOARD.md. The script is only the lines, each opening with its emotion tag, so it goes to a TTS exactly as it is.');
  }
  if (!dur) E('script front matter needs duration');
  if (String(meta.narration || '').toLowerCase() !== (talk ? 'yes' : 'no')) E(`script front matter narration must equal PROJECT.md narration (${talk ? 'yes' : 'no'})`);
  const report = loadVoReport(proj); const rows = [];
  blocks.forEach((b, i) => {
    const tag = lineTag(b, i); const win = b.end - b.start;
    if (/\b(TODO|TULIS|XXX|lorem|ipsum)\b/i.test(b.rawText) || !b.text) E(`${tag}: placeholder or empty text`);
    if (b.end <= b.start) { E(`${tag}: end must be after start`); return; }
    if (i && b.start < blocks[i - 1].end - 1e-9) E(`${tag}: overlaps the previous block (ends ${f2(blocks[i - 1].end)})`);
    if (i && b.start > blocks[i - 1].end + 1e-9) I(`${f2(b.start - blocks[i - 1].end)} s visual-only beat before ${tag}`);
    const need = talk ? speechSec(b.text, wps) : Math.max(READ_MIN, READ_SEC_PER_WORD * b.words);
    const room = Math.floor(Math.max(0, win - (talk ? 0.3 : 0)) * (talk ? wps : 1 / READ_SEC_PER_WORD));
    rows.push({i: i + 1, label: b.label, start: b.start, end: b.end, win, words: b.words, need, room, emotion: b.tags.map((t) => (t.found ? t.tag : t.mods.length ? 'neutral' : '?') + (t.also.length ? '&' + t.also.join('&') : '') + (t.mods.length ? '+' + t.mods.join('+') : '')).join('>')});
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
  // the structure: a script is that plan expressed in words
  const struct = checkStructure(proj); struct.issues.forEach((x) => issues.push({level: x.level, msg: 'structure: ' + x.msg}));
  const v2 = proj0.structure === 'yes' || !!struct.beats; const eLevel = v2 ? E : W;
  if (struct.beats?.length) {
    blocks.forEach((b, i) => {
      const tag = lineTag(b, i);
      const beat = struct.beats.find((x) => b.start >= x.start - 0.02 && b.end <= x.end + 0.02);
      if (!beat) E(`${tag}: crosses a beat boundary of STRUCTURE.md; every block must sit inside one beat`);
      else if (talk && beat.emotion && b.tags[0]?.tag && b.tags[0].tag !== beat.emotion) W(`${tag}: delivered [${b.tags[0].tag}] but beat ${beat.n} asks for ${beat.emotion}`);
    });
    if (talk) for (const beat of struct.beats) if (beat.vo !== 'none' && !blocks.some((b) => b.start >= beat.start - 0.02 && b.end <= beat.end + 0.02)) (['hook', 'cta'].includes(beat.purpose) ? E : W)(`beat ${beat.n} (${beat.purpose}) has no script block; write its words or mark the beat "- vo: none"`);
  }
  // emotion: how each line is delivered. The same tag drives the voice, the narrator's face and which gestures fit.
  if (talk) {
    const known = vocabulary();
    blocks.forEach((b, i) => {
      const tag = lineTag(b, i);
      if (v2 && !b.tags.length) E(`${tag}: no emotion tag. Open the line with one, for example [curious] or [nostalgic]: any emotion word works (tuned presets: ${known.join(', ')})`);
      else if (v2 && b.tags[0].at !== 0) E(`${tag}: the first tag comes after word ${b.tags[0].at}; the line must open with its emotion`);
      if (b.tags.length > 2) E(`${tag}: ${b.tags.length} emotion tags in one block; at most 2 (the face changes once inside a line)`);
      b.tags.forEach((t, k) => {
        if (t.typos.length) { eLevel(`${tag}: [${t.raw}]: "${t.typos[0].word}" looks like a misspelling of "${t.typos[0].suggestion}"`); return; }
        if (!t.found && !t.mods.length) W(`${tag}: [${t.raw}] is not a known emotion: the face stays neutral, ElevenLabs gets it as written and other engines drop it. Use a known word, or define yours in Storyboard/emotions.custom.json ({"${t.raw.toLowerCase()}": {"va": [valence, arousal]}} or {"like": "sad"})`);
        else if (t.free.length) W(`${tag}: "${t.free.join('", "')}" in [${t.raw}] is not a known emotion or delivery word; it reaches only engines that take free-form tags`);
        const segWords = (b.tags[k + 1]?.at ?? b.words) - t.at;
        if (b.tags.length > 1 && segWords / wps < 0.8) E(`${tag}: [${t.tag}] covers ${segWords} word(s), about ${f2(segWords / wps)} s; a face needs 0.8 s to show an emotion. Merge it into the neighbour.`);
      });
    });
    const em = blocks.map((b) => b.tags.find((t) => t.tag)?.tag); const used = em.filter(Boolean);
    if (used.length >= 4 && new Set(used).size === 1) W(`every block is [${used[0]}]; vary the delivery, a flat read loses the viewer`);
    if (em[0] && emoEnergy(em[0]) < 0.5) W(`the hook is delivered [${em[0]}] (energy ${emoEnergy(em[0])}); a hook needs 0.5+: curious, surprised, excited, mad, warm`);
    const le = em.at(-1); if (le && emoEnergy(le) < 0.4) W(`the last block is [${le}]; end on warm, excited, proud or neutral so the call to action lands`);
    em.forEach((e, i) => { if (i && e && em[i - 1] && Math.abs(emoEnergy(e) - emoEnergy(em[i - 1])) > 0.7 && blocks[i].start - blocks[i - 1].end < 0.5) W(`block ${i + 1}: jumps from [${em[i - 1]}] to [${e}] with no pause; put a visual-only beat between them`); });
  }
  if (talk && report) {
    if (report.segments.length === blocks.length) blocks.forEach((b, i) => { const s = report.segments[i]; if (s.end > b.end + 0.05) W(`block ${i + 1}: measured speech ends ${f2(s.end)} s, after its window end ${f2(b.end)} s (storyboard windows follow the audio)`); });
    else W(`measured audio has ${report.segments.length} segments, script has ${blocks.length} blocks`);
  }
  return {issues, rows, structure: struct.beats, format: parsed.format, meta: {wps, dur, totalWords, totalNeed, talk, report: !!report}};
}

// ---------- structure (STRUCTURE.md): what the video is made of, before any word is written ----------
const PURPOSES = ['hook', 'setup', 'problem', 'solution', 'demo', 'proof', 'story', 'twist', 'payoff', 'cta', 'outro'];
const structFile = (proj) => P(proj, 'Storyboard', 'STRUCTURE.md');
function parseStructure(text) {
  const {data, body} = readFront(text); const beats = []; let cur = null;
  for (const line of body.split('\n')) {
    const h = line.match(/^##\s+Beat\s+(\d+)\s*(?:[—–:-]\s*(.*))?$/i);
    if (h) { cur = {n: Number(h[1]), name: (h[2] || '').trim(), kv: []}; beats.push(cur); continue; }
    if (/^##\s/.test(line)) { cur = null; continue; }
    const b = cur && line.match(/^\s*-\s+([\w-]+):\s*(.*)$/); if (b) cur.kv.push([b[1].toLowerCase(), b[2].trim()]);
  }
  return {meta: data, beats};
}
const styleOf = (data) => (data.style && !['undecided', 'none', ''].includes(String(data.style)) ? resolveStyle(data.style) : null);
const hashStructure = (proj) => (exists(structFile(proj)) ? sha(read(structFile(proj))) : '');
/** The structure is the plan the script expresses: beats that tile the duration, one idea each, an emotion each, and where the picture comes from. */
function checkStructure(proj) {
  const issues = []; const E = (m) => issues.push({level: 'error', msg: m}), W = (m) => issues.push({level: 'warn', msg: m});
  const data = loadProject(proj).data; const talk = narrated(data);
  if (!exists(structFile(proj))) { if (data.structure === 'yes') E('Storyboard/STRUCTURE.md is missing (what the video is made of: beats, what each shows, the one idea per beat, the emotion)'); return {issues, beats: null}; }
  const {meta, beats: raw} = parseStructure(read(structFile(proj)));
  const sc = exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? loadScript(proj) : null;
  const dur = num(meta.duration) || num(data.target_duration); const st = styleOf(data);
  if (!raw.length) { E('no "## Beat N — LABEL" sections found'); return {issues, beats: []}; }
  if (num(meta.duration) && num(data.target_duration) && Math.abs(num(meta.duration) - num(data.target_duration)) > 1e-9) E(`duration ${meta.duration} differs from PROJECT.md ${data.target_duration}`);
  const beats = []; let hooks = 0;
  raw.forEach((b, i) => {
    const tag = `Beat ${b.n}${b.name ? ' (' + b.name + ')' : ''}`; const get = (k) => b.kv.filter(([x]) => x === k).map(([, v]) => v);
    if (b.n !== i + 1) E(`${tag}: beats must be numbered 1..N in order`);
    const t = get('time')[0] && rangeOf(get('time')[0]); if (!t) { E(`${tag}: needs "- time: 0.0–3.0" in seconds`); return; }
    const prev = beats.at(-1);
    if (!prev && Math.abs(t.a) > 1e-9) E(`${tag}: the first beat must start at 0`);
    if (prev && Math.abs(t.a - prev.end) > 1e-9) E(`${tag}: starts at ${f2(t.a)} but the previous beat ends at ${f2(prev.end)} (${t.a > prev.end ? 'gap' : 'overlap'})`);
    if (t.b <= t.a) { E(`${tag}: end must be after start`); return; }
    const purpose = (get('purpose')[0] || '').toLowerCase(); if (!PURPOSES.includes(purpose)) E(`${tag}: purpose must be one of ${PURPOSES.join(', ')}`);
    if (purpose === 'hook') { hooks++; if (t.b - t.a > 4) E(`${tag}: a hook of ${f2(t.b - t.a)} s loses the viewer; keep it within 4 s (3 s is better)`); }
    const shows = get('shows')[0] || ''; if (shows.length < 8 || /\bTODO\b/.test(shows)) E(`${tag}: "shows" must say what is on screen, concretely`);
    const info = get('info')[0] || ''; const iw = countWords(info);
    if (/\bTODO\b/.test(info) || iw < 3) E(`${tag}: "info" must state the ONE thing the viewer takes from this beat (3-16 words)`); else if (iw > 16) W(`${tag}: "info" has ${iw} words; more than one idea in a beat?`);
    const source = (get('source')[0] || '').toLowerCase(); if (!['remotion', 'footage', 'remotion+footage'].includes(source)) E(`${tag}: source must be remotion, footage or remotion+footage`);
    const foot = get('footage');
    if (source.includes('footage')) {
      if (!foot.length) E(`${tag}: source includes footage but there is no "- footage: file.mp4 12.0–15.0" (which file, which part)`);
      for (const f of foot) { const m = f.match(/^(\S+)\s+(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)/); if (!m) { E(`${tag}: footage must look like: clip.mp4 12.0–15.0`); continue; } if (num(m[3]) - num(m[2]) < t.b - t.a - 1e-9) E(`${tag}: footage ${f} gives ${f2(num(m[3]) - num(m[2]))} s but the beat lasts ${f2(t.b - t.a)} s`); if (!exists(P(proj, 'Raw-Footage', m[1])) && !exists(P(proj, 'Asset', 'owner', m[1]))) W(`${tag}: ${m[1]} is not in Raw-Footage/ or Asset/owner/ yet`); }
    }
    let emo = null; const eraw = (get('emotion')[0] || '').trim();
    if (talk) { if (!eraw) E(`${tag}: needs "- emotion: curious" (how it is delivered: any emotion word; ${vocabulary().length} tuned presets, ${lexiconWords().length}+ more known: ${vocabulary().join(', ')} ...)`); else { emo = resolveEmotion(eraw); const ty = emo ? null : typoOf(eraw); if (ty) E(`${tag}: emotion "${eraw}" looks like a misspelling of "${ty}"`); else if (!emo) W(`${tag}: emotion "${eraw}" is not a known word; the face stays neutral (add it to Storyboard/emotions.custom.json, or use a known word)`); } }
    for (const x of claimTerms(info)) if (sc && !claimCovered(x, sc.claims)) W(`${tag}: "info" mentions "${x}", a number, offer or domain; give it a row under ## Claims before the script`);
    beats.push({n: b.n, name: b.name, start: t.a, end: t.b, purpose, shows, info, source, emotion: emo, vo: (get('vo')[0] || 'yes').toLowerCase() === 'none' ? 'none' : 'yes'});
  });
  if (beats.length) {
    if (hooks !== 1) E(`exactly one beat must be the hook (found ${hooks})`); else if (beats[0].purpose !== 'hook') E('the hook must be the first beat');
    if (!['cta', 'outro', 'payoff'].includes(beats.at(-1).purpose)) E('the last beat must be cta, outro or payoff');
    if (dur && Math.abs(beats.at(-1).end - dur) > 1e-9) E(`beats end at ${f2(beats.at(-1).end)} s but the duration is ${f2(dur)} s`);
    if (st && dur) { const avg = dur / beats.length, [lo, hi] = st.shotSec; if (avg < lo * 0.7 || avg > hi * 1.3) W(`${beats.length} beats average ${f2(avg)} s; ${st.name} cuts every ${lo}-${hi} s`); }
  }
  return {issues, beats};
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
  const script = exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? loadScript(proj).blocks.filter((b) => b.text) : [];
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
  { const fi = folderIssues(proj, loadProject(proj).data); if (fi.any) E(`the project folder is missing: ${fi.text}. Run \`project.mjs repair <project>\` (mandatory schema: project-folder.md)`); }
  const file = P(proj, 'Storyboard', 'STORYBOARD.md'); if (!exists(file)) { E('Storyboard/STORYBOARD.md is missing'); return {issues}; }
  const proj0 = loadProject(proj).data; const talk = narrated(proj0);
  const {meta, frames} = parseStoryboard(read(file));
  const fps = num(meta.fps) || FPS; const dur = num(meta.duration) || num(proj0.target_duration);
  if (talk && String(proj0.character).toLowerCase() === 'undecided') E('the narrator character is undecided. Design it, show the user its sheet, then `set-character <proj> <id>` (or `none` for a voice-only video).');
  const st = styleOf(proj0);
  if (String(proj0.style) === 'undecided') E('the video style is undecided. Show the user 2-3 fitting styles (`project.mjs style --for "<brief>"`), then `set-style <proj> <name>`.');
  else if (proj0.style && !st) E(`PROJECT.md style "${proj0.style}" is not a known style; run \`project.mjs style --list\``);
  if (fps !== 60 && !meta.fps_reason) E(`fps is ${fps}; the default is 60. Use 60, or set fps_reason with the user's words.`);
  if (!dur) E('storyboard front matter needs duration');
  if (meta.size && proj0.size && meta.size !== proj0.size) E(`size ${meta.size} differs from PROJECT.md ${proj0.size}`);
  if (!frames.length) { E('no "## Frame N — name" sections found'); return {issues}; }
  const report = talk ? loadVoReport(proj) : null; const wps = (exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? num(loadScript(proj).meta.wps) : 0) || DEFAULT_WPS;
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
    const tr = get('transition')[0]; const dflt = i === 0 ? {kind: 'none', sec: 0} : st ? {kind: st.transition.kind, sec: st.transition.sec} : {kind: 'fade', sec: 0.5};
    p.transition = dflt;
    if (tr) {
      const m = tr.match(/^(cut|fade|slide|wipe)(?:\s+(\d+(?:[.,]\d+)?))?$/i);
      if (!m) E(`${tag}: transition must look like: cut | fade 0.5 | slide 0.4 | wipe 0.5`);
      else if (i === 0) W(`${tag}: the first frame has nothing to transition from; the "transition" line is ignored`);
      else { const kind = m[1].toLowerCase(); const sec = kind === 'cut' ? 0 : m[2] ? num(m[2]) : st?.transition.kind === kind ? st.transition.sec : 0.4; if (sec > 0.5 + 1e-9) E(`${tag}: transition ${kind} ${sec} s is longer than the 0.5 s of overlap the clip handles give`); else p.transition = {kind, sec}; }
    }
    const inside = (x, y, what) => { if (x < t.a - 1e-9 || y > t.b + 1e-9) { E(`${tag}: ${what} ${f2(x)}–${f2(y)} is outside the frame ${f2(t.a)}–${f2(t.b)}`); return false; } return true; };
    for (const k of ['scene', 'engine', 'asset', 'reads']) if (!get(k).length || !get(k)[0]) E(`${tag}: missing "- ${k}:"`);
    if (get('scene')[0] && get('scene')[0].length < 8) E(`${tag}: scene description is too short to build from`);
    for (const a of get('asset')) for (const ref of pathLike(a)) if (!assetExists(proj, ref)) W(`${tag}: asset ${ref} is not in the project yet (Asset/owner, Asset/agen or Raw-Footage); it must exist before the build`);
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
      if (st && e.scale > st.zoomMax + 1e-9) W(`${tag}: zoom "${target}" scale ${e.scale} is above ${st.name}'s ${st.zoomMax}${st.zoomMax <= 1.05 ? ' (this style has no camera moves)' : ''}`);
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
      if (st && !st.sfx.includes(e.kind)) W(`${tag}: ${st.name} does not use "${e.kind}" effects (it uses ${st.sfx.join(', ') || 'none'})`);
      if (inside(e.at, e.at, `sfx ${e.kind}`)) p.sfx.push(e);
    }
    if (get('sound').length && !get('sfx').length && !get('cursor').some((c) => /click/i.test(c))) W(`${tag}: "sound:" is only a note; no "- sfx: kind @time" line, so nothing will be produced for it`);
    for (const x of get('text')) {
      const r = rangeOf(x); const q = x.match(/["“](.*)["”]/);
      if (!r || !q) { E(`${tag}: text must look like: 0.40–2.80 "ON SCREEN TEXT"`); continue; }
      const words = countWords(q[1]), need = Math.max(READ_MIN, READ_SEC_PER_WORD * words);
      if (!inside(r.a, r.b, 'text')) continue;
      if (r.b - r.a < need - 1e-9) E(`${tag}: "${q[1].slice(0, 30)}" is on screen ${f2(r.b - r.a)} s but needs ${f2(need)} s (${words} words x ${READ_SEC_PER_WORD} s, min ${READ_MIN} s)`);
      if (st && words > st.maxWords) (words > 2 * st.maxWords ? E : W)(`${tag}: "${q[1].slice(0, 30)}" has ${words} words; ${st.name} keeps on-screen text to ${st.maxWords}`);
      else if (st && r.b - r.a >= need - 1e-9 && r.b - r.a < need + st.holdMin - 1e-9) W(`${tag}: "${q[1].slice(0, 30)}" is held ${f2(r.b - r.a)} s; ${st.name} wants ${f2(need + st.holdMin)} s (reading time + ${st.holdMin} s)`);
      p.text.push({start: r.a, end: r.b, text: q[1], words});
    }
  });
  if (!plan.length) return {issues, plan};
  const total = plan.at(-1).end;
  if (dur && Math.abs(total - dur) > 1e-9) E(`frames end at ${f2(total)} s but duration is ${f2(dur)} s`);
  const sum = plan.reduce((a, p) => a + p.durationFrames, 0); const want = Math.round(total * fps);
  if (sum !== want) E(`frame counts add up to ${sum} but the video has ${want} frames`);
  { const lg = ledgerIssues(proj, proj0); if (lg.unlisted.length) W(`not listed in Asset/ASSETS.md (every file the build uses is listed with who made it and where it is used): ${lg.unlisted.join(', ')}`); }
  if (st) { const avg = total / plan.length; const [lo, hi] = st.shotSec; if (avg < lo * 0.75 || avg > hi * 1.25) W(`frames average ${f2(avg)} s; ${st.name} cuts every ${lo}-${hi} s`); for (const p of plan) if (p.end - p.start > hi * 1.8) W(`Frame ${p.id} stays ${f2(p.end - p.start)} s; ${st.name} rarely holds one shot beyond ${hi} s`); }
  const struct = checkStructure(proj);
  if (struct.beats?.length) {
    if (!talk) struct.issues.forEach((x) => issues.push({level: x.level, msg: 'structure: ' + x.msg}));
    const edges = new Set(plan.flatMap((p) => [f2(p.start), f2(p.end)]));
    for (const b of struct.beats) for (const x of [b.start, b.end]) if (!edges.has(f2(x))) E(`beat ${b.n} (${b.purpose}) ${x === b.start ? 'starts' : 'ends'} at ${f2(x)} s, inside a storyboard frame; a frame may split a beat but never straddle its boundary`);
  }
  let emotions = null;

  // voice: windows fit the words, and the words are exactly the approved script
  vos.sort((a, b) => a.start - b.start);
  vos.forEach((v, k) => { if (k && v.start < vos[k - 1].end - 1e-9) E(`vo ${f2(v.start)}–${f2(v.end)} overlaps the previous vo (ends ${f2(vos[k - 1].end)})`); });
  if (talk) {
    const sc = exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? loadScript(proj) : null;
    if (sc) {
      const a = norm(vos.map((v) => v.text).join(' ')), b = norm(sc.blocks.map((x) => x.text).join(' '));
      let d = 0; while (d < a.length && d < b.length && a[d] === b[d]) d++;
      if (a.length !== b.length || d < a.length) E(`vo text differs from Storyboard/SCRIPT.md at word ${d + 1}: storyboard "${a.slice(d, d + 4).join(' ')}" vs script "${b.slice(d, d + 4).join(' ')}"`);
      // the narrator's face over time: each [tag] becomes a segment starting just before its first spoken word
      const sb = sc.blocks.filter((x) => x.text);
      if (vos.length && sb.some((x) => x.tags.some((t) => t.tag))) {
        let g = 0; const lines = vos.map((v) => { const o = {first: g, words: v.words}; g += v.words; return o; });
        const seg = report && report.mapped && report.segments.length === vos.length ? report.segments : null;
        const span = (k) => (seg ? {s: seg[k].start, e: seg[k].end} : {s: vos[k].start + 0.1, e: vos[k].end - 0.1});
        const timeAt = (w) => { let k = lines.findIndex((l) => w >= l.first && w < l.first + l.words); if (k < 0) k = lines.length - 1; const sp = span(k); return sp.s + ((w - lines[k].first) / Math.max(1, lines[k].words)) * (sp.e - sp.s); };
        const moments = []; let base = 0;
        for (const x of sb) { for (const t of x.tags) if (t.tag) moments.push({at: timeAt(base + t.at), tag: t.tag, mods: t.mods, also: t.also}); base += x.words; }
        emotions = emoTimeline(moments, span(lines.length - 1).e);
        emotions.segments.forEach((x, k, all) => { if (k < all.length - 1 && x.end - x.start < 0.8 - 1e-9) E(`delivery [${x.tag}] lasts ${f2(x.end - x.start)} s (${f2(x.start)}–${f2(x.end)}); a face needs 0.8 s to show an emotion. Merge it with its neighbour in SCRIPT.md.`); });
      }
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
  const sc2 = exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? loadScript(proj).claims : [];
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
  if (emotions) for (const c of cues) { const mid = (c.start + c.end) / 2; const x = emotions.segments.find((q) => mid >= q.start && (q.end === null || mid < q.end)); if (x && !x.gestures.includes(c.kind)) W(`narrator ${c.kind} ${f2(c.start)}–${f2(c.end)} plays while the delivery is [${x.tag}] (${x.gestures.length ? 'it allows ' + x.gestures.join(', ') : 'it allows no gestures'}); change the cue or the tag`); }
  if (cues.length) {
    const per10 = cues.length / (total / 10); if (st && per10 > st.gestures + 1e-9) W(`${cues.length} narrator cues in ${f2(total)} s (${f2(per10)} per 10 s); ${st.name} uses at most ${st.gestures}`);
    if (cues.reduce((a, c) => a + (c.end - c.start), 0) / total > 0.7) W('the narrator gestures more than 70% of the time; rest the arms between cues so each gesture means something');
    for (const c of cues) if (c.end - c.start > 4.5) W(`narrator ${c.kind} ${f2(c.start)}–${f2(c.end)} holds one pose for ${f2(c.end - c.start)} s; split it or shorten it`);
  }
  const sfx = [...plan.flatMap((p) => p.sfx), ...curs.filter((c) => c.action === 'click').map((c) => ({frame: c.frame, kind: 'click', at: +(c.at + CURSOR_DWELL).toFixed(3), gain: 1, source: 'cursor'}))].sort((a, b) => a.at - b.at);
  const style = st && {id: st.id, name: st.name, category: st.category, build: st.build, palette: st.palette, transition: st.transition, ease: st.ease, stepFps: st.stepFps, zoomMax: st.zoomMax, shotSec: st.shotSec, maxWords: st.maxWords};
  return {issues, plan, sfx, style, emotions, meta: {fps, total, vos: vos.length, zooms: zooms.length, cursor: curs.length, cues: cues.length}};
}

// ---------- gates ----------
// The script hash covers timing and words only, so updating a claim's status or a note does not cancel the approvals.
const hashScript = (proj) => {
  if (!exists(P(proj, 'Storyboard', 'SCRIPT.md'))) return '';
  const blocks = loadScript(proj).blocks; const hs = hashStructure(proj);
  // The delivery (emotion tags) and the structure are part of what the user approves; a script without either hashes exactly as before.
  return sha(blocks.map((b) => `${b.start}-${b.end}${b.tags.length ? ' ' + b.tags.map((t) => `${t.raw.toLowerCase().replace(/\s+/g, ' ')}@${t.at}`).join(',') : ''} ${b.text}`).join('\n') + (hs ? '\n#structure ' + hs : ''));
};
function hashStoryboard(proj, data) {
  if (!exists(P(proj, 'Storyboard', 'STORYBOARD.md'))) return '';
  const hs = hashStructure(proj);
  // The style is part of what the user approved: changing it cancels the storyboard approval (and the sample and final after it).
  return sha(read(P(proj, 'Storyboard', 'STORYBOARD.md')) + (narrated(data) ? '\n#script ' + hashScript(proj) : hs ? '\n#structure ' + hs : '') + (data.style && data.style !== 'undecided' ? '\n#style ' + data.style : ''));
}
function currentHash(proj, gate, data) { return gate === 'script' ? hashScript(proj) : hashStoryboard(proj, data); }
function accState(proj, gate, data) {
  const a = data.acc?.[gate]; if (!a || !a.status || a.status === 'none') return 'none';
  const cur = currentHash(proj, gate, data);
  if (a.status === 'waiting') return a.hash === cur ? 'waiting' : 'stale';
  if (a.status === 'approved') {
    if (gate === 'sample' || gate === 'final') return a.hash === hashStoryboard(proj, data) && accState(proj, 'storyboard', data) === 'approved' ? 'approved' : 'stale';
    return a.hash === cur ? 'approved' : 'stale';
  }
  return a.status;
}
function placeholders(proj) { return exists(P(proj, 'Storyboard', 'SCRIPT.md')) ? loadScript(proj).claims.filter((c) => c.status === 'placeholder') : []; }
const hasMp4 = (d) => exists(d) && fs.readdirSync(d).some((f) => /\.(mp4|webm|mov|gif)$/i.test(f));
function gate(proj, action) {
  const {data} = loadProject(proj); const talk = narrated(data); const why = [];
  const need = (g, label) => { const s = accState(proj, g, data); if (s !== 'approved') why.push(`${label} is ${s === 'none' ? 'not approved yet' : s === 'stale' ? 'STALE (the file changed after it was approved or submitted)' : 'waiting for the user'}`); };
  if (['voice', 'storyboard'].includes(action) && talk) need('script', 'Gate 1 (script)');
  if (['build', 'sample', 'full', 'deliver'].includes(action)) { if (talk) need('script', 'Gate 1 (script)'); need('storyboard', 'Gate 2 (storyboard)'); }
  if (['sample', 'full'].includes(action)) {
    const f = P(proj, 'Storyboard', 'plan.json');
    if (!exists(f)) why.push('Storyboard/plan.json is missing; run `check storyboard`'); else if (JSON.parse(read(f)).hash !== hashStoryboard(proj, data)) why.push('Storyboard/plan.json is out of date; run `check storyboard`');
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
  if (r.format === 'plain') out('  LINE BUDGETS (the seconds are STRUCTURE.md\'s time budget for each line; the script itself holds none, and this table is for you, not for the user\'s script):');
  out('  #  window            win(s)  words  need(s)  max words  emotion');
  for (const x of r.rows) out(`  ${String(x.i).padStart(1)}  ${f2(x.start).padStart(5)}–${f2(x.end).padEnd(6)}   ${f2(x.win).padStart(5)}  ${String(x.words).padStart(5)}  ${f2(x.need).padStart(7)}  ${String(x.room).padStart(8)}  ${(x.emotion || '-').padEnd(14)}${x.need > x.win ? '<- too long' : ''}`);
  if (r.meta) out(`  total ${r.meta.totalWords} words, ~${f2(r.meta.totalNeed)} s of ${r.meta.dur ? f2(r.meta.dur) : '?'} s at ${r.meta.wps} words/s${r.meta.report ? '' : ' (estimate until the audio is measured)'}`);
}
/** The storyboard as a person explains it: frame by frame, in words, from the file itself (so it cannot drift from what will be built). */
function explainStoryboard(proj) {
  const {data} = loadProject(proj); const {frames} = parseStoryboard(read(P(proj, 'Storyboard', 'STORYBOARD.md')));
  const plan = exists(P(proj, 'Storyboard', 'plan.json')) ? JSON.parse(read(P(proj, 'Storyboard', 'plan.json'))) : null;
  const zooms = [], needs = [];
  for (const fr of frames) {
    const get = (k) => fr.kv.filter(([x]) => x === k).map(([, v]) => v); const t = get('time')[0] && rangeOf(get('time')[0]); if (!t) continue;
    out(`\nFrame ${fr.n}${fr.name ? ' — ' + fr.name : ''}   ${f2(t.a)}–${f2(t.b)} s`);
    if (get('scene')[0]) out(`  On screen:  ${get('scene')[0]}`);
    for (const v of get('vo')) if (v.toLowerCase() !== 'none') { const q = v.match(/["“](.*)["”]/); const r = rangeOf(v); if (q && r) out(`  Voice:      ${f2(r.a)}–${f2(r.b)}  "${q[1]}"`); }
    for (const x of get('text')) out(`  Text:       ${x}`);
    for (const z of get('zoom')) { out(`  Zoom:       ${z}`); zooms.push(`Frame ${fr.n}: ${z.split(/\s+/)[0]}`); }
    for (const c of get('cursor')) out(`  Cursor:     ${c}`);
    for (const n of get('narrator')) out(`  Narrator:   ${n}`);
    const pf = plan?.frames?.find((f) => f.id === fr.n); if (pf?.transition && pf.transition.kind !== 'none') out(`  Transition in: ${pf.transition.kind}${pf.transition.sec ? ' ' + pf.transition.sec + ' s' : ''}`);
    for (const x of get('sfx')) out(`  Effect:     ${x}`);
    if (get('reads')[0]) out(`  The viewer takes away: ${get('reads')[0]}`);
    for (const a of get('asset')) for (const ref of pathLike(a)) if (!assetExists(proj, ref)) needs.push(`${ref} (Frame ${fr.n})`);
  }
  out('\nSUMMARY');
  out(`  Zoom highlights: ${zooms.length ? zooms.join('; ') : 'none'}`);
  if (plan?.emotions?.segments) out(`  Delivery arc:    ${plan.emotions.segments.filter((x) => x.end !== null).map((x) => x.tag).join(' → ')}`);
  if (plan?.style) out(`  Style:           ${plan.style.name} (transition ${plan.style.transition.kind}${plan.style.transition.sec ? ' ' + plan.style.transition.sec + ' s' : ''})`);
  out(`  Still needed from the user: ${needs.length ? needs.join(', ') : 'nothing'}`);
}
function printStructure(beats) {
  if (!beats?.length) return;
  out('\nSTRUCTURE (what the video is made of):\n  #  time            purpose   emotion     one idea');
  for (const b of beats) out(`  ${String(b.n).padStart(1)}  ${f2(b.start).padStart(5)}–${f2(b.end).padEnd(6)}  ${b.purpose.padEnd(8)}  ${(b.emotion || '-').padEnd(10)}  ${b.info}`);
}
function printPlan(plan) {
  out('  frame  time             frames   vo words  zoom  cursor');
  for (const p of plan) out(`  ${String(p.id).padStart(5)}  ${f2(p.start).padStart(5)}–${f2(p.end).padEnd(6)}  ${String(p.durationFrames).padStart(6)}  ${String(p.vo.reduce((a, v) => a + v.words, 0)).padStart(8)}  ${String(p.zoom.length).padStart(4)}  ${String(p.cursor.length).padStart(6)}`);
}

function writePlan(proj, r, data) {
  fs.writeFileSync(P(proj, 'Storyboard', 'plan.json'), JSON.stringify({fps: r.meta.fps, size: data.size, totalSec: r.meta.total, totalFrames: Math.round(r.meta.total * r.meta.fps), hash: hashStoryboard(proj, data), style: r.style, emotions: r.emotions, sfx: r.sfx, frames: r.plan}, null, 1) + '\n');
}

/**
 * The clean voice script: what a person pastes into any TTS or reads into a microphone. Only the lines, each opening with its emotion tag as the
 * author wrote it, one blank line between lines (so it can be cut line by line). No times, labels, scene directions, claims or notes.
 */
/**
 * Checks the message an agent is about to send (or sent) at Gate 1 or when the user asks for "the script": the VO script must be ONE block of
 * tagged lines the user can paste into any TTS, byte-for-byte what SCRIPT.md holds, and nowhere else in the message may a second, timed or labelled
 * script appear. `expected` is the project's VO script text (null = format only, outside a project).
 */
function verifyReply(text, expected) {
  const issues = []; const E = (m) => issues.push({level: 'error', msg: m});
  const norm = (t) => t.split('\n').map((l) => l.trim()).join('\n').replace(/\n{2,}/g, '\n\n').trim();
  const fences = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => ({body: m[1], at: m.index, len: m[0].length}));
  const tagged = (b) => { const ps = b.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean); return ps.length && ps.every((x) => /^\[[^\]\n]+\]\s*\S/.test(x)); };
  let block = fences.find((f) => tagged(f.body));
  if (!block) { const m = text.match(/(?:^|\n)((?:\[[^\]\n]+\][^\n]*(?:\n\s*\n|\n?$))+)/); if (m) block = {body: m[1], at: m.index, len: m[0].length, bare: true}; }
  if (!block) { E('no VO script block found: the script must be given as one block of lines, each opening with its emotion tag, a blank line between, for example "[curious] Tau nggak? ..."'); }
  else {
    const body = norm(block.body); const paras = body.split(/\n\n/);
    paras.forEach((para, i) => {
      const where = `VO line ${i + 1}`;
      if (!/^\[[^\]\n]+\]\s*\S/.test(para)) { E(`${where}: it does not open with an emotion tag`); return; }
      if (/\n/.test(para)) E(`${where}: a line is one paragraph; split lines with a blank line, not a line break inside`);
      const b = parseScript(para, null).blocks[0];
      if (b) for (const t of b.tags) if (t.typos.length) E(`${where}: the tag [${t.raw || ''}] has a misspelled word (${t.typos.join(', ')})`);
      if (/\b\d{1,2}(?:[.,]\d+)?\s*[–—-]\s*\d{1,2}(?:[.,]\d+)?\s*(?:s|dtk|detik|sec)\b|\(\s*\d+(?:[.,]\d+)?\s*(?:s|dtk|detik)\s*\)/i.test(para)) E(`${where}: seconds inside the line`);
      if (/^\[[^\]]*\]\s*(?:hook|tahap|beat|scene|adegan|frame|shot|segmen|bagian|outro|cta|closing)\s*(?:\d+|\(|:|—|–|-)/i.test(para)) E(`${where}: a stage label opens the line`);
      if (/\((?:[^)]*\b(?:zoom|kamera|camera|visual|layar|tampil|scene|transisi|shot|cut to|fade)\b[^)]*)\)/i.test(para)) E(`${where}: a stage direction in brackets`);
      if (/^\s*\|/m.test(para)) E(`${where}: a table row inside the VO block`);
    });
    if (expected != null && norm(expected) !== body) {
      const want = norm(expected).split('\n\n'); const at = paras.findIndex((x, i) => x !== want[i]);
      E(`the VO block differs from Storyboard/SCRIPT.md (${paras.length} line(s) vs ${want.length}; first difference at line ${(at < 0 ? Math.min(paras.length, want.length) : at) + 1}). Paste what \`vo-script\` prints, unedited.`);
    }
    text = text.slice(0, block.at) + text.slice(block.at + block.len);
  }
  // Everywhere else: no second script. The structure table may carry time ranges, but not next to spoken sentences.
  const range = /\b\d{1,2}(?:[.,]\d+)?\s*[–—-]\s*\d{1,3}(?:[.,]\d+)?\s*(?:s|dtk|detik|sec)?\b/;
  text.split('\n').forEach((l, i) => {
    const quoted = (l.match(/["“”«][^"“”»]{18,}["“”»]/g) || []).filter((q) => q.split(/\s+/).length >= 4);
    if (range.test(l) && quoted.length) E(`message line ${i + 1}: a time range next to quoted narration ("${quoted[0].slice(0, 36)}..."). That is a second, timed script; the narration appears once, in the VO block, and the timing in the structure table.`);
    if (/^\s*(?:[-*]\s*)?(?:\*\*)?(?:tahap|hook|segmen|adegan|scene)\s*\d*\s*(?:\([^)]*\))?\s*[:—–]\s*\S/i.test(l) && /["“”]|\bnarasi\b|\bnaskah\b/i.test(l)) E(`message line ${i + 1}: a labelled stage with narration ("${l.trim().slice(0, 40)}..."). Stages belong to the storyboard walkthrough, not the script.`);
    if (/\b(?:di mana|dimana|lokasi|path)\b[^\n]{0,40}\b(?:file )?audio\b|\bberapa (?:detik|menit)\b[^\n]{0,30}\baudio\b|\baudio[^\n]{0,30}\bberapa (?:detik|menit)\b/i.test(l)) E(`message line ${i + 1}: asks for the audio path or its length. Never ask: \`vo\`/\`vo-split\` measure the file; ask the user to send it.`);
  });
  return issues;
}
const voScriptText = (blocks) => blocks.map((b) => b.rawText.replace(/\s+/g, ' ').trim()).join('\n\n') + '\n';
/** Asset/agen/vo.txt (clean words, one line per block) and vo-lines.json (every engine's version of each line, from the emotion tags). `engine` also writes lines/lineN.txt. */
function writeVoLines(proj, engine) {
  const blocks = loadScript(proj).blocks.filter((b) => b.text); const dir = P(proj, 'Asset', 'agen'); fs.mkdirSync(dir, {recursive: true});
  const dflt = loadEmotions().default;
  const lines = blocks.map((b, i) => {
    const tags = b.tags.filter((t) => t.tag); const tag = tags[0]?.tag || dflt; const mods = tags[0]?.mods || [], also = tags[0]?.also || [];
    return {n: i + 1, label: b.label, start: b.start, end: b.end, emotion: tag, ...(also.length ? {also} : {}), ...(mods.length ? {modifiers: mods} : {}), emotions: tags.map((t) => ({tag: t.tag, ...(t.mods.length ? {modifiers: t.mods} : {}), afterWord: t.at})), text: b.text,
      engines: {plain: renderLine(b.rawText, 'plain'), edge: {text: renderLine(b.rawText, 'edge'), ...edgeArgs(tag, mods, also)}, elevenlabs: renderLine(b.rawText, 'elevenlabs'), chatterbox: renderLine(b.rawText, 'chatterbox'), voicestudio: renderLine(b.rawText, 'voicestudio')}};
  });
  fs.writeFileSync(P(dir, 'vo.txt'), blocks.map((b) => b.text).join('\n') + '\n');
  fs.writeFileSync(P(dir, 'vo-script.txt'), voScriptText(blocks));
  fs.writeFileSync(P(dir, 'vo-lines.json'), JSON.stringify({note: 'One entry per script block. Edge TTS has no emotion tags: use engines.edge (rate/pitch/volume). elevenlabs keeps v3-style audio tags; chatterbox (VoiceBox Turbo) keeps only [laugh]/[gasp] and is English only.', lines}, null, 1) + '\n');
  if (engine) { const d = P(dir, 'lines'); fs.mkdirSync(d, {recursive: true}); lines.forEach((l) => fs.writeFileSync(P(d, `line${l.n}.txt`), (engine === 'elevenlabs' ? l.engines.elevenlabs : engine === 'chatterbox' ? l.engines.chatterbox : engine === 'voicestudio' ? l.engines.voicestudio : l.engines.plain) + '\n')); }
  return lines;
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
    const sty = opt.style && opt.style !== true ? resolveStyle(opt.style) : null;
    if (opt.style && !sty) die(`unknown style "${opt.style}". \`project.mjs style --list\` shows the 36 styles and their aliases.`, 2);
    const type = opt.type || (sty && sty.category === 'video-editor' ? 'footage' : 'motion'), format = opt.format || 'landscape', narration = String(opt.narration || 'no').toLowerCase();
    const character = String(opt.character === undefined || opt.character === true ? (narration === 'yes' ? 'undecided' : 'none') : opt.character).toLowerCase();
    if (!/^(none|undecided|[a-z][a-z0-9-]*)$/.test(character)) die('--character: a character id (lowercase letters, digits, dashes), none (voice only) or undecided', 2);
    if (!['motion', 'footage'].includes(type) || !SIZES[format] || !['yes', 'no'].includes(narration)) die('--type motion|footage, --format landscape|portrait|square, --narration yes|no', 2);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); const proj = path.join(rootDir(opt), brand, `${date}-${slug}`);
    if (exists(proj)) die(`already exists: ${proj}`);
    for (const d of folderList({type})) fs.mkdirSync(P(proj, d), {recursive: true});
    const dur = num(opt.duration) || 30; const sub = (s) => s.replace(/{{brand}}/g, brand).replace(/{{slug}}/g, slug).replace(/{{duration}}/g, dur).replace(/{{narration}}/g, narration).replace(/{{size}}/g, SIZES[format]).replace(/{{wps}}/g, DEFAULT_WPS);
    const put = (from, to) => fs.writeFileSync(P(proj, to), sub(read(path.join(TPL, from))));
    put('STRUCTURE.md', 'Storyboard/STRUCTURE.md'); put('SCRIPT.md', 'Storyboard/SCRIPT.md'); put('STORYBOARD.md', 'Storyboard/STORYBOARD.md'); put('REFERENCES.md', 'Reference/REFERENCES.md'); put('ANALYSIS.md', 'Reference/_TEMPLATE.analysis.md'); put('ASSETS.md', 'Asset/ASSETS.md'); if (type === 'footage') put('SOURCES.md', 'Raw-Footage/SOURCES.md');
    const g = () => ({status: 'none', at: '', evidence: '', hash: ''});
    const data = {project: slug, brand, title: slug, type, format, size: SIZES[format], fps: FPS, target_duration: dur, created: now(), stage: 'new', narration, voice: opt.voice || (narration === 'yes' ? 'undecided' : 'none'), character, style: sty ? sty.id : 'undecided', language: opt.language && opt.language !== true ? opt.language : 'id-ID', structure: 'yes', acc: {script: g(), storyboard: g(), sample: g(), final: g()}};
    const body = `# ${slug}\n\n## Brief (the user's own words, do not paraphrase)\n> ${String(opt.brief).replace(/\n/g, '\n> ')}\n\n## Goal, audience, CTA\n-\n\n## Final decisions (do not reopen on revisions)\n-\n\n## History\n- ${now()} — project created (${type}, ${format} ${SIZES[format]}, ${dur}s, ${FPS} fps, narration ${narration})\n`;
    saveProject(proj, data, body);
    if (sty) fs.writeFileSync(P(proj, 'Storyboard', 'style.json'), JSON.stringify(sty, null, 1) + '\n');
    out(`created ${proj}\nstyle: ${sty ? sty.name : 'undecided (project.mjs style --for "<brief>", then set-style)'}\nnext: ${type === 'footage' ? 'put the clips in Raw-Footage/ and name the part each beat uses in STRUCTURE.md; ' : ''}write Storyboard/STRUCTURE.md (the beats), ${narration === 'yes' ? 'then `script-init`, the words in SCRIPT.md, `check script`, `submit script`, and STOP for the user (Gate 1 = structure + script)' : 'then STORYBOARD.md'}${narration === 'yes' ? '\n\n' + GATE1_CONTRACT : ''}`);
  },
  status(pos, opt) {
    const list = [];
    if (pos[0]) list.push(findProject(pos[0], opt)); else { const root = rootDir(opt); if (exists(root)) for (const b of fs.readdirSync(root)) { const bd = path.join(root, b); if (fs.statSync(bd).isDirectory()) for (const p of fs.readdirSync(bd)) if (exists(path.join(bd, p, 'PROJECT.md'))) list.push(path.join(bd, p)); } }
    if (!list.length) out(`no projects under ${rootDir(opt)}`);
    for (const proj of list) {
      const {data} = loadProject(proj); const talk = narrated(data);
      const rel = path.relative(process.cwd(), proj); out(`${rel && !rel.startsWith('..') ? rel : proj}\n  ${data.type} ${data.format} ${data.size} ${data.fps} fps ${data.target_duration}s  narration=${data.narration}  character=${data.character}  voice=${data.voice}${data.style ? `  style=${data.style}` : ''}`);
      { const fi = folderIssues(proj, data); if (fi.any) out(`  FOLDER INCOMPLETE: missing ${fi.text}; run \`repair\``); }
      const gates = [...(talk ? ['script'] : []), 'storyboard', 'sample', 'final'];
      for (const g of gates) out(`  gate ${g.padEnd(10)} ${accState(proj, g, data)}${data.acc?.[g]?.evidence ? `   "${String(data.acc[g].evidence).slice(0, 60)}"` : ''}`);
      const st = Object.fromEntries(gates.map((g) => [g, accState(proj, g, data)])); const nx = [];
      if (String(data.style) === 'undecided') nx.push('choose the video style: `style --for "<brief>"`, show 2-3 fits, then `set-style` (it sets the rhythm the structure is written for)');
      else if (talk && st.script !== 'approved') nx.push(st.script === 'waiting' ? 'ask the user to approve the structure and the script' : 'write/fix STRUCTURE.md then SCRIPT.md: check script, submit script');
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
    if (what === 'script') { const r = checkScript(proj); if (r.rows.length) printScriptTable(r); printStructure(r.structure); const e = printIssues(r.issues); process.exit(e ? 1 : 0); }
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
    if (what === 'script') { printScriptTable(r); printStructure(r.structure); } else if (r.plan) printPlan(r.plan);
    const e = printIssues(r.issues); if (e) die('\nfix the errors, then submit again.');
    if (what === 'storyboard' && talk && !loadVoReport(proj) && !opt.estimate) die('\nno measured audio. Produce the voice and run `vo` first, or pass --estimate "the user\'s reason" (for example: the user records later and the visuals are fitted to the real file).');
    if (opt.estimate && opt.estimate !== true) logLine(proj, `storyboard submitted on ESTIMATED voice timing: ${opt.estimate}`);
    const f = P(proj, 'Storyboard', what === 'script' ? 'SCRIPT.md' : 'STORYBOARD.md'); const ts = now().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
    fs.copyFileSync(f, f.replace(/\.md$/, `.submitted-${ts}.md`));
    if (what === 'script') writeVoLines(proj);
    if (what === 'storyboard') writePlan(proj, r, data);
    const fresh = loadProject(proj); fresh.data.acc[what] = {status: 'waiting', at: now(), evidence: '', hash: currentHash(proj, what, fresh.data)}; fresh.data.stage = `acc-${what}`; saveProject(proj, fresh.data, fresh.body);
    logLine(proj, `${what} submitted (hash ${fresh.data.acc[what].hash}), waiting for the user`);
    if (what === 'script') {
      out('\n================ VO SCRIPT (copy-ready; the file is Asset/agen/vo-script.txt) ================');
      process.stdout.write(read(P(proj, 'Asset', 'agen', 'vo-script.txt')));
      out('================ end of VO SCRIPT ================');
      out('\nAt this stop show the user TWO separate things: (1) the structure table, (2) the VO SCRIPT above in a code block, exactly as printed. Nothing else is mixed in:\n  - the VO script holds no times, scene directions, labels or notes (it is what they take to any TTS, or read into a microphone). Do not paste the LINE BUDGETS table beside it: that table is a check for you;\n  - zoom highlights, cursor, transitions and what is on screen second by second are the STORYBOARD: explain them at Gate 2 (`explain`), not now;\n  - never ask how long their audio is: `vo` / `vo-split` measure it from the file.');
    } else {
      out('\n================ STORYBOARD, in plain words (`project.mjs explain` prints this again) ================'); explainStoryboard(proj);
      out('\nAt this stop explain ONLY the storyboard, from the walkthrough above: per frame what is on screen, the zoom highlights, the cursor and narrator moments, the transitions, and the files still needed from the user. Do not repeat the script.');
    }
    out(`\nSUBMITTED ${what}. STOP: wait for their answer. Do not continue until they approve in their own words.`);
  },
  approve(pos, opt) {
    const [what, p] = pos; if (!['script', 'storyboard', 'sample', 'final'].includes(what)) die('usage: approve script|storyboard|sample|final <project> --evidence "..."', 2);
    const proj = findProject(p, opt); const {data, body} = loadProject(proj);
    const ev = opt.evidence === true ? '' : String(opt.evidence || '').trim(); if (ev.length < 3) die('--evidence is required: the user\'s own words approving this, quoted. Silence, a teammate\'s message or your own judgement is not approval.', 2);
    const s = accState(proj, what, data);
    if (what === 'script' || what === 'storyboard') { if (s !== 'waiting') die(`cannot approve ${what}: state is ${s}. ${s === 'stale' ? 'The file changed after submit; check and submit again.' : 'Submit it first.'}`); }
    else { const why = gate(proj, what === 'sample' ? 'build' : 'sample'); if (what === 'sample' && !hasMp4(P(proj, 'Result', 'sample'))) why.push('Result/sample has no video'); if (what === 'final' && (accState(proj, 'sample', data) !== 'approved' || !fs.readdirSync(P(proj, 'Result')).some((d) => /^v\d+$/.test(d) && hasMp4(P(proj, 'Result', d))))) why.push('needs an approved sample and a full render in Result/vN'); if (why.length) die(`cannot approve ${what}: ${why.join('; ')}`); }
    data.acc[what] = {status: 'approved', at: now(), evidence: ev, hash: what === 'sample' || what === 'final' ? hashStoryboard(proj, data) : currentHash(proj, what, data)};
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
    const sc = loadScript(proj); const blocks = sc.blocks.filter((b) => b.text);
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
  intake(pos, opt) {
    const brief = pos.join(' ').trim(); if (!brief) die('usage: intake "<the user\'s brief in their own words>" [--category motion-graphics|video-editor|motion-3d] [--json]', 2);
    const r = intakeBrief(brief); const cat = opt.category && opt.category !== true ? String(opt.category) : r.read.category;
    if (cat && !r.round2[cat]) die(`--category must be one of ${Object.keys(r.round2).join(', ')}`, 2);
    if (opt.json) { out(JSON.stringify(opt.category ? {...r, questions: r.round2[cat]} : {...r, gate1_contract: GATE1_CONTRACT}, null, 1)); return; }
    const show = (qs) => qs.forEach((q, i) => { out(`  ${i + 1}. [${q.header}]${q.multiSelect ? ' (choose any)' : ''} ${q.question}`); q.options.forEach((o) => out(`       - ${o.label}: ${o.description}`)); });
    if (opt.category) { out(`ROUND 2 for ${cat}: ask these in ONE batch (the style of that category, then its technical needs):`); show(r.round2[cat]); return; }
    out('KNOWN from the brief:'); (r.known.length ? r.known : [{field: '-', value: 'nothing explicit', from: ''}]).forEach((k) => out(`  ${String(k.field).padEnd(12)} ${k.value}   (${k.from})`));
    out('\nASSUMED (state in one line, the user corrects at Gate 1; do not ask):'); r.assumed.forEach((a) => out(`  ${String(a.field).padEnd(12)} ${a.value}   (${a.why})`));
    out(r.questions.length ? `\nROUND 1 (${r.questions.length} question(s), ONE batch, recommended answer first):` : '\nROUND 1: nothing to ask.'); show(r.questions);
    out(cat ? `\nROUND 2 follows, for ${cat}: \`intake "<brief>" --category ${cat}\` prints it (the style of that category and its technical needs).` : '\nROUND 2 follows once the type of video is known: `intake "<brief>" --category <the answer>` prints the style of that category and its technical needs.');
    out('\n' + GATE1_CONTRACT);
  },
  style(pos, opt) {
    const {styles} = loadStyles();
    if (opt.for) { const rec = recommend(String(opt.for), {n: 3, category: opt.category && opt.category !== true ? String(opt.category) : undefined}); out(`styles for "${String(opt.for).slice(0, 70)}":`); rec.forEach((r, i) => out(`  ${i + 1}. ${r.style.name.padEnd(20)} ${r.style.category.padEnd(16)} ${r.style.about}${r.why.length ? `  [matches: ${r.why.join(', ')}]` : ''}`)); return; }
    if (!pos[0] || opt.list) { for (const c of ['motion-3d', 'motion-graphics', 'video-editor'].filter((c) => !opt.category || opt.category === c)) { out(`${c}:`); Object.values(styles).filter((x) => x.category === c).forEach((x) => out(`  ${x.name.padEnd(20)} ${x.about}`)); } return; }
    const x = resolveStyle(pos.join(' ')); if (!x) die(`unknown style "${pos.join(' ')}". Try \`style --list\`.`);
    out(`${x.name} (${x.category}, built with ${x.build})\n  ${x.about}\n  look:    ${x.look}\n  motion:  ${x.motion}\n  camera:  ${x.camera}\n  audio:   ${x.audio}\n  avoid:   ${x.avoid.join('; ')}\n  palette: bg ${x.palette.bg}  text ${x.palette.fg}  accent ${x.palette.accent}  accent2 ${x.palette.accent2}  muted ${x.palette.muted}\n  rhythm:  a shot every ${x.shotSec[0]}-${x.shotSec[1]} s, transition ${x.transition.kind}${x.transition.sec ? ' ' + x.transition.sec + ' s' : ''}, zoom up to ${x.zoomMax}x, on-screen text up to ${x.maxWords} words, at most ${x.gestures} narrator gestures per 10 s${x.stepFps ? `, poses stepped at ${x.stepFps} fps` : ''}\n  ease:    enter ${x.ease.enter}, move ${x.ease.move}\n  sfx:     ${x.sfx.join(', ') || 'none'}${x.fit ? `\n  character: ${x.fit}` : ''}`);
  },
  'set-style'(pos, opt) {
    const [p, ...n] = pos; const x = resolveStyle(n.join(' ')); if (!n.length || !x) die(n.length ? `unknown style "${n.join(' ')}". \`style --list\` shows them.` : 'usage: set-style <project> <name>', n.length ? 1 : 2);
    const proj = findProject(p, opt); const {data, body} = loadProject(proj);
    data.style = x.id; saveProject(proj, data, body); fs.writeFileSync(P(proj, 'Storyboard', 'style.json'), JSON.stringify(x, null, 1) + '\n');
    logLine(proj, `style set to ${x.name}`); out(`style: ${x.name} (${x.category}, ${x.build})`);
    if (x.build === 'footage-overlay' && data.type !== 'footage') out('  note: this style edits real footage; the project type is "motion". Add Raw-Footage/ and list the clips in STRUCTURE.md, or pick a motion style.');
    if (x.fit && narrated(data)) out(`  character: ${x.fit}`);
    if (['storyboard'].some((g) => accState(proj, g, data) === 'stale')) out('  the storyboard approval is now stale (the style is part of what was approved); check, submit and ask again.');
  },
  'script-init'(pos, opt) {
    const proj = findProject(pos[0], opt); const {data} = loadProject(proj); if (!narrated(data)) die('narration is off for this project: there is no spoken script (on-screen copy goes in the storyboard)');
    if (!exists(structFile(proj))) die('Storyboard/STRUCTURE.md is missing: write the beats first, the script expresses them');
    const st = checkStructure(proj); if (st.issues.some((i) => i.level === 'error')) { printIssues(st.issues); die('fix the structure first'); }
    const file = P(proj, 'Storyboard', 'SCRIPT.md'); const cur = exists(file) ? read(file) : '';
    const filled = cur && parseScript(cur, structureBeats(proj)).blocks.some((b) => b.text && !/^TODO\b/i.test(b.text.replace(/^\[[^\]]*\]\s*/, '')));
    if (filled && !opt.force) die('SCRIPT.md already has words; pass --force to start it over');
    const parsed = parseStructure(read(structFile(proj))); const kv = (b, k) => (b.kv.find(([x]) => x === k) || [, ''])[1];
    const paras = parsed.beats.filter((b) => kv(b, 'vo').toLowerCase() !== 'none').map((b) => `[${(kv(b, 'emotion').split(/[,\s]/)[0] || 'neutral').toLowerCase()}] TODO`);
    const fm = cur.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/); const front = fm ? fm[0].replace(/\n?$/, '\n') : `---\ntitle: ${data.project}\nlanguage: ${data.language}\nnarration: yes\nwps: ${DEFAULT_WPS}\n---\n`;
    fs.writeFileSync(file, `${front}# Script: ${data.project}\n\n${paras.join('\n\n')}\n\n## Claims\n| claim | status | source |\n|---|---|---|\n`);
    out(`wrote Storyboard/SCRIPT.md: ${paras.length} spoken beat(s), one tagged paragraph each, in the order of STRUCTURE.md.\nReplace every TODO with the words that beat says (the tag's emotion is the structure's; change it if the words need another). Nothing else goes in this file: no seconds, labels or directions.\nThen \`check script\`, \`submit script\`.`);
    logLine(proj, 'script skeleton written from the structure');
  },
  'vo-lines'(pos, opt) {
    const proj = findProject(pos[0], opt); const {data} = loadProject(proj); if (!narrated(data)) die('narration is off for this project');
    if (!exists(P(proj, 'Storyboard', 'SCRIPT.md'))) die('Storyboard/SCRIPT.md is missing');
    const eng = opt.engine && opt.engine !== true ? String(opt.engine).toLowerCase().replace('voicebox', 'chatterbox') : null;
    if (eng && !ENGINES.includes(eng)) die(`engine must be one of ${ENGINES.join(', ')} (voicebox = chatterbox)`, 2);
    const lines = writeVoLines(proj, eng);
    out('  #  window           emotion     edge rate/pitch/volume   text');
    lines.forEach((l) => out(`  ${String(l.n).padStart(1)}  ${f2(l.start).padStart(5)}–${f2(l.end).padEnd(6)}  ${l.emotion.padEnd(10)}  ${(l.engines.edge.rate + ' ' + l.engines.edge.pitch + ' ' + l.engines.edge.volume).padEnd(22)}   ${l.text.slice(0, 48)}`));
    out(`\nwrote Asset/agen/vo-lines.json${eng ? ` and Asset/agen/lines/line1..${lines.length}.txt (${eng})` : ''}`);
    out('Edge TTS (no emotion tags; the settings above carry the emotion), one file per line, for example:\n  edge-tts --voice id-ID-GadisNeural --rate=<rate> --pitch=<pitch> --volume=<volume> --text "<text>" --write-media Asset/agen/line1.mp3\nThen `vo-place <project> --fit --lufs -15`. The emotion tags drive the narrator\'s face and gestures either way.');
  },
  'verify-reply'(pos, opt) {
    const [a, b] = pos; const fromStdin = (f) => (f === '-' ? fs.readFileSync(0, 'utf8') : read(f));
    if (opt['format-only']) { const f = typeof opt['format-only'] === 'string' ? opt['format-only'] : a; if (!f) die('usage: verify-reply --format-only <message-file|->', 2); process.exit(printIssues(verifyReply(fromStdin(f), null)) ? 1 : 0); }
    if (!a || !b) die('usage: verify-reply <project> <message-file|-> [--format-only <file>]\n  Checks the message you are about to send at Gate 1 (or when the user asks for the script). Run it, fix every error, then send.', 2);
    const proj = findProject(a, opt); const sc = loadScript(proj).blocks.filter((x) => x.text); if (!sc.length) die('the script has no lines yet');
    process.exit(printIssues(verifyReply(fromStdin(b), voScriptText(sc))) ? 1 : 0);
  },
  'vo-script'(pos, opt) {
    const proj = findProject(pos[0], opt); const {data} = loadProject(proj); if (!narrated(data)) die('narration is off for this project');
    if (!exists(P(proj, 'Storyboard', 'SCRIPT.md'))) die('Storyboard/SCRIPT.md is missing');
    const sc = loadScript(proj); const blocks = sc.blocks.filter((b) => b.text); if (!blocks.length) die('the script has no lines');
    const bad = blocks.filter((b) => b.tags.some((t) => t.typos.length)).length; if (bad) die(`${bad} line(s) carry a misspelled tag; run \`check script\` first`);
    fs.mkdirSync(P(proj, 'Asset', 'agen'), {recursive: true}); const text = voScriptText(blocks); fs.writeFileSync(P(proj, 'Asset', 'agen', 'vo-script.txt'), text); process.stdout.write(text);
  },
  'vo-split'(pos, opt) {
    const [p, audio] = pos; if (!audio) die('usage: vo-split <project> <audio> [--min-gap S] [--force]', 2);
    const proj = findProject(p, opt); const {data} = loadProject(proj); if (!narrated(data)) die('narration is off for this project');
    const why = gate(proj, 'voice'); if (why.length) die('blocked: ' + why.join('; '));
    const dir = P(proj, 'Asset', 'agen'); const have = exists(dir) ? fs.readdirSync(dir).filter((f) => /^line\d+\./i.test(f)) : [];
    if (have.length && !opt.force) die(`Asset/agen already has ${have.slice(0, 3).join(', ')}${have.length > 3 ? '...' : ''}; pass --force to replace the line files`);
    for (const f of have) fs.rmSync(P(dir, f));
    const {report, script} = measureVoice(proj, path.resolve(audio), num(opt['min-gap']) || 0);
    if (!report.mapped) die(`found ${report.segments.length} speech run(s) but the script has ${script.length} lines, so the recording cannot be cut by its pauses. Leave a pause of 0.5 s or more between lines, or try --min-gap S.`);
    const segs = report.segments; const PAD_IN = 0.12, PAD_OUT = 0.25;
    segs.forEach((sg, i) => {
      const from = Math.max(i ? (segs[i - 1].end + sg.start) / 2 : 0, sg.start - PAD_IN), to = Math.min(i + 1 < segs.length ? (sg.end + segs[i + 1].start) / 2 : report.duration, sg.end + PAD_OUT);
      const f = P(dir, `line${i + 1}.wav`); const r = spawnSync(ffbin('ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.resolve(audio), '-ss', from.toFixed(3), '-to', to.toFixed(3), '-c:a', 'pcm_s16le', f], {encoding: 'utf8'});
      if (r.status !== 0) die(`ffmpeg could not cut line ${i + 1}: ${(r.stderr || '').split('\n').slice(-3).join(' ')}`);
      out(`  line ${i + 1}: ${f2(from)}–${f2(to)} s of the recording -> Asset/agen/line${i + 1}.wav   "${script[i].text.slice(0, 44)}"`);
    });
    fs.rmSync(P(dir, 'vo-report.json'), {force: true}); logLine(proj, `recording ${path.basename(audio)} cut into ${segs.length} line files at its pauses`);
    out(`\n${segs.length} lines cut from ${f2(report.duration)} s of audio, measured at ${report.minGap} s pauses. Check by ear that each file holds the right line, then: \`vo-place ${path.basename(proj)} --fit --lufs -15\`.`);
  },
  explain(pos, opt) { const proj = findProject(pos[0], opt); if (!exists(P(proj, 'Storyboard', 'STORYBOARD.md'))) die('Storyboard/STORYBOARD.md is missing'); explainStoryboard(proj); },
  version(pos, opt) {
    const skill = path.join(HERE, '..'); const v = exists(path.join(skill, 'VERSION')) ? read(path.join(skill, 'VERSION')).trim() : 'unknown';
    const need = {'intake (two rounds)': 'intake', 'checked styles': 'style', 'structure + emotion-tagged script': 'check', 'clean voice script': 'vo-script', 'cut one recording': 'vo-split', 'storyboard walkthrough': 'explain', 'folder repair': 'repair', 'voice routes': 'voice-check'};
    const features = Object.entries(need).filter(([, c]) => COMMANDS[c]).map(([f]) => f);
    const git = (...a) => spawnSync('git', ['-C', skill, ...a], {encoding: 'utf8', timeout: 9000});
    const top = git('rev-parse', '--show-toplevel'); const inGit = top.status === 0; const info = {version: v, features, path: skill, git: null};
    if (inGit) {
      const head = git('rev-parse', '--short', 'HEAD').stdout.trim(); let state = 'not compared';
      if (!opt['no-fetch']) { const f = git('fetch', '--quiet', 'origin'); if (f.status === 0) { const n = parseInt(git('rev-list', '--count', 'HEAD..origin/main').stdout, 10); state = n > 0 ? `BEHIND origin/main by ${n} commit(s): run \`git -C ${top.stdout.trim()} pull\` (a symlink install then updates by itself)` : 'up to date with origin/main'; } else state = 'origin not reachable (offline?): not compared'; }
      info.git = {commit: head, state};
    }
    if (opt.json) { out(JSON.stringify(info, null, 1)); return; }
    out(`removid ${v}${info.git ? ` (commit ${info.git.commit})` : ''}\npath: ${skill}\nfeatures: ${features.join(', ')}`);
    out(info.git ? `status: ${info.git.state}` : 'status: not a git clone (an installed COPY): it does not update itself. Re-run ./install.sh from a fresh clone of https://github.com/Nanzzyy/removid');
  },
  async 'voice-check'(pos, opt) {
    const url = voiceUrl(opt); out('Voice routes on this machine (read-only; nothing is installed or started):');
    const ff = spawnSync(ffbin('ffmpeg'), ['-version'], {encoding: 'utf8'}); const edge = spawnSync('edge-tts', ['--version'], {encoding: 'utf8'});
    out(`  1. agent default: ${edge.status === 0 ? 'edge-tts is installed (id-ID voices, rate/pitch/volume from the emotion tag)' : 'edge-tts not found on PATH; use whatever speech tool this agent already has'}`);
    let pr; try { pr = await probe(url); } catch (e) { pr = {up: false, error: e.message}; }
    out(`  2. local speech server at ${url}: ${pr.up ? 'ANSWERS (vo-synth can use it; the script stays on this machine)' : `not reachable${pr.error ? ' (' + pr.error + ')' : ''}. Only the owner starts one; removid never does.`}`);
    out('  3. the user\'s own audio: always possible. One file per line (Asset/agen/line1.*) then `vo-place`, or one recording then `vo`; `vo-lines` lists the lines to record.');
    out(`  ffmpeg: ${ff.status === 0 ? 'found' : 'not found (needed to measure and place audio)'}`);
  },
  async 'vo-synth'(pos, opt) {
    const proj = findProject(pos[0], opt); const {data} = loadProject(proj); if (!narrated(data)) die('narration is off for this project');
    const why = gate(proj, 'voice'); if (why.length) die('blocked: ' + why.join('; '));
    const url = voiceUrl(opt); try { assertLocal(url); } catch (e) { die(e.message); }
    const pr = await probe(url); if (!pr.up) die(`no speech server answers at ${url}. removid does not start one. Use the agent's default voice, or give your own audio files (Asset/agen/line1.* then \`vo-place\`).`);
    const lines = writeVoLines(proj, 'voicestudio'); const dir = P(proj, 'Asset', 'agen');
    for (const l of lines) {
      const text = l.engines.voicestudio; if (!text) die(`line ${l.n} has no speakable text after the tags were translated`);
      const wav = await synth(url, text, {voice: opt.voice && opt.voice !== true ? String(opt.voice) : 'alloy'}); const f = P(dir, `line${l.n}.wav`); fs.writeFileSync(f, wav);
      const tempo = tempoFor(l.emotion, l.modifiers || [], l.also || []);
      if (Math.abs(tempo - 1) > 0.005) { const t = f.replace(/\.wav$/, '.tmp.wav'); const r = spawnSync(ffbin('ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', '-i', f, '-filter:a', `atempo=${tempo.toFixed(3)}`, t], {encoding: 'utf8'}); if (r.status !== 0) die('ffmpeg atempo failed: ' + (r.stderr || '').split('\n').slice(-3).join(' ')); fs.renameSync(t, f); }
      out(`  line ${l.n} [${l.emotion}] -> ${path.relative(proj, f)} (${wav.length} bytes, tempo ${tempo.toFixed(2)})`);
    }
    logLine(proj, `voice lines synthesized with a local speech server at ${url} (${lines.length} files in Asset/agen)`); out(`\n${lines.length} lines written. Next: \`vo-place ${path.basename(proj)} --fit --lufs -15\`.`);
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
    // the chosen style and the emotion table become TypeScript modules the scenes import (colours, easing, rhythm; the face numbers)
    if (exists(P(proj, 'Storyboard', 'style.json'))) {
      const x = JSON.parse(read(P(proj, 'Storyboard', 'style.json'))); const tokens = {id: x.id, name: x.name, category: x.category, build: x.build, palette: x.palette, transition: x.transition, ease: x.ease, stepFps: x.stepFps, zoomMax: x.zoomMax, shotSec: x.shotSec, maxWords: x.maxWords};
      fs.writeFileSync(P(dest, 'src', 'style.ts'), `// Generated by \`project.mjs scaffold\` from the project's style (${x.name}). Change the style with \`set-style\`, then scaffold again.\nimport type {StyleTokens} from './lib/style.ts';\n\nexport const STYLE: StyleTokens = ${JSON.stringify(tokens, null, 2)};\n`);
    }
    fs.writeFileSync(P(dest, 'src', 'emotions.ts'), emotionsTs());
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
    // One transition per join, from the storyboard (or the style's default): fade, cut, slide or wipe, centred on the frame boundary.
    const fades = clips.slice(1).map((c) => {
      const f = plan.frames.find((x) => x.id === c.id); const tr = f.transition || {kind: 'fade', sec: xf}; const kind = tr.kind === 'none' ? 'fade' : tr.kind; const sec = Math.min(tr.sec ?? xf, xf);
      const boundary = +(f.startFrame / fps).toFixed(4); const at = +(f.startFrame / fps - sec / 2).toFixed(4); const sel = `#s${c.id}`;
      if (kind === 'cut' || sec === 0) return `      tl.set("${sel}", {opacity: 0}, 0);\n      tl.set("${sel}", {opacity: 1}, ${boundary});`;
      if (kind === 'slide') return `      tl.fromTo("${sel}", {x: ${W}}, {x: 0, duration: ${+sec.toFixed(4)}, ease: "power3.inOut"}, ${at});`;
      if (kind === 'wipe') return `      tl.fromTo("${sel}", {clipPath: "inset(0% 100% 0% 0%)"}, {clipPath: "inset(0% 0% 0% 0%)", duration: ${+sec.toFixed(4)}, ease: "power2.inOut"}, ${at});`;
      return `      tl.fromTo("${sel}", {opacity: 0}, {opacity: 1, duration: ${+sec.toFixed(4)}, ease: "power2.inOut"}, ${at});`;
    }).join('\n');
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
      // Generated from Storyboard/plan.json: each clip carries ${handle} frames of picture on both sides of its range; the join into each clip is the transition planned for it (fade, cut, slide or wipe).
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
  repair(pos, opt) {
    const proj = findProject(pos[0], opt); const {data} = loadProject(proj); const fi = folderIssues(proj, data);
    if (!fi.any) { out('the folder schema is complete; nothing to do'); return; }
    for (const d of fi.dirs) fs.mkdirSync(P(proj, d), {recursive: true});
    for (const [f, tpl] of folderFiles(data)) if (!exists(P(proj, f))) { fs.mkdirSync(path.dirname(P(proj, f)), {recursive: true}); fs.writeFileSync(P(proj, f), read(path.join(TPL, tpl)).replace(/{{brand}}/g, data.brand || '').replace(/{{slug}}/g, data.project || '').replace(/{{duration}}/g, data.target_duration || '').replace(/{{narration}}/g, data.narration || '').replace(/{{size}}/g, data.size || '').replace(/{{wps}}/g, DEFAULT_WPS)); }
    if (data.style && data.style !== 'undecided' && !exists(P(proj, 'Storyboard', 'style.json')) && resolveStyle(data.style)) fs.writeFileSync(P(proj, 'Storyboard', 'style.json'), JSON.stringify(resolveStyle(data.style), null, 1) + '\n');
    logLine(proj, `folder schema repaired: restored ${fi.text}`); out(`restored: ${fi.text}\n(nothing existing was overwritten)`);
  },
  log(pos, opt) { const [p, ...t] = pos; if (!t.length) die('usage: log <project> "note"', 2); logLine(findProject(p, opt), t.join(' ')); out('logged'); },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !COMMANDS[cmd]) die(`usage: project.mjs ${Object.keys(COMMANDS).join('|')} ...  (see the header of this file)`, 2);
const {pos, opt} = parseArgs(rest);
Promise.resolve(COMMANDS[cmd](pos, opt)).catch((e) => die(String((e && e.message) || e)));
