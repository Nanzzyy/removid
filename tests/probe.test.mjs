import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const probe = fileURLToPath(new URL('../skills/removid/scripts/probe-mp4.sh', import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'removid-probe-test-'));
process.on('exit', () => fs.rmSync(tmp, {recursive: true, force: true}));
const run = (...args) => { const r = spawnSync('bash', [probe, ...args], {encoding: 'utf8'}); return {code: r.status, out: (r.stdout || '') + (r.stderr || '')}; };
const ffmpeg = (...args) => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], {encoding: 'utf8'});
// nullsrc + libx264 + aac exist in a minimal ffmpeg build too.
const silent = path.join(tmp, 'silent.mp4'), sound = path.join(tmp, 'sound.mp4');
const made = ffmpeg('-f', 'lavfi', '-i', 'nullsrc=s=160x90:r=30:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', silent).status === 0
  && ffmpeg('-f', 'lavfi', '-i', 'nullsrc=s=160x90:r=30:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', sound).status === 0;

test('probe-mp4 --require-audio fails a video with no audio stream and passes one with sound', {skip: !made && 'ffmpeg cannot make the fixtures'}, () => {
  const noFlag = run(silent, '160x90', '30');
  assert.equal(noFlag.code, 0, noFlag.out);               // scene clips stay valid without audio
  const strict = run('--require-audio', silent, '160x90', '30');
  assert.equal(strict.code, 1, strict.out);
  assert.match(strict.out, /no audio stream/);
  const ok = run('--require-audio', sound, '160x90', '30');
  assert.equal(ok.code, 0, ok.out);
});
