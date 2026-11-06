#!/usr/bin/env node
// Synthesize the sound-effect track from the approved storyboard (Storyboard/plan.json). No sample files, no network.
//   node sfx.mjs <plan.json> --out Asset/agen/sfx.wav [--gain-db -16]
// Events come from `- sfx: kind @time [gain=0.6]` lines and from every cursor click (a click sound exactly when the click lands).
// Kinds: click, tick, whoosh, impact, chime. Needs a FULL ffmpeg build (REMOVID_FFMPEG / HYPERFRAMES_FFMPEG_PATH / PATH): a minimal
// build lacks aevalsrc, anoisesrc, afade, highpass and lowpass, and this script says so instead of failing inside ffmpeg.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const planFile = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out' && args[args.indexOf(a) - 1] !== '--gain-db');
const out = opt('--out', null);
if (!planFile || !out) { console.error('usage: sfx.mjs <plan.json> --out <file.wav> [--gain-db -16]'); process.exit(2); }
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const events = (plan.sfx || []).filter((e) => e.at >= 0 && e.at < plan.totalSec);
if (!events.length) { console.error('plan.json has no sfx events (add "- sfx: kind @time" lines or cursor clicks, then check the storyboard again)'); process.exit(1); }
const ff = process.env.REMOVID_FFMPEG || process.env.HYPERFRAMES_FFMPEG_PATH || 'ffmpeg';
const have = spawnSync(ff, ['-hide_banner', '-filters'], {encoding: 'utf8'}).stdout || '';
const missing = ['aevalsrc', 'anoisesrc', 'adelay', 'amix', 'afade', 'highpass', 'lowpass', 'aformat', 'apad', 'atrim', 'volume'].filter((n) => !new RegExp(` ${n} `).test(have));
if (missing.length) { console.error(`ffmpeg "${ff}" lacks the filters: ${missing.join(', ')}. This is a minimal build; point REMOVID_FFMPEG (or HYPERFRAMES_FFMPEG_PATH) at a full one.`); process.exit(1); }
const baseGain = 10 ** (Number(opt('--gain-db', -16)) / 20);
const SR = 48000;

// One recipe per kind: [lavfi input, seconds, extra filters]. Deterministic (anoisesrc has a fixed seed).
const R = {
  click: [`aevalsrc='(0.7*sin(2*PI*1700*t)+0.5*sin(2*PI*3400*t))*exp(-t*110)':d=0.12:s=${SR}`, 0.12, ''],
  tick: [`aevalsrc='0.6*sin(2*PI*2600*t)*exp(-t*170)':d=0.08:s=${SR}`, 0.08, ''],
  impact: [`aevalsrc='0.95*sin(2*PI*(52+90*exp(-t*20))*t)*exp(-t*6.5)':d=0.8:s=${SR}`, 0.8, ''],
  chime: [`aevalsrc='exp(-t*2.6)*(sin(2*PI*523.25*t)+0.8*sin(2*PI*659.25*t)+0.6*sin(2*PI*783.99*t))*0.28':d=1.6:s=${SR}`, 1.6, ''],
  whoosh: [`anoisesrc=d=0.7:c=pink:a=0.8:s=7:r=${SR}`, 0.7, 'highpass=f=350,lowpass=f=5500,afade=t=in:d=0.3,afade=t=out:st=0.3:d=0.4'],
};
for (const e of events) if (!R[e.kind]) { console.error(`unknown sfx kind "${e.kind}" (use ${Object.keys(R).join(', ')})`); process.exit(1); }

const inputs = [], chains = [];
events.forEach((e, i) => {
  const [src, , filt] = R[e.kind];
  inputs.push('-f', 'lavfi', '-i', src);
  const ms = Math.round(e.at * 1000);
  chains.push(`[${i}:a]${filt ? filt + ',' : ''}volume=${(baseGain * (e.gain ?? 1)).toFixed(4)},aformat=sample_rates=${SR}:channel_layouts=mono,adelay=${ms}:all=1[e${i}]`);
});
const mix = `${events.map((_, i) => `[e${i}]`).join('')}amix=inputs=${events.length}:normalize=0,apad=whole_dur=${plan.totalSec},atrim=0:${plan.totalSec}[o]`;
const r = spawnSync(ff, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', [...chains, mix].join(';'), '-map', '[o]', '-ar', String(SR), '-ac', '1', out], {encoding: 'utf8'});
if (r.status !== 0) { console.error('ffmpeg failed:\n' + (r.stderr || '').split('\n').slice(-6).join('\n')); process.exit(1); }
console.log(`${events.length} sfx event(s) -> ${out}: ` + events.map((e) => `${e.kind}@${e.at.toFixed(2)}${e.source === 'cursor' ? '(click)' : ''}`).join(' '));
