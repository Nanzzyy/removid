// Full-kit integration smoke. Generates only temporary projects/media.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixture, approve} from './helpers/fast-fixture.mjs';
// Remotion rejects a concurrency above the core count (a 1-core machine fails with 2).
const concurrency = `--concurrency=${Math.min(2, os.availableParallelism())}`;
const kit = fileURLToPath(new URL('../skills/removid/fast', import.meta.url));
const base = path.resolve(process.argv[2]), p = fixture(base, true);
approve(p); // Evidence belongs to this synthetic test fixture only.
function run(cmd, args, cwd = base, expect = 0) {
  const r = spawnSync(cmd, args, {cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
  assert.equal(r.status, expect, `${cmd} ${args.join(' ')}\n${r.stdout || ''}\n${r.stderr || ''}`);
  return (r.stdout || '') + (r.stderr || '');
}
run('bash', [path.join(kit, 'setup.sh'), p]);
const app = path.join(p, 'Source/remotion');
run('npm', ['run', 'typecheck'], app);
run('npx', ['remotion', 'still', 'src/index.ts', 'Main60', 'out/still.png', '--frame=60', '--scale=0.5'], app);
const plan = JSON.parse(fs.readFileSync(path.join(p, 'Storyboard/plan.json')));
for (const frame of plan.frames) {
  run('npx', ['remotion', 'still', 'src/index.ts', `Scene${frame.id}`, `out/scene${frame.id}.png`, `--frame=${frame.startFrame + Math.min(210, frame.durationFrames - 60)}`, '--scale=0.25'], app);
  run('npx', ['remotion', 'render', 'src/index.ts', `Scene${frame.id}`, path.join(p, `Asset/scenes/0${frame.id}-smoke.mp4`), `--frames=${Math.max(0, frame.startFrame - 15)}-${Math.min(plan.totalFrames, frame.endFrame + 15) - 1}`, '--scale=0.25', concurrency], app);
}
// A complete 60 fps Remotion timeline verifies that all stock components can render.
run('npx', ['remotion', 'render', 'src/index.ts', 'Main60', 'out/silent.mp4', '--scale=0.25', concurrency], app);
// Render and typecheck passed by here. Audio and QA need tools that are not always installed: say so as SKIPPED, never as a pass.
// REMOVID_REQUIRE_AUDIO=1 turns the skip into a failure (use it where the tools are expected).
function skipAudio(why) {
  console.log(`FAST render/typecheck passed\nSKIPPED audio and QA mutants: ${why}`);
  process.exit(process.env.REMOVID_REQUIRE_AUDIO === '1' ? 1 : 0);
}
const ffmpeg = process.env.REMOVID_FFMPEG || process.env.HYPERFRAMES_FFMPEG_PATH || 'ffmpeg';
const filters = spawnSync(ffmpeg, ['-hide_banner', '-filters'], {encoding: 'utf8'}).stdout || '';
if (!['ebur128', 'freezedetect', 'blackdetect', 'testsrc2', 'color'].every((f) => filters.includes(` ${f} `))) {
  skipAudio('need a full ffmpeg with ebur128, freezedetect, blackdetect, testsrc2 and color');
}
const python = process.env.REMOVID_PYTHON || 'python3';
if (spawnSync(python, ['-c', 'import numpy, scipy.signal']).status !== 0) {
  skipAudio('need Python with numpy and scipy (REMOVID_PYTHON)');
}
run('bash', [path.join(kit, 'scripts/audio.sh'), p]);
// Attach the generated mix to the smoke timeline for QA; production uses HyperFrames.
const movie = path.join(app, 'out/audio.mp4');
run(ffmpeg, ['-y', '-loglevel', 'error', '-i', 'out/silent.mp4', '-i', path.join(p, 'Asset/agen/sfx.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', movie], app);
const qa = (file, name, fps = '60', expect = 1) => run('bash', [path.join(kit, 'scripts/qa.sh'), file, fps, path.join(app, `out/qa-${name}`), '270x480', String(plan.totalSec)], app, expect);
qa(movie, 'pass', '60', 0);
qa(movie, 'wrong-fps', '24');
qa(path.join(app, 'out/silent.mp4'), 'no-audio');
for (const [name, filter] of [['freeze', `color=c=red:s=270x480:r=60:d=${plan.totalSec}`], ['black', `color=c=black:s=270x480:r=60:d=${plan.totalSec}`]]) {
  const file = path.join(app, `out/${name}.mp4`);
  run(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', filter, '-i', path.join(p, 'Asset/agen/sfx.wav'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', file]);
  const output = qa(file, name);
  assert.match(output, name === 'black' ? /FAIL blackdetect/ : /FAIL freezedetect/);
}
const quiet = path.join(app, 'out/quiet.mp4');
run(ffmpeg, ['-y', '-loglevel', 'error', '-i', movie, '-c:v', 'copy', '-af', 'volume=0.1', '-c:a', 'aac', '-b:a', '256k', quiet]);
assert.match(qa(quiet, 'quiet'), /FAIL loudness/);
// A failed external ffmpeg must fail closed. Prove it per step: this ffmpeg fails ONLY the loudness measurement, so the failure
// must be reported there, not at a later step such as the contact sheet.
const noLoudness = path.join(app, 'out/ffmpeg-no-ebur128.sh');
fs.writeFileSync(noLoudness, `#!/bin/sh\ncase "$*" in *ebur128*) exit 1;; esac\nexec "${ffmpeg}" "$@"\n`, {mode: 0o755});
const broken = spawnSync('bash', [path.join(kit, 'scripts/qa.sh'), movie, '60', path.join(app, 'out/qa-tool-fail')], {env: {...process.env, REMOVID_FFMPEG: noLoudness}, encoding: 'utf8'});
assert.equal(broken.status, 1);
assert.match(broken.stderr, /FAIL ffmpeg audio measurement/);
assert.doesNotMatch(broken.stderr, /FAIL contact sheet/);
// And with every ffmpeg call failing, QA still exits 1.
const dead = spawnSync('bash', [path.join(kit, 'scripts/qa.sh'), movie, '60', path.join(app, 'out/qa-all-fail')], {env: {...process.env, REMOVID_FFMPEG: '/bin/false'}, encoding: 'utf8'});
assert.equal(dead.status, 1);
console.log('FAST: typecheck, 60 fps still/clips/timeline, generated audio and QA passed; fps/audio/freeze/black/loudness/tool mutants rejected');
