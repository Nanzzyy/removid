// Styles as data: load styles/styles.json, find a style by name or alias, merge category defaults, check palettes, recommend styles
// for a brief, and read a brief for the facts it already states (so the interview asks only what is missing).
// Pure functions, no dependencies. Used by project.mjs; tested by tests/style.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STYLES_FILE = path.join(HERE, '..', 'styles', 'styles.json');
export const EASES = ['inOutSine', 'inOutQuad', 'outCubic', 'smootherstep', 'outBack']; // must exist in templates/remotion-starter/src/lib/ease.ts
export const TRANSITIONS = ['cut', 'fade', 'slide', 'wipe'];
export const SFX = ['click', 'tick', 'whoosh', 'impact', 'chime'];
export const CATEGORIES = ['motion-3d', 'motion-graphics', 'video-editor'];

let cache = null;
export function loadStyles(file = STYLES_FILE) {
  if (cache && file === STYLES_FILE) return cache;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const all = {};
  for (const [id, s] of Object.entries(j.styles)) {
    const d = j.defaults[s.cat];
    if (!d) throw new Error(`style ${id}: unknown category ${s.cat}`);
    const [bg, fg, accent, accent2, muted] = s.pal;
    all[id] = {
      id, name: s.name, category: s.cat, aliases: s.aliases || [], about: s.about, look: s.look, motion: s.motion, camera: s.camera, audio: s.audio, avoid: s.avoid || [], topics: s.for || [], fit: s.fit || '',
      build: s.build ?? d.build, palette: {bg, fg, accent, accent2, muted},
      shotSec: s.shotSec ?? d.shotSec, transition: {kind: (s.transition ?? d.transition)[0], sec: (s.transition ?? d.transition)[1]},
      zoomMax: s.zoomMax ?? d.zoomMax, maxWords: s.maxWords ?? d.maxWords, holdMin: s.holdMin ?? d.holdMin,
      ease: {...d.ease, ...(s.ease || {})}, stepFps: s.stepFps ?? d.stepFps, gestures: s.gestures ?? d.gestures, sfx: s.sfx ?? d.sfx,
    };
  }
  const out = {styles: all, note: j._};
  if (file === STYLES_FILE) cache = out;
  return out;
}

const key = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
/** A style by id ("clay-3d"), name ("CLAY-3D"), or alias ("clay", "tanah liat"). Null if none. */
export function resolveStyle(name, file) {
  if (!name) return null; const {styles} = loadStyles(file); const k = key(name); if (!k) return null;
  for (const s of Object.values(styles)) if (key(s.id) === k || key(s.name) === k) return s;
  for (const s of Object.values(styles)) if (s.aliases.some((a) => key(a) === k)) return s;
  return null;
}

// ---------- colour ----------
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function luminance(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) throw new Error(`not a #rrggbb colour: ${hex}`); const n = parseInt(m[1], 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); }
export function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
/** Palette rules: text reads on the background (4.5:1); each accent can be written in (3:1 on the background) or written on (the text colour reads on it, 4.5:1). */
export function paletteIssues(s) {
  const p = s.palette; const out = [];
  if (contrast(p.fg, p.bg) < 4.5) out.push(`text ${p.fg} on ${p.bg} is ${contrast(p.fg, p.bg).toFixed(1)}:1, needs 4.5`);
  for (const k of ['accent', 'accent2']) if (contrast(p[k], p.bg) < 3 && contrast(p.fg, p[k]) < 4.5 && contrast(p.bg, p[k]) < 4.5) out.push(`${k} ${p[k]} can neither be read on ${p.bg} (3:1) nor carry text (4.5:1)`);
  return out;
}

