#!/usr/bin/env node
import {writeFileSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {approvedProject} from './project.mjs';
import {styleFor} from './pick.mjs';
import {resolveStyle} from '../../scripts/lib-style.mjs';
// Visual events of each scene type, in seconds from scene start. Scenes.tsx animates on EXACTLY these times, make_audio.py sounds EXACTLY these.
const TYPES = {hook: () => [{at: 1.0, kind: 'slam'}], stat: () => [{at: 0.5, kind: 'count', d: 1.6}, {at: 2.4, kind: 'end'}],
  list: (sc) => (sc.items ?? []).map((_, i) => ({at: Math.round((0.3 + i * 0.35) * 1000) / 1000, kind: 'enter'})), statement: () => [{at: 0.3, kind: 'enter'}, {at: 1.6, kind: 'hit'}],
  cta: () => [{at: 0.4, kind: 'hit'}, {at: 1.4, kind: 'end'}], custom: () => []};
const MUSIC = { // bpm, chord loop, whether the middle gets a breakdown + riser
  energetic: {bpm: 124, bars: ['Am', 'F', 'C', 'G'], brk: true}, epic: {bpm: 120, bars: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am'], brk: true},
  cheer: {bpm: 116, bars: ['C', 'G', 'Am', 'F'], brk: true}, tech: {bpm: 118, bars: ['Am', 'G', 'F', 'Em'], brk: true},
  dramatic: {bpm: 100, bars: ['Am', 'F', 'Dm', 'E'], brk: false}, warm: {bpm: 100, bars: ['C', 'F', 'G', 'C'], brk: false}, chill: {bpm: 92, bars: ['Am', 'F', 'C', 'G'], brk: false}};
const PACK = { // semantic event -> synth type(s) in audio/make_audio.py
  ui: {enter: ['tick'], hit: ['impact'], end: ['bell'], slam: ['impact', 'clap']}, paper: {enter: ['pop'], hit: ['thud'], end: ['plink'], slam: ['thud', 'clap']},
  pop: {enter: ['pop'], hit: ['plink'], end: ['sparkle'], slam: ['impact', 'pop']}, cinema: {enter: ['shimmer'], hit: ['impact'], end: ['bell'], slam: ['impact']},
  type: {enter: ['tick'], hit: ['thud'], end: ['bell'], slam: ['thud', 'clap']}};

export function compile(input) {
  const {project, plan, direction: dir, sourceHash, app} = approvedProject(input);
  if (!Array.isArray(dir.scenes) || dir.scenes.length !== plan.frames.length) throw new Error('direction must contain one scene per approved storyboard frame');
  const st = resolveStyle(plan.style?.id);
  if (!st) throw new Error('choose a project style before using FAST');
  const style = styleFor(st, {fps: plan.fps, size: plan.size, dur: plan.totalSec});
  const m = MUSIC[style.recipe.music], pack = PACK[style.recipe.sfx];
  const bpm = dir.bpm ?? m.bpm;
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) throw new Error('bpm must be between 40 and 240');
  const beat = 60 / bpm, r3 = (x) => Math.round(x * 1000) / 1000;
  const ids = new Set(), bounds = [], scenes = [], sfx = [{t: 0, type: 'impact', gain: .9}];
  dir.scenes.forEach((sc, i) => {
    const f = plan.frames[i], len = f.durationFrames / plan.fps;
    const enterAt = i ? (f.transition.sec || 0) / 2 : 0;
    const leaveAt = len - ((plan.frames[i + 1]?.transition.sec || 0) / 2);
    if (!sc.id || ids.has(sc.id)) throw new Error(`scene ${i + 1}: missing or duplicate id`);
    ids.add(sc.id);
    if (sc.frame !== f.id) throw new Error(`${sc.id}: frame must be ${f.id}`);
    if (sc.beats !== undefined || sc.len !== undefined || sc.start !== undefined || sc.end !== undefined) throw new Error(`${sc.id}: timing comes from the approved storyboard, remove beats/len/start/end`);
    if (!Object.hasOwn(TYPES, sc.type)) throw new Error(`${sc.id}: unknown scene type ${sc.type}`);
    for (const key of {hook: ['text'], stat: ['label'], list: ['title'], statement: ['text', 'sub'], cta: ['text', 'sub'], custom: []}[sc.type])
      if (typeof sc[key] !== 'string' || !sc[key].trim()) throw new Error(`${sc.id}: ${key} is required`);
    if (sc.type === 'stat' && !Number.isFinite(sc.value)) throw new Error(`${sc.id}: value must be finite`);
    if (sc.type === 'list' && (!Array.isArray(sc.items) || !sc.items.length || sc.items.some((x) => typeof x !== 'string' || !x.trim()))) throw new Error(`${sc.id}: nonempty items are required`);
    const strings = Object.fromEntries(['text', 'sub', 'title', 'label'].filter((k) => sc[k] !== undefined).map((k) => [k, sc[k]]));
    if (Object.values(strings).some((x) => typeof x !== 'string')) throw new Error(`${sc.id}: content must be text`);
    if (sc.suffix !== undefined && typeof sc.suffix !== 'string') throw new Error(`${sc.id}: suffix must be text`);
    const content = [...Object.values(strings), ...(sc.items ?? []), ...(sc.type === 'stat' ? [`${sc.value}${sc.suffix ?? ''}`] : [])];
    const norm = (x) => x.replace(/\s+/g, ' ').trim();
    for (const text of content) if (text && !f.text.some((x) => norm(x.text) === norm(text))) throw new Error(`${sc.id}: text ${JSON.stringify(text)} needs a matching storyboard text window (including claims)`);
    const textReady = (text, at = 0, preset = style.recipe.text) => at + (preset === 'type' ? text.length / 28 : .6 + .05 * Math.max(0, text.trim().split(/\s+/).length - 1));
    const reading = sc.type === 'custom' ? [] : [
      ...(sc.text ? [[sc.text, textReady(sc.text, {statement: .3, cta: .4}[sc.type] ?? 0)]] : []),
      ...(sc.title ? [[sc.title, textReady(sc.title)]] : []),
      ...(sc.type === 'stat' ? [[`${sc.value}${sc.suffix ?? ''}`, 2.1], [sc.label, textReady(sc.label, 2.2, 'fade-rise')]] : []),
      ...(sc.items ?? []).map((text, i) => [text, .3 + i * .35 + .6]),
      ...(sc.sub ? [[sc.sub, sc.type === 'cta' ? 1.7 : textReady(sc.sub, 1.8, 'fade-rise')]] : []),
    ];
    for (const [text, ready] of reading) {
      const need = Math.max(1, text.trim().split(/\s+/).length * .3);
      if (leaveAt - .2 - Math.max(ready, enterAt + .2) < need - 1e-9) throw new Error(`${sc.id}: text ${JSON.stringify(text)} cannot finish entering and hold ${need}s before the transition; extend the storyboard frame`);
    }
    if (sc.type === 'custom' && !Array.isArray(sc.hits)) throw new Error(`${sc.id}: custom needs an explicit hits array`);
    const hits = sc.hits ?? TYPES[sc.type](sc);
    if (!Array.isArray(hits)) throw new Error(`${sc.id}: hits must be an array`);
    // Built-in scenes consume this event schedule; changing it requires custom code.
    if (sc.type !== 'custom' && JSON.stringify(hits) !== JSON.stringify(TYPES[sc.type](sc))) throw new Error(`${sc.id}: use custom for a different event schedule`);
    for (const h of hits) {
      if (!Number.isFinite(h.at) || h.at < 0 || h.at >= len || (h.d !== undefined && (!Number.isFinite(h.d) || h.d <= 0 || h.at + h.d > len))) throw new Error(`${sc.id}: hit outside scene or invalid duration`);
      if (!['count', ...Object.keys(pack)].includes(h.kind)) throw new Error(`${sc.id}: unknown hit kind ${h.kind}`);
      if (h.gain !== undefined && (!Number.isFinite(h.gain) || h.gain < 0 || h.gain > 2)) throw new Error(`${sc.id}: gain must be 0–2`);
      const at = f.startFrame / plan.fps + h.at, gain = h.gain ?? .8;
      if (h.kind === 'count') sfx.push({t: at, type: 'ticks', d: h.d ?? 1.5, step: .1, gain}, {t: at, type: 'rise', d: h.d ?? 1.5, gain: .7});
      else for (const type of pack[h.kind]) sfx.push({t: at, type, gain});
    }
    const start = f.startFrame / plan.fps, end = f.endFrame / plan.fps;
    scenes.push({...sc, start, end, hits, enterAt, leaveAt});
    if (i) bounds.push(start);
  });
  const dur = plan.totalSec;
  for (const b of bounds) sfx.push({t: Math.max(0, b - .32), type: 'whoosh', d: .5, gain: .9}, {t: b, type: 'thud', gain: .45});
  const final = Math.max(0, Math.min(dur - .1, Math.round((dur - 1.5) / beat) * beat));
  sfx.push({t: final, type: 'sparkle', gain: .8});
  sfx.sort((a, b) => a.t - b.t);
  const mid = m.brk && bounds.length >= 4;
  const music = {bpm, bars: m.bars, breaks: mid ? [[bounds[2], bounds[3]]] : [], build: mid ? [r3(bounds[3] - 1), bounds[3]] : undefined, final,
    arp_from: bounds[0] ?? 0, hat_from: Math.min(2, bounds[0] ?? 0), clap_from: Math.min(2, bounds[0] ?? 0), final_chord: m.bars[0]};
  const cues = {sourceHash, title: dir.title, dur, fps: plan.fps, bounds, scenes, sfx, music};
  mkdirSync(join(app, 'src'), {recursive: true});
  writeFileSync(join(app, 'src/cues.json'), JSON.stringify(cues, null, 1) + '\n');
  writeFileSync(join(app, 'src/style.json'), JSON.stringify(style, null, 1) + '\n');
  console.log(`cues ok: ${scenes.length} scenes, ${dur}s @ ${bpm} BPM -> ${project}/Source/remotion/src/cues.json`);
  return cues;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { compile(process.argv[2]); } catch (e) { console.error(`cues: ${e.message}`); process.exitCode = 1; }
}
