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
export const modifiers = () => Object.keys(loadEmotions().modifiers);
/** Canonical delivery modifier ("slow" -> "slower"), or null. */
export function canonicalModifier(word) { const {modifiers: m, modifierAliases: a} = loadEmotions(); const w = String(word).toLowerCase().trim(); return m[w] ? w : a[w] && m[a[w]] ? a[w] : null; }
/** The closest known emotion or modifier for a typo. */
export function suggestAny(word) {
  const w = String(word).toLowerCase(); const {tags, aliases, modifiers: m, modifierAliases: ma} = loadEmotions(); let best = null, bd = 99;
  for (const [k, to] of [...Object.keys(tags).map((k) => [k, k]), ...Object.entries(aliases), ...Object.keys(m).map((k) => [k, k]), ...Object.entries(ma)]) { const d = lev(w, k); if (d < bd) { bd = d; best = to; } }
  return bd <= 3 ? best : null;
}
/**
 * What is inside one tag: "[calm, reassuring]" = the emotion calm delivered in a reassuring way; "[thoughtful, slower]"; "[firm, emphatic]".
 * `tag` = the first word that is an emotion (or an alias of one); `mods` = the other words that are delivery modifiers; `bad` = words that are neither.
 */
export function parseTag(content) {
  const words = String(content).split(/[\s,]+/).filter(Boolean); let tag = null; const mods = [], bad = [];
  for (const w of words) { const e = canonical(w); if (e && !tag) { tag = e; continue; } const m = canonicalModifier(w); if (m) { if (!mods.includes(m)) mods.push(m); } else bad.push(w); }
  return {tag, mods, bad};
}

// A tag is "[" words (letters and dashes, separated by commas or spaces) "]". Block headers like [00.0-03.0] never reach here (the script
// parser takes them first) and brackets with a digit are not tags. Any other bracketed words are read as a tag, and an unknown word in one
// is an error: a TTS would otherwise read "[Applause]" aloud.
const TAG_RE = /\[\s*([A-Za-z][A-Za-z, -]{1,48}?)\s*\]/g;
/**
 * Tags in a raw script line, in order. `at` = how many spoken words come before it: 0 means the line is delivered in that emotion from
 * its first word. `countWords` and `clean` come from project.mjs so word counting stays in one place.
 */
export function extractTags(raw, countWords, clean) {
  const tags = []; let m; TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(raw))) tags.push({raw: m[1].trim(), ...parseTag(m[1]), at: countWords(clean(raw.slice(0, m.index))), index: m.index});
  return tags;
}
export const stripTags = (raw) => raw.replace(TAG_RE, ' ').replace(/\s+/g, ' ').trim();

// ---------- how each engine gets a line ----------
const signed = (n, unit) => `${n >= 0 ? '+' : '-'}${Math.abs(n)}${unit}`;
/** Edge TTS has no emotion tags, only rate, pitch and volume; this is how a tag becomes those three (and a pause before the line). */
export function voiceSettings(tag, mods = []) {
  const {tags, modifiers: M} = loadEmotions(); const v = {...tags[tag].voice};
  for (const m of mods) for (const [k, d] of Object.entries(M[m].voice || {})) v[k] = (v[k] || 0) + d;
  v.rate = Math.min(20, Math.max(-20, v.rate)); v.pitch = Math.min(15, Math.max(-15, v.pitch)); v.volume = Math.min(10, Math.max(-10, v.volume)); v.pause = +Math.min(0.5, v.pause).toFixed(2); return v;
}
export function edgeArgs(tag, mods = []) { const v = voiceSettings(tag, mods); return {rate: signed(v.rate, '%'), pitch: signed(v.pitch, 'Hz'), volume: signed(v.volume, '%'), pauseBefore: v.pause}; }
/** The face and body numbers of a delivery: the emotion's, nudged by its modifiers (reassuring smiles a little more, emphatic bounces more). */
export function moodFor(tag, mods = []) {
  const {tags, modifiers: M} = loadEmotions(); const e = tags[tag]; const face = {...e.face}, body = {...e.body};
  for (const m of mods) { for (const [k, d] of Object.entries(M[m].face || {})) face[k] = +Math.min(1, Math.max(-1, face[k] + d)).toFixed(3); for (const [k, d] of Object.entries(M[m].body || {})) body[k] = +Math.min(1.6, Math.max(0, body[k] + d)).toFixed(3); }
  return {face, body, energy: e.energy, gestures: e.gestures};
}
/**
 * The text to send to an engine. plain/edge: no tags (Edge reads "[curious]" aloud); elevenlabs: v3-style audio tags kept in place;
 * chatterbox (VoiceBox Turbo): only its own sound tags ([laugh], [gasp]), everything else dropped, and English only.
 */