// ---------- recommendation ----------
const tokens = (t) => String(t).toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(Boolean);
/** Styles for a brief, best first: topic keywords score 2 each, an alias named in the brief wins outright. `category` limits the list. */
export function recommend(brief, {category, n = 3} = {}) {
  const {styles} = loadStyles(); const text = ' ' + tokens(brief).join(' ') + ' ';
  const rows = Object.values(styles).filter((s) => !category || s.category === category).map((s) => {
    const hits = s.topics.filter((w) => text.includes(' ' + tokens(w).join(' ') + ' '));
    return {style: s, score: hits.length * 2, why: hits};
  });
  rows.sort((a, b) => b.score - a.score || (a.style.category === 'motion-graphics' ? -1 : 1));
  return rows.slice(0, n);
}
/**
 * Styles the text NAMES, by name or alias, longest match first. Most names are ordinary words ("system", "peta", "impact"), so such a word
 * counts only when a cue precedes it ("gaya clay", "pakai midnight", "style SYSTEM"); coined names (VOXELVERSE, CLAY-3D) need no cue.
 */
const CUES = new Set(['gaya', 'style', 'styles', 'bergaya', 'pakai', 'pake', 'gunakan', 'menggunakan', 'ala', 'use', 'using', 'tipe', 'look', 'model']);
const COINED = /^(?:[a-z]+(?:verse|story|world|forge|works|flow)|zack[a-z ]*|clay ?3d|claymation|voxel|minecraft|8bit)$/;
export function namedStyles(brief) {
  const {styles} = loadStyles(); const T = tokens(brief); const found = [];
  for (const s of Object.values(styles)) for (const term of [s.name, s.id, ...s.aliases]) {
    const w = tokens(term); if (!w.length) continue;
    for (let i = 0; i + w.length <= T.length; i++) {
      if (!w.every((x, k) => T[i + k] === x)) continue;
      const coined = COINED.test(w.join(' ')) || w.join('').length >= 11; const cued = T.slice(Math.max(0, i - 4), i).some((x) => CUES.has(x));
      if (coined || cued) found.push({style: s, len: w.join(' ').length, at: i});
    }
  }
  found.sort((a, b) => b.len - a.len || a.at - b.at); const seen = new Set();
  return found.filter((f) => !seen.has(f.style.id) && seen.add(f.style.id)).map((f) => f.style);
}

// ---------- the brief ----------
const PLATFORMS = [
  [/\b(reels?|tik\s*tok|tiktok|shorts?|instagram\s*stor(?:y|ies)|ig\s*stor(?:y|ies)|vertikal|vertical|9\s*:\s*16)\b/i, 'portrait'],
  [/\b(instagram\s*feed|feed|square|persegi|1\s*:\s*1)\b/i, 'square'],
  [/\b(youtube|linkedin|website|web|landing|presentasi|presentation|slide|horizontal|landscape|16\s*:\s*9|iklan tv|demo)\b/i, 'landscape'],
];
/** What a brief already states. Everything not found stays null so the caller knows what is still open. */
export function readBrief(brief) {
  const t = String(brief); const r = {duration: null, format: null, platform: null, narration: null, language: null, voiceEngine: null, style: null, claims: []};
  const sec = /(\d+(?:[.,]\d+)?)\s*(?:detik|dtk|sec(?:ond)?s?|s)\b/i.exec(t); const min = /(\d+(?:[.,]\d+)?)\s*(?:menit|min(?:ute)?s?)\b/i.exec(t);
  if (sec) r.duration = parseFloat(sec[1].replace(',', '.')); else if (min) r.duration = parseFloat(min[1].replace(',', '.')) * 60;
  for (const [re, fmt] of PLATFORMS) { const m = re.exec(t); if (m) { r.format = fmt; r.platform = m[1].toLowerCase(); break; } }
  if (/\b(tanpa\s+(?:suara|narasi|vo|voice)|silent|bisu|teks\s+saja|text only)\b/i.test(t)) r.narration = 'no';
  else if (/\b(narasi|narator|narrat\w*|voice\s*over|voiceover|\bvo\b|suara|bersuara|naskah|script|bercerita|story\s*telling|dubbing|cerita|story|jelaskan|menjelaskan|explain\w*)\b/i.test(t)) r.narration = 'yes';
  if (/\b(yang|dan|untuk|dengan|buat|buatkan|tentang|sebuah|saya|aku|tidak|bisa|agar|supaya|dari|hingga|ke)\b/i.test(t)) r.language = 'id-ID'; else if (/[a-z]{3,}/i.test(t)) r.language = 'en-US';
  if (/elevenlabs|eleven labs/i.test(t)) r.voiceEngine = 'elevenlabs'; else if (/voice\s*box|voicebox/i.test(t)) r.voiceEngine = 'voicebox'; else if (/voice\s*studio|voicestudio/i.test(t)) r.voiceEngine = 'voicestudio'; else if (/edge\s*tts/i.test(t)) r.voiceEngine = 'edge'; else if (/(rekaman|suara|audio)\s+(?:saya|sendiri|aku)|(?:kirim|upload|masukkan)\s+(?:file\s+)?audio|my own (?:voice|recording|audio)/i.test(t)) r.voiceEngine = 'own-audio';
  const named = namedStyles(t); if (named.length) r.style = named[0];
  const bare = t.replace(/\d+(?:[.,]\d+)?\s*(?:detik|dtk|sec(?:ond)?s?|s|menit|min(?:ute)?s?|fps|x|kali|:)\b/gi, ' ').replace(/\b(?:9|16|1)\s*:\s*(?:16|9|1)\b/g, ' ');
  r.claims = (bare.match(/\d+\s*%|\bgratis\b|\bfree\b|\bdiskon\b|\bdiscount\b|\bgaransi\b|\bguarantee\b|\btestimoni\w*|\btestimonial\b|\bterbaik\b|\bnomor\s*1\b|https?:\/\/\S+|\b[a-z0-9-]+\.(?:id|com|site|io|co|net|app|dev|org|ai)\b|\b\d{2,}\b/gi) || []).map((x) => x.toLowerCase());
  return r;
}

