// Emotion tags in a script ([curious], [mad], [laugh] ...): the closed vocabulary, aliases, how to find tags in a line, how a tag is
// spoken by each kind of voice engine, and the timeline of the narrator's face. One table (styles/emotions.json) feeds all of it.
// Pure functions, no dependencies. Used by project.mjs; tested by tests/emotion.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EMOTIONS_FILE = path.join(HERE, '..', 'styles', 'emotions.json');
let cache = null;
export function loadEmotions() { return (cache ||= JSON.parse(fs.readFileSync(EMOTIONS_FILE, 'utf8'))); }

const lev = (a, b) => { const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
/** Canonical emotion for a tag word ("happy" -> "warm"), or null. */
export function canonical(word) { const {tags, aliases} = loadEmotions(); const w = String(word).toLowerCase().trim(); return tags[w] ? w : aliases[w] && tags[aliases[w]] ? aliases[w] : null; }
/** The closest known tag for a typo, for the error message. */
export function suggest(word) { const {tags, aliases} = loadEmotions(); const w = String(word).toLowerCase(); let best = null, bd = 99; for (const k of [...Object.keys(tags), ...Object.keys(aliases)]) { const d = lev(w, k); if (d < bd) { bd = d; best = canonical(k); } } return bd <= 3 ? best : null; }
export const vocabulary = () => Object.keys(loadEmotions().tags);

// A tag is "[" a word (letters, dash) "]". Block headers like [00.0-03.0] never reach here (the script parser takes them first), and
// anything with a digit or a space is not a tag, so ordinary brackets in copy are left alone.
const TAG_RE = /\[\s*([A-Za-z][A-Za-z-]{1,20})\s*\]/g;
/**
 * Tags in a raw script line, in order. `at` = how many spoken words come before it: 0 means the line is delivered in that emotion from
 * its first word. `countWords` and `clean` come from project.mjs so word counting stays in one place.
 */
export function extractTags(raw, countWords, clean) {
  const tags = []; let m; TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(raw))) tags.push({raw: m[1], tag: canonical(m[1]), at: countWords(clean(raw.slice(0, m.index))), index: m.index});
  return tags;
}
export const stripTags = (raw) => raw.replace(TAG_RE, ' ').replace(/\s+/g, ' ').trim();

// ---------- how each engine gets a line ----------
const signed = (n, unit) => `${n >= 0 ? '+' : '-'}${Math.abs(n)}${unit}`;
/** Edge TTS has no emotion tags, only rate, pitch and volume; this is how a tag becomes those three (and a pause before the line). */
export function edgeArgs(tag) { const v = loadEmotions().tags[tag].voice; return {rate: signed(v.rate, '%'), pitch: signed(v.pitch, 'Hz'), volume: signed(v.volume, '%'), pauseBefore: v.pause}; }
/**
 * The text to send to an engine. plain/edge: no tags (Edge reads "[curious]" aloud); elevenlabs: v3-style audio tags kept in place;
 * chatterbox (VoiceBox Turbo): only its own sound tags ([laugh], [gasp]), everything else dropped, and English only.
 */
export function renderLine(raw, engine) {
  const {tags} = loadEmotions();
  if (engine === 'plain' || engine === 'edge') return stripTags(raw);
  const map = (fn) => raw.replace(TAG_RE, (all, w) => { const t = canonical(w); const r = t ? fn(t) : null; return r ? ` ${r} ` : ' '; }).replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  if (engine === 'elevenlabs') return map((t) => (tags[t].eleven ? `[${tags[t].eleven}]` : null));
  if (engine === 'chatterbox' || engine === 'voicebox') return map((t) => tags[t].chatterbox);
  // Voice Studio's default engine knows reaction tags and pauses, not emotion words, and reads an unknown tag aloud: so a tag becomes its
  // documented reaction or pause (or nothing). From its docs; not yet verified against a live server.
  if (engine === 'voicestudio') return map((t) => tags[t].voicestudio);
  throw new Error(`unknown engine ${engine} (plain, edge, elevenlabs, chatterbox)`);
}
export const ENGINES = ['plain', 'edge', 'elevenlabs', 'chatterbox', 'voicestudio'];
/** Tempo factor for an emotion (rate -12..+10 %), for engines that cannot set a rate: applied afterwards with ffmpeg atempo, pitch untouched. */
export const tempoFor = (tag) => { const r = loadEmotions().tags[tag].voice.rate; return Math.min(1.12, Math.max(0.88, 1 + r / 100)); };

// ---------- the face over time ----------
/**
 * One segment per tag: from `lead` s before its first spoken word until the next tag starts (the last one holds `tail` s past the
 * final word, then the character relaxes to the default). Each segment carries the absolute face/body numbers so the Remotion scene
 * needs no table: it only blends between neighbours (templates/remotion-starter/src/lib/emotion.ts).
 * `moments`: [{at: seconds the emotion's first word is spoken, tag}], sorted. `endSpeech`: end of the last word.
 */
export function timeline(moments, endSpeech, {lead = 0.2, tail = 0.5} = {}) {
  const {tags, default: dflt, transitionSec} = loadEmotions(); const out = [];
  const pts = moments.map((m) => ({tag: m.tag, start: Math.max(0, m.at - lead)})).sort((a, b) => a.start - b.start);
  if (pts.length && pts[0].start < 0.8) pts[0].start = 0; // the first delivery owns the opening; a sub-second default before it could not be seen
  if (!pts.length || pts[0].start > 1e-9) pts.unshift({tag: dflt, start: 0});
  pts.forEach((p, i) => { const e = tags[p.tag]; out.push({tag: p.tag, start: +p.start.toFixed(3), end: +(i + 1 < pts.length ? pts[i + 1].start : endSpeech + tail).toFixed(3), energy: e.energy, face: e.face, body: e.body, gestures: e.gestures}); });
  out.push({tag: dflt, start: +(endSpeech + tail).toFixed(3), end: null, energy: tags[dflt].energy, face: tags[dflt].face, body: tags[dflt].body, gestures: tags[dflt].gestures});
  return {segments: out, transitionSec};
}
export const energy = (tag) => loadEmotions().tags[tag].energy;
export const gesturesFor = (tag) => loadEmotions().tags[tag].gestures;

/** The starter's copy of the table (face, body, energy, gestures; not the voice settings). Written by `scaffold`, checked for drift by the tests. */
export function emotionsTs() {
  const {tags, transitionSec, default: dflt} = loadEmotions();
  const t = Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, {energy: v.energy, face: v.face, body: v.body, gestures: v.gestures}]));
  return `// Generated from skills/removid/styles/emotions.json by \`project.mjs scaffold\`. Do not edit: change the table, then scaffold again.\n// Used by the emotion sheet (\`npm run character -- <id> --emotions\`); a real video reads its segments from plan.json.\nexport const EMOTION_DEFAULT = ${JSON.stringify(dflt)};\nexport const EMOTION_TRANSITION_SEC = ${transitionSec};\nexport const EMOTION_TABLE = ${JSON.stringify(t, null, 2)} as const;\n`;
}
