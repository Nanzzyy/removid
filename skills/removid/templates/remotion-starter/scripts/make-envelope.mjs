#!/usr/bin/env node
// Lip-sync envelope: one 0..1 mouth-opening value per video frame, computed OFFLINE from narration audio.
//   node scripts/make-envelope.mjs public/narration/sample.mp3 [--out file.json] [--fps 60]
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg). Any audio ffmpeg can decode works.
import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out' && args[args.indexOf(a) - 1] !== '--fps');
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
if (!input) {
  console.error('usage: make-envelope.mjs <audio> [--out file.json] [--fps 60]');
  process.exit(2);
}
const fps = Number(opt('--fps', '60'));
const out = opt('--out', input.replace(/\.[^.]+$/, '') + '.envelope.json');
const SR = 16000;

// WAV on stdout works on every ffmpeg build (minimal builds lack the raw s16le muxer).
const dec = spawnSync(process.env.FFMPEG ?? 'ffmpeg', ['-v', 'error', '-i', input, '-ac', '1', '-ar', String(SR), '-f', 'wav', '-'], {maxBuffer: 1 << 30});
if (dec.status !== 0 || !dec.stdout?.length) {
  console.error('ffmpeg could not decode the input:', dec.stderr?.toString() || 'no output');
  process.exit(1);
}
const wav = dec.stdout;
let pos = 12; // skip RIFF....WAVE, then walk chunks to "data" (streamed WAVs carry an unknown size)
while (pos + 8 <= wav.length && wav.toString('ascii', pos, pos + 4) !== 'data') pos += 8 + wav.readUInt32LE(pos + 4);
if (pos + 8 > wav.length) {
  console.error('no data chunk in decoded audio');
  process.exit(1);
}
const dataStart = pos + 8;
const copy = Buffer.from(wav.subarray(dataStart, dataStart + Math.floor((wav.length - dataStart) / 2) * 2));
const pcm = new Int16Array(copy.buffer, copy.byteOffset, copy.length / 2);
const hop = SR / fps;
const frames = Math.ceil(pcm.length / hop);

// RMS in a window of two hops centred on each frame
const rms = new Float64Array(frames);
for (let f = 0; f < frames; f++) {
  const a = Math.max(0, Math.floor((f - 0.5) * hop));
  const b = Math.min(pcm.length, Math.floor((f + 1.5) * hop));
  let sum = 0;
  for (let i = a; i < b; i++) sum += (pcm[i] / 32768) ** 2;
  rms[f] = Math.sqrt(sum / Math.max(1, b - a));
}

// Normalise by the 95th percentile of the voiced frames, gate the noise floor, compress, then smooth
// with a fast attack and a slower release so the mouth snaps open and settles.
const sorted = [...rms].filter((v) => v > 0.004).sort((x, y) => x - y);
const ref = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 1;
const values = [];
let y = 0;
for (let f = 0; f < frames; f++) {
  let x = rms[f] / ref;
  x = x < 0.06 ? 0 : Math.min(1, Math.sqrt(x));
  y += (x - y) * (x > y ? 0.6 : 0.22);
  values.push(Math.round(y * 1000) / 1000);
}

mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, JSON.stringify({fps, values}));
const voiced = values.filter((v) => v > 0.1).length;
console.log(`envelope: ${frames} frames @ ${fps} fps (${(frames / fps).toFixed(2)} s), voiced ${(voiced / frames * 100).toFixed(0)}% -> ${out}`);