export const CATEGORY_INFO = {
  'motion-graphics': {label: 'Motion graphics (2D)', how: 'Dibuat penuh di Remotion: explainer, data, peta, tipografi bergerak, promo aplikasi.', needs: 'tanpa footage'},
  'video-editor': {label: 'Video editing (dari footage)', how: 'Kamu mengirim footage atau talking head; footage dipotong dan diberi teks, label, dan grafis di atasnya.', needs: 'butuh footage dari kamu'},
  'motion-3d': {label: 'Motion 3D (karakter dan dunia)', how: 'Cerita atau penjelasan dengan karakter dan dunia 3D yang dibuat dengan kode (three.js).', needs: 'tanpa footage'},
};
/** The category a brief asks for in so many words, or null. */
export function statedCategory(brief) {
  const t = String(brief);
  if (/motion\s*graphics?|mograph\b|infografis bergerak|2d explainer/i.test(t)) return 'motion-graphics';
  if (/video\s*edit(?:ing|or)?\b|\bedit(?:ing)?\s+(?:video|footage|rekaman|podcast)|\bedit\s+(?:klip|talking)|talking\s*head|\bpodcast\b|\bpotong\s+(?:video|footage|klip)/i.test(t)) return 'video-editor';
  if (/motion\s*3d\b|\b3d\b|karakter\s*3d|\bvoxel\b|\bclay\b|claymation|\bpixel\b/i.test(t)) return 'motion-3d';
  return null;
}
/** Technical needs worth asking, by category (multi-select; none selected = the standard). */
const techQuestion = (category) => ({id: 'tech', header: 'Teknis', multiSelect: true, question: `Kebutuhan teknis untuk ${CATEGORY_INFO[category].label}? (kosongkan bila standar saja cukup)`, options: [
  category === 'video-editor' ? {label: 'Footage dari saya', description: 'Saya akan menyebutkan file dan bagian klip yang dipakai; tanpa itu struktur tidak bisa disusun.', value: {needs: 'footage'}} : {label: 'Logo dan brand kit dari saya', description: 'Warna, font, dan logo yang harus dipakai menggantikan palet gaya; file masuk Asset/owner.', value: {needs: 'brand'}},
  {label: 'Caption atau subtitle di layar', description: 'Teks ucapan tampil per kata, sesuai suara yang diukur.', value: {needs: 'captions'}},
  {label: 'Musik latar', description: 'Lagu dari saya atau musik yang boleh dipakai; tempo diukur sebelum potongan direncanakan.', value: {needs: 'music'}},
  category === 'video-editor' ? {label: 'Logo dan brand kit dari saya', description: 'Warna, font, dan logo menggantikan palet gaya.', value: {needs: 'brand'}} : {label: 'Data atau angka untuk ditampilkan', description: 'Saya memberi angka dan sumbernya; tidak ada yang dikarang.', value: {needs: 'data'}}]});
