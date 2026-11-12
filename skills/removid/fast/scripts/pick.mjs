#!/usr/bin/env node
// Compact style selection; palettes and tokens come from removid's single table.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadStyles, resolveStyle, namedStyles, readBrief, statedCategory, contrast} from '../../scripts/lib-style.mjs';
export const recipes = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8'));
const MOOD = {energetic: /energik|semangat|hype|viral|cepat|punchy/, epic: /epic|epik|megah|sinematik|cinematic/, cheer: /ceria|fun|playful|lucu|imut|happy|seru/,
  chill: /chill|lofi|tenang|elegan|minimalis|santai|calm/, tech: /tech|futuristik|startup|\bai\b|digital|saas|aplikasi|software/, dramatic: /dramatis|emosional|haru|sedih/, warm: /hangat|warm|nostalgia/};
export function styleFor(s, spec) {
  const r = recipes[s.id];
  if (!r) throw new Error(`missing recipe for ${s.id}`);
  const p = {...s.palette};
  p.sub = contrast(p.muted, p.bg) >= 4.5 ? p.muted : p.fg;
  p.hero = contrast(p.accent, p.bg) >= 3 ? p.accent : p.fg;
  return {category: s.category, style: s.name, spec, palette: p, font: r.font,
    recipe: {text: r.text, bg: r.bg, cam: r.cam, sfx: r.sfx, music: r.music},
    tokens: {transition: s.transition.kind, transitionSec: s.transition.sec, ease: s.ease, stepFps: s.stepFps, shotSec: s.shotSec, zoomMax: s.zoomMax, maxWords: s.maxWords},
    look: s.look, motion: s.motion, avoid: s.avoid};
}
export function pick(brief, {style, mood, footage = false} = {}) {
  const b = readBrief(brief), text = brief.toLowerCase();
  const named = style ? resolveStyle(style) : namedStyles(brief)[0];
  if (style && !named) throw new Error(`unknown style: ${style}`);
  if (mood && !Object.hasOwn(MOOD, mood)) throw new Error(`unknown mood: ${mood}`);
  const hasFootage = footage || /\b(footage|rekaman|podcast|wawancara|interview)\b|talking head|edit video|video (saya|ku|ini)/i.test(brief);
  const category = named?.category ?? (hasFootage ? 'video-editor' : statedCategory(brief) ?? 'motion-graphics');
  mood ??= Object.entries(MOOD).find(([, re]) => re.test(text))?.[0];
  const defaults = {'motion-graphics': 'flatlife', 'motion-3d': 'paperworld', 'video-editor': 'impact'};
  const score = (s) => s.topics.filter((k) => text.includes(k)).length * 3 + recipes[s.id].kw.filter((k) => k.length > 2 && (` ${text} `).includes(` ${k} `)).length * 2 + (mood === recipes[s.id].music ? 1 : 0);
  const ranked = Object.values(loadStyles().styles).filter((s) => s.category === category).map((s) => ({s, score: score(s)}))
    .sort((a, b) => b.score - a.score || Number(b.s.id === defaults[category]) - Number(a.s.id === defaults[category]));
  const s = named ?? ranked[0].s, format = b.format ?? 'portrait', dur = b.duration ?? 20;
  if (dur <= 0) throw new Error('duration must be positive');
  const eligible = b.narration === 'no' && dur <= 45 && !hasFootage && category !== 'video-editor';
  return {...styleFor(s, {fps: 60, format, dur, size: {portrait: '1080x1920', landscape: '1920x1080', square: '1440x1440'}[format]}),
    why: named ? 'style disebut user' : `kategori dari brief, style skor ${ranked[0].score}`,
    mood: mood ?? recipes[s.id].music, alternatives: named ? [] : ranked.slice(1, 3).map((x) => x.s.name),
    assumed: [!b.format && 'format 9:16', !b.duration && 'durasi 20 dtk', !mood && `musik ${recipes[s.id].music}`].filter(Boolean),
    fast: {eligible, reason: eligible ? 'silent kit; existing project gates still apply' : 'use the full workflow; confirm narration/footage/duration at intake', dimensionality: category === 'motion-3d' ? '2.5D only; genuine 3D needs the full starter' : '2D'},
    ask: brief.split(/\s+/).filter(Boolean).length < 4 ? ['Topik / produk apa yang divideokan?'] : []};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), opts = {}, words = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--footage' || a === '--pretty') opts[a.slice(2)] = true;
      else if (a === '--style' || a === '--mood') { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${a} needs a value`); opts[a.slice(2)] = args[++i]; }
      else if (a.startsWith('--')) throw new Error(`unknown option: ${a}`);
      else words.push(a);
    }
    console.log(JSON.stringify(pick(words.join(' '), opts), null, opts.pretty ? 1 : 0));
  } catch (e) { console.error(`pick: ${e.message}`); process.exitCode = 1; }
}
