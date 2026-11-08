// Emotion tags in a script ([curious], [furious], [nostalgic], [calm, reassuring] ...): an open vocabulary (15 tuned presets, a shipped lexicon, a project's own words), how to find tags in a line, how a tag is
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
const lower = (w) => String(w).toLowerCase().trim();
const r3 = (x) => +x.toFixed(3);

// ---------- an open vocabulary ----------
// Any word can be an emotion. Fifteen are PRESETS with tuned numbers (tags); each other word has a point in a two-number space, valence
// (unpleasant..pleasant) and arousal (calm..energetic): the shipped `lexicon` (about 175 words, English and Indonesian), or a project's own
// Storyboard/emotions.custom.json ({"wistful": {"va": [0.1, 0.2]}} or {"gloomy": {"like": "sad"}}). A word with a point takes its face, voice and
// body from the three nearest presets, weighted by distance, so [furious], [nostalgic] and [terrified] all work without a list of rules.
// A word nobody knows is not an error: its face stays neutral, a warning says so, and engines that take free-form tags receive it as written.
let custom = {};
/** A project's own words. `obj` = {word: {va: [valence, arousal]} | {like: "preset or known word"}}. */
export function setCustomLexicon(obj) { custom = {}; for (const [k, v] of Object.entries(obj || {})) custom[lower(k)] = v; }
export function loadCustomLexicon(file) { try { setCustomLexicon(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { setCustomLexicon({}); } }
/** The tag key for a word ("happy" -> "warm", "furious" -> "furious"), or null when nobody knows the word. */
export function resolveEmotion(word) {
  const {tags, aliases, lexicon} = loadEmotions(); const w = lower(word);
  if (tags[w]) return w; if (aliases[w] && tags[aliases[w]]) return aliases[w]; if (custom[w] || lexicon[w]) return w; return null;
}
/** Kept for callers that only want to know whether a word is an emotion at all. */
export const canonical = resolveEmotion;
export const isPreset = (k) => !!loadEmotions().tags[k];
function vaOf(k, depth = 0) {
  const E = loadEmotions(); if (E.tags[k]) return [E.valence[k] ?? 0, E.tags[k].energy];
  const c = custom[k]; if (c?.va) return c.va; if (c?.like && depth < 3) { const l = resolveEmotion(c.like); if (l) return vaOf(l, depth + 1); }
  return E.lexicon[k] || [0, E.tags[E.default].energy];
}
const NUM = (o, f) => ({...o, ...Object.fromEntries(Object.keys(o).map((k) => [k, f(k)]))});
const mixObj = (a, b, w) => Object.fromEntries(Object.keys(a).map((k) => [k, r3(a[k] * (1 - w) + b[k] * w)]));
const profiles = new Map(); const sig = () => JSON.stringify(custom);
/**
 * The numbers for a word: {energy, face, body, voice, gestures, eleven, chatterbox, voicestudio, source, nearest}. A preset returns its own
 * line; any other word is blended from the nearest presets; `also` (second emotion words in the same tag) are mixed in at 35% each.
 */
export function profileOf(k, also = []) {
  const E = loadEmotions(); const ck = `${sig()}|${k}|${also.join(',')}`; if (profiles.has(ck)) return profiles.get(ck);
  let p;
  const fam = E.lexicon[k]?.[2]; const lk = custom[k]?.like && resolveEmotion(custom[k].like);
  if (E.tags[k]) p = {...E.tags[k], source: 'preset', nearest: k};
  else if (lk && lk !== k) p = {...profileOf(lk), eleven: k, source: 'custom'}; // "like": the word is that emotion
  else if (fam && E.tags[fam]) { // a family word: the preset's face, scaled by how intense the word is (irritated is a milder mad than furious)
    const T = E.tags; const base = T[fam], neu = T[E.default]; const a = vaOf(k)[1]; const kf = Math.min(1.15, Math.max(0.5, a / base.energy));
    const RANGE = {smile: [-1, 1], brow: [-1, 1], raise: [0, 1], eye: [0.6, 1.4], tilt: [-0.2, 0.2]}; const face = Object.fromEntries(Object.keys(base.face).map((f) => [f, r3(Math.min(RANGE[f][1], Math.max(RANGE[f][0], neu.face[f] + (base.face[f] - neu.face[f]) * kf)))]));
    const voice = {...base.voice, rate: r3(base.voice.rate + (a - base.energy) * 10), volume: r3(base.voice.volume + (a - base.energy) * 6)};
    p = {...base, energy: r3(a), face, body: {bounce: r3(Math.max(0, base.body.bounce * (0.6 + 0.4 * kf)))}, voice, eleven: k, chatterbox: null, voicestudio: kf >= 0.85 ? base.voicestudio : null, source: 'lexicon', nearest: fam};
  } else {
    const va = vaOf(k); const names = Object.keys(E.tags);
    const near = names.map((n) => { const [v, a] = vaOf(n); return {n, d2: (v - va[0]) ** 2 + (a - va[1]) ** 2}; }).sort((x, y) => x.d2 - y.d2).slice(0, 3);
    const w = near.map((x) => 1 / (x.d2 + 0.005) ** 2); const sum = w.reduce((x, y) => x + y, 0); const T = E.tags;
    const mix = (get) => near.reduce((acc, x, i) => acc + get(T[x.n]) * w[i] / sum, 0);
    const face = Object.fromEntries(Object.keys(T.neutral.face).map((f) => [f, r3(mix((t) => t.face[f]))]));
    const voice = Object.fromEntries(Object.keys(T.neutral.voice).map((f) => [f, r3(mix((t) => t.voice[f]))]));
    const near1 = near[0]; const exact = near1.d2 < 0.0144;
    p = {energy: r3(va[1]), face, body: {bounce: r3(mix((t) => t.body.bounce))}, voice, gestures: T[near1.n].gestures, eleven: k, chatterbox: null, voicestudio: exact ? T[near1.n].voicestudio : null, source: custom[k] ? 'custom' : 'lexicon', nearest: near1.n};
  }
  for (const o of also.slice(0, 2)) { const q = profileOf(o); p = {...p, energy: r3(p.energy * 0.65 + q.energy * 0.35), face: mixObj(p.face, q.face, 0.35), body: mixObj(p.body, q.body, 0.35), voice: mixObj(p.voice, q.voice, 0.35)}; }
  profiles.set(ck, p); return p;
}
const allKnown = () => { const E = loadEmotions(); return [...Object.keys(E.tags), ...Object.keys(E.aliases), ...Object.keys(E.lexicon), ...Object.keys(custom), ...Object.keys(E.modifiers), ...Object.keys(E.modifierAliases)]; };
/** A near miss for a typo (only for words of 5+ letters, so short real words are never "corrected"); null when the word may simply be new. */
export function typoOf(word) {
  const w = lower(word); if (w.length < 5 || allKnown().includes(w)) return null; const lim = w.length >= 7 ? 2 : 1; let best = null, bd = 99;
  for (const k of allKnown()) { const d = lev(w, k); if (d < bd) { bd = d; best = k; } }
  return bd <= lim ? best : null;
}
/** The nearest known word for any input (for messages), tolerant to 3 edits. */
export function suggestAny(word) { const w = lower(word); let best = null, bd = 99; for (const k of allKnown()) { const d = lev(w, k); if (d < bd) { bd = d; best = k; } } return bd <= 3 ? best : null; }
export const suggest = suggestAny;
/** The tuned presets (the rest of the vocabulary is open). */
export const vocabulary = () => Object.keys(loadEmotions().tags);
export const lexiconWords = () => [...new Set([...Object.keys(loadEmotions().lexicon), ...Object.keys(custom)])];
export const modifiers = () => Object.keys(loadEmotions().modifiers);
/** Canonical delivery modifier ("slow" -> "slower"), or null. */
export function canonicalModifier(word) { const {modifiers: m, modifierAliases: a} = loadEmotions(); const w = lower(word); return m[w] ? w : a[w] && m[a[w]] ? a[w] : null; }
/**
 * What is inside one tag: "[calm, reassuring]", "[thoughtful, slower]", "[nostalgic]", "[excited, nervous]".
 * `tag` = the first word that is an emotion (preset, alias, lexicon or project word), "neutral" when there is none; `found` says whether there was one;
 * `also` = further emotion words (mixed in); `mods` = delivery modifiers; `free` = words nobody knows (kept for free-form engines);
 * `typos` = unknown words that look like a misspelling of a known one: [{word, suggestion}].
 */
export function parseTag(content) {
  const words = String(content).split(/[\s,]+/).filter(Boolean); let tag = null; const also = [], mods = [], free = [], typos = [];
  for (const w of words) {
    const e = resolveEmotion(w); if (e) { if (!tag) tag = e; else if (e !== tag && !also.includes(e)) also.push(e); continue; }
    const m = canonicalModifier(w); if (m) { if (!mods.includes(m)) mods.push(m); continue; }
    const t = typoOf(w); if (t) typos.push({word: w, suggestion: t}); else free.push(w);
  }
  return {tag: tag || loadEmotions().default, found: !!tag, also, mods, free, typos};
}

// A tag is "[" words (letters and dashes, separated by commas or spaces) "]". Block headers like [00.0-03.0] never reach here (the script
// parser takes them first) and brackets with a digit are not tags. Every bracketed word group is a tag: Edge and the other engines that
// cannot use free words never read it aloud (it is stripped or translated), ElevenLabs gets it as written.
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
export function voiceSettings(tag, mods = [], also = []) {
  const {modifiers: M} = loadEmotions(); const v = {...profileOf(tag, also).voice};
  for (const m of mods) for (const [k, d] of Object.entries(M[m].voice || {})) v[k] = (v[k] || 0) + d;
  v.rate = Math.min(20, Math.max(-20, v.rate)); v.pitch = Math.min(15, Math.max(-15, v.pitch)); v.volume = Math.min(10, Math.max(-10, v.volume)); v.pause = +Math.min(0.5, v.pause).toFixed(2); return v;
}
export function edgeArgs(tag, mods = [], also = []) { const v = voiceSettings(tag, mods, also); return {rate: signed(v.rate, '%'), pitch: signed(v.pitch, 'Hz'), volume: signed(v.volume, '%'), pauseBefore: v.pause}; }
/** The face and body numbers of a delivery: the emotion's, nudged by its modifiers (reassuring smiles a little more, emphatic bounces more). */
export function moodFor(tag, mods = [], also = []) {
  const {modifiers: M} = loadEmotions(); const e = profileOf(tag, also); const face = {...e.face}, body = {...e.body};
  for (const m of mods) { for (const [k, d] of Object.entries(M[m].face || {})) face[k] = +Math.min(1, Math.max(-1, face[k] + d)).toFixed(3); for (const [k, d] of Object.entries(M[m].body || {})) body[k] = +Math.min(1.6, Math.max(0, body[k] + d)).toFixed(3); }
  return {face, body, energy: e.energy, gestures: e.gestures};
}
/**
 * The text to send to an engine. plain/edge: no tags (Edge reads "[curious]" aloud); elevenlabs: v3-style audio tags kept in place;
 * chatterbox (VoiceBox Turbo): only its own sound tags ([laugh], [gasp]), everything else dropped, and English only.
 */
export function renderLine(raw, engine) {
  if (engine === 'plain' || engine === 'edge') return stripTags(raw);
  const map = (fn) => raw.replace(TAG_RE, (all, w) => { const p = parseTag(w); const r = p.found ? fn(p.tag) : null; return r ? ` ${r} ` : ' '; }).replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  // ElevenLabs v3 takes free-form audio tags, so the author's own words go through unchanged: [firm, emphatic], [calm, reassuring]
  if (engine === 'elevenlabs') return raw.replace(TAG_RE, (all, w) => ` [${w.trim().replace(/\s+/g, ' ')}] `).replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  if (engine === 'chatterbox' || engine === 'voicebox') return map((t) => profileOf(t).chatterbox);
  // Voice Studio's default engine knows reaction tags and pauses, not emotion words, and reads an unknown tag aloud: so a tag becomes its
  // documented reaction or pause (or nothing). From its docs; not yet verified against a live server.
  if (engine === 'voicestudio') return map((t) => profileOf(t).voicestudio);
  throw new Error(`unknown engine ${engine} (plain, edge, elevenlabs, chatterbox)`);
}
export const ENGINES = ['plain', 'edge', 'elevenlabs', 'chatterbox', 'voicestudio'];
/** Tempo factor for an emotion (rate -12..+10 %), for engines that cannot set a rate: applied afterwards with ffmpeg atempo, pitch untouched. */
export const tempoFor = (tag, mods = [], also = []) => Math.min(1.12, Math.max(0.88, 1 + voiceSettings(tag, mods, also).rate / 100));

// ---------- the face over time ----------
/**
 * One segment per tag: from `lead` s before its first spoken word until the next tag starts (the last one holds `tail` s past the
 * final word, then the character relaxes to the default). Each segment carries the absolute face/body numbers so the Remotion scene
 * needs no table: it only blends between neighbours (templates/remotion-starter/src/lib/emotion.ts).
 * `moments`: [{at: seconds the emotion's first word is spoken, tag}], sorted. `endSpeech`: end of the last word.
 */
export function timeline(moments, endSpeech, {lead = 0.2, tail = 0.5} = {}) {
  const {default: dflt, transitionSec} = loadEmotions(); const out = [];
  const pts = moments.map((m) => ({tag: m.tag, mods: m.mods || [], also: m.also || [], start: Math.max(0, m.at - lead)})).sort((a, b) => a.start - b.start);
  if (pts.length && pts[0].start < 0.8) pts[0].start = 0; // the first delivery owns the opening; a sub-second default before it could not be seen
  if (!pts.length || pts[0].start > 1e-9) pts.unshift({tag: dflt, start: 0});
  pts.forEach((p, i) => { const e = moodFor(p.tag, p.mods, p.also); out.push({tag: p.tag, ...(p.also?.length ? {also: p.also} : {}), ...(p.mods?.length ? {mods: p.mods} : {}), start: +p.start.toFixed(3), end: +(i + 1 < pts.length ? pts[i + 1].start : endSpeech + tail).toFixed(3), energy: e.energy, face: e.face, body: e.body, gestures: e.gestures}); });
  const d0 = profileOf(dflt); out.push({tag: dflt, start: +(endSpeech + tail).toFixed(3), end: null, energy: d0.energy, face: d0.face, body: d0.body, gestures: d0.gestures});
  return {segments: out, transitionSec};
}
export const energy = (tag, also = []) => profileOf(tag, also).energy;
export const gesturesFor = (tag) => profileOf(tag).gestures;

/** The starter's copy of the table (face, body, energy, gestures; not the voice settings). Written by `scaffold`, checked for drift by the tests. */
export function emotionsTs() {
  const {tags, transitionSec, default: dflt} = loadEmotions();
  const t = Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, {energy: v.energy, face: v.face, body: v.body, gestures: v.gestures}]));
  return `// Generated from skills/removid/styles/emotions.json by \`project.mjs scaffold\`. Do not edit: change the table, then scaffold again.\n// Used by the emotion sheet (\`npm run character -- <id> --emotions\`); a real video reads its segments from plan.json.\nexport const EMOTION_DEFAULT = ${JSON.stringify(dflt)};\nexport const EMOTION_TRANSITION_SEC = ${transitionSec};\nexport const EMOTION_TABLE = ${JSON.stringify(t, null, 2)} as const;\n`;
}