const styleQuestion = (brief, category) => {
  const rec = recommend(brief, {category, n: 3}); const all = Object.values(loadStyles().styles).filter((x) => x.category === category); const shown = new Set(rec.map((r) => r.style.id));
  return {id: 'style', header: 'Gaya', question: `Gaya ${CATEGORY_INFO[category].label} yang mana? (saya urutkan dari yang paling cocok dengan topikmu)`, options: [...rec.map((r, i) => ({label: `${r.style.name}${i === 0 ? ' (Recommended)' : ''}`, description: `${r.style.about}${r.why.length ? ` Cocok: ${r.why.slice(0, 3).join(', ')}.` : ''}`, value: {style: r.style.id}})),
    {label: 'Gaya lain di kategori ini', description: `Pilih lewat Other, tulis namanya: ${all.filter((x) => !shown.has(x.id)).map((x) => x.name).join(', ')}.`, value: {style: 'other'}}]};
};

const FORMAT_LABEL = {portrait: 'Vertikal 1080x1920 (Reels/TikTok/Shorts)', landscape: 'Lebar 1920x1080 (YouTube/web/presentasi)', square: 'Persegi 1440x1440 (feed)'};
/**
 * The interview, reduced to what the brief leaves open. At most 4 questions, each with the recommended answer first. Everything else is
 * returned in `assumed` so the agent states it in one line and the user corrects it at Gate 1 instead of being asked up front.
 */