export function renderLine(raw, engine) {
  const {tags} = loadEmotions();
  if (engine === 'plain' || engine === 'edge') return stripTags(raw);
  const map = (fn) => raw.replace(TAG_RE, (all, w) => { const p = parseTag(w); const r = p.tag || p.mods.length ? fn(p.tag, p.mods) : null; return r ? ` ${r} ` : ' '; }).replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  // ElevenLabs v3 takes free-form audio tags, so the author's own words go through unchanged: [firm, emphatic], [calm, reassuring]
  if (engine === 'elevenlabs') return raw.replace(TAG_RE, (all, w) => { const p = parseTag(w); return p.tag || p.mods.length ? ` [${w.trim().replace(/\s+/g, ' ')}] ` : ' '; }).replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  if (engine === 'chatterbox' || engine === 'voicebox') return map((t) => (t ? tags[t].chatterbox : null));
  // Voice Studio's default engine knows reaction tags and pauses, not emotion words, and reads an unknown tag aloud: so a tag becomes its
  // documented reaction or pause (or nothing). From its docs; not yet verified against a live server.
  if (engine === 'voicestudio') return map((t) => (t ? tags[t].voicestudio : null));
  throw new Error(`unknown engine ${engine} (plain, edge, elevenlabs, chatterbox)`);
}
export const ENGINES = ['plain', 'edge', 'elevenlabs', 'chatterbox', 'voicestudio'];
/** Tempo factor for an emotion (rate -12..+10 %), for engines that cannot set a rate: applied afterwards with ffmpeg atempo, pitch untouched. */
export const tempoFor = (tag, mods = []) => Math.min(1.12, Math.max(0.88, 1 + voiceSettings(tag, mods).rate / 100));

// ---------- the face over time ----------
/**
 * One segment per tag: from `lead` s before its first spoken word until the next tag starts (the last one holds `tail` s past the
 * final word, then the character relaxes to the default). Each segment carries the absolute face/body numbers so the Remotion scene
 * needs no table: it only blends between neighbours (templates/remotion-starter/src/lib/emotion.ts).
 * `moments`: [{at: seconds the emotion's first word is spoken, tag}], sorted. `endSpeech`: end of the last word.
 */
export function timeline(moments, endSpeech, {lead = 0.2, tail = 0.5} = {}) {
  const {tags, default: dflt, transitionSec} = loadEmotions(); const out = [];
  const pts = moments.map((m) => ({tag: m.tag, mods: m.mods || [], start: Math.max(0, m.at - lead)})).sort((a, b) => a.start - b.start);
  if (pts.length && pts[0].start < 0.8) pts[0].start = 0; // the first delivery owns the opening; a sub-second default before it could not be seen
  if (!pts.length || pts[0].start > 1e-9) pts.unshift({tag: dflt, start: 0});
  pts.forEach((p, i) => { const e = moodFor(p.tag, p.mods); out.push({tag: p.tag, ...(p.mods?.length ? {mods: p.mods} : {}), start: +p.start.toFixed(3), end: +(i + 1 < pts.length ? pts[i + 1].start : endSpeech + tail).toFixed(3), energy: e.energy, face: e.face, body: e.body, gestures: e.gestures}); });
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