export function intake(brief) {
  const b = readBrief(brief); const known = [], assumed = [], questions = [];
  if (b.duration) known.push({field: 'duration', value: b.duration, from: 'the brief'}); else assumed.push({field: 'duration', value: 30, why: 'short social default; 15 s for a pure hook, 60 s only if asked'});
  if (b.format) known.push({field: 'format', value: b.format, from: `"${b.platform}"`});
  else questions.push({id: 'format', header: 'Format', question: 'Video ini untuk platform apa? (menentukan ukuran dan panjang)', options: [
    {label: 'Vertikal 30 dtk (Reels/TikTok/Shorts) (Recommended)', description: FORMAT_LABEL.portrait + ', 30 detik, 60 fps', value: {format: 'portrait', duration: b.duration || 30}},
    {label: 'Lebar 30-60 dtk (YouTube/web)', description: FORMAT_LABEL.landscape + ', 60 fps', value: {format: 'landscape', duration: b.duration || 45}},
    {label: 'Persegi 30 dtk (feed)', description: FORMAT_LABEL.square, value: {format: 'square', duration: b.duration || 30}}]});
  if (b.language) known.push({field: 'language', value: b.language, from: 'the brief wording'}); else assumed.push({field: 'language', value: 'id-ID', why: 'Indonesian unless the brief is in another language'});
  const stated = b.style ? b.style.category : statedCategory(brief); const guess = recommend(brief, {n: 1})[0];
  const inferred = stated || (/\b(story|cerita|karakter|tokoh|dongeng|tokoh)\b/i.test(brief) ? 'motion-3d' : guess && guess.score > 0 ? guess.style.category : null);
  if (b.style) known.push({field: 'style', value: b.style.name, from: 'named in the brief'}, {field: 'category', value: b.style.category, from: 'the style'});
  else if (stated) known.push({field: 'category', value: stated, from: 'the brief'});
  else {
    const order = ['motion-3d', 'motion-graphics', 'video-editor'].sort((x, y) => (x === inferred ? -1 : y === inferred ? 1 : 0));
    questions.unshift({id: 'category', header: 'Jenis video', question: 'Mau bikin jenis video yang mana dulu? (gaya dan kebutuhan teknisnya kita pilih sesudah ini)', options: order.map((c, i) => ({label: `${CATEGORY_INFO[c].label}${i === 0 && inferred ? ' (Recommended)' : ''}`, description: `${CATEGORY_INFO[c].how} ${Object.values(loadStyles().styles).filter((x) => x.category === c).length} gaya; ${CATEGORY_INFO[c].needs}.`, value: {category: c}}))});
  }
  if (b.narration === 'no') known.push({field: 'narration', value: 'no', from: 'the brief says silent'});
  else if (b.narration === 'yes' && b.voiceEngine) known.push({field: 'narration', value: 'yes', from: 'the brief'}, {field: 'voice', value: b.voiceEngine, from: 'the brief'});
  else {
    if (b.narration === 'yes') known.push({field: 'narration', value: 'yes', from: 'the brief'});
    questions.push({id: 'voice', header: 'Suara', question: b.narration === 'yes' ? 'Suara narasinya dari mana?' : 'Perlu narasi suara?', options: [
      {label: 'Narasi + karakter 3D, suara default agent (Recommended)', description: 'Agent membuat suaranya sendiri dengan mesin yang ia punya (Edge TTS Indonesia, atau mesin lain yang sudah dikonfigurasi pemiliknya) dan satu karakter yang bergerak mengikuti naskah. Tidak ada yang dipasang di mesinmu.', value: {narration: 'yes', character: 'undecided', voice: 'agent-default'}},
      {label: 'Narasi suara default agent, tanpa karakter', description: 'Suara yang sama, tanpa karakter; layar dan teks yang bercerita.', value: {narration: 'yes', character: 'none', voice: 'agent-default'}},
      {label: 'Saya kirim file audio sesuai naskah', description: 'Agent membuat naskah dan daftar baris-barisnya; kamu merekam atau membuat audionya sendiri (satu file per baris, atau satu rekaman utuh) dan memasukkannya. Timing diukur dari file-nya.', value: {narration: 'yes', character: 'undecided', voice: 'own-audio'}},
      {label: 'Tanpa suara (teks di layar)', description: 'Tidak ada naskah suara dan tidak ada karakter.', value: {narration: 'no', character: 'none', voice: 'none'}}]});
  }
  if (b.claims.length) questions.push({id: 'proof', header: 'Bukti', question: `Brief menyebut ${[...new Set(b.claims)].slice(0, 4).join(', ')}. Mana yang sudah pasti benar dan boleh ditulis di video?`, options: [
    {label: 'Semua benar dan boleh dipakai', description: 'Saya catat sebagai owner-confirmed di tabel Claims.', value: {claims: 'owner-confirmed'}},
    {label: 'Belum pasti: tandai sebagai contoh (Recommended)', description: 'Dipasang sebagai placeholder yang terlihat; render akhir menunggu kamu mengonfirmasi.', value: {claims: 'placeholder'}},
    {label: 'Buang semua angka dan klaim', description: 'Naskah ditulis tanpa angka atau penawaran.', value: {claims: 'none'}}]});
  assumed.push({field: 'fps', value: 60, why: 'default; 30 only if the platform asks'}, {field: 'voice engine', value: b.voiceEngine || 'agent-default', why: b.voiceEngine ? 'named in the brief' : 'the agent\'s own engine (Edge TTS id-ID unless the owner configured another); nothing is installed for the user, and the user may supply audio files instead'}, {field: 'hook / structure / CTA', value: 'drafted by the agent', why: 'shown in STRUCTURE.md at Gate 1 for correction, not asked up front'});
  // Round 2 depends on the category the user picks (or the brief states): the style of THAT category, then its technical needs.
  const round2 = Object.fromEntries(Object.keys(CATEGORY_INFO).map((c) => [c, [...(b.style ? [] : [styleQuestion(brief, c)]), techQuestion(c)]]));
  return {brief, known, assumed, questions: questions.slice(0, 4), round2, read: {...b, style: b.style?.id || null, category: stated || null}};
}
