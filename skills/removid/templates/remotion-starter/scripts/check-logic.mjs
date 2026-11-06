#!/usr/bin/env node
// Numeric audit of cursor + zoom rules. No browser needed. Exit 1 on any FAIL.
//   node scripts/check-logic.mjs
// Needs Node >= 22.18 (runs the .ts sources directly).
import {camAt, validateShots, rectToScreen, toScreen} from '../src/lib/camera.ts';
import {pathStats, planCursor, cursorPos} from '../src/lib/cursor.ts';
import {contains} from '../src/lib/geom.ts';
import {W, H, FPS} from '../src/lib/time.ts';
import * as ui from '../src/scenes/uiDemo.data.ts';
import * as nar from '../src/scenes/narrator.data.ts';
import {readFileSync, existsSync} from 'node:fs';
import {envAt} from '../src/lib/envelope.ts';
import {blinkAt, narratorPose, windowed} from '../src/lib/pose.ts';

let fails = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const warn = (m) => console.log(`  WARN  ${m}`);
const fail = (m) => {
  fails++;
  console.log(`  FAIL  ${m}`);
};

function checkShots(name, shots) {
  console.log(`${name}: zoom`);
  const issues = validateShots(shots, W, H);
  if (!issues.length) ok(`${shots.length} shot(s) follow the authoring rules`);
  for (const i of issues) (i.level === 'error' ? fail : warn)(i.msg);

  // Smoothness: speed of the camera scale at the first and last frame of each move must be << its peak.
  shots.forEach((z, k) => {
    for (const [label, a, b] of [['in', z.start, z.start + z.inDur], ['out', z.start + z.inDur + z.hold, z.start + z.inDur + z.hold + z.outDur]]) {
      const speeds = [];
      for (let f = Math.floor(a * FPS); f < Math.ceil(b * FPS); f++) {
        const c0 = camAt(f / FPS, shots, W, H);
        const c1 = camAt((f + 1) / FPS, shots, W, H);
        speeds.push(Math.abs(Math.log(c1.s / c0.s)) + Math.hypot(c1.tx - c0.tx, c1.ty - c0.ty) / W);
      }
      const peak = Math.max(...speeds);
      const edge = Math.max(speeds[0], speeds[speeds.length - 1]);
      if (peak < 1e-9) warn(`zoom #${k + 1} ${label}: no camera movement`);
      else if (edge > 0.1 * peak) fail(`zoom #${k + 1} ${label}: start/stop speed ${(edge / peak * 100).toFixed(0)}% of peak (stiff)`);
      else ok(`zoom #${k + 1} ${label}: eased (edge speed ${(edge / peak * 100).toFixed(1)}% of peak)`);
    }
    // View must stay inside the canvas (no empty border) throughout.
    let worst = 0;
    for (let f = Math.floor(z.start * FPS); f <= Math.ceil((z.start + z.inDur + z.hold + z.outDur) * FPS); f++) {
      const c = camAt(f / FPS, shots, W, H);
      worst = Math.max(worst, c.tx - 1e-6 > 0 ? c.tx : 0, c.ty - 1e-6 > 0 ? c.ty : 0, W - (c.s * W + c.tx) > 1e-6 ? W - (c.s * W + c.tx) : 0, H - (c.s * H + c.ty) > 1e-6 ? H - (c.s * H + c.ty) : 0);
    }
    if (worst > 0) fail(`zoom #${k + 1}: view leaves the canvas by ${worst.toFixed(1)}px`);
    else ok(`zoom #${k + 1}: view stays inside the canvas`);
  });
}

function checkCursor(name, plan, targets, shots, durationSec) {
  console.log(`${name}: cursor`);
  const {legs, issues} = planCursor(plan, targets);
  if (issues.length) issues.forEach((i) => fail(i));
  else ok(`${legs.length} leg(s) planned, every stop has enough travel time`);

  const st = pathStats(legs, plan.start, FPS, durationSec);
  if (st.peakPxPerFrame > 35) fail(`peak speed ${st.peakPxPerFrame.toFixed(1)} px/frame > 35 (reads as teleport)`);
  else ok(`peak speed ${st.peakPxPerFrame.toFixed(1)} px/frame (limit 35)`);
  if (st.maxTurn > 1.0) fail(`sharp turn ${st.maxTurn.toFixed(2)} rad within one frame`);
  else ok(`smoothest turn check ${st.maxTurn.toFixed(2)} rad per frame`);

  for (const leg of legs) {
    const cam = camAt(leg.arrive, shots, W, H);
    // 1. tip lands inside the target (screen space, through the camera) at arrival and at the click
    for (const [label, t] of [['arrival', leg.arrive], ...(leg.clickAt === undefined ? [] : [['click', leg.clickAt]])]) {
      const tip = toScreen(camAt(t, shots, W, H), cursorPos(t, legs, plan.start));
      const rect = rectToScreen(camAt(t, shots, W, H), targets[leg.target]);
      if (!contains(rect, tip, 0.5)) fail(`"${leg.target}" ${label}: tip (${tip.x.toFixed(1)},${tip.y.toFixed(1)}) is outside the target`);
      else ok(`"${leg.target}" ${label}: tip inside the target`);
    }
    // 2. cursor holds still on the target for >= 2 frames before the click
    if (leg.clickAt !== undefined) {
      const a = cursorPos(leg.clickAt - 2 / FPS, legs, plan.start);
      const b = cursorPos(leg.clickAt, legs, plan.start);
      if (Math.hypot(a.x - b.x, a.y - b.y) > 0.5) fail(`"${leg.target}": cursor still moving in the 2 frames before the click`);
      else ok(`"${leg.target}": holds >= 2 frames before the click`);
    }
    // 3. camera is still for >= 0.1 s before the cursor arrives
    let moved = 0;
    for (let f = Math.floor((leg.arrive - 0.1) * FPS); f < Math.ceil(leg.arrive * FPS); f++) {
      const c0 = camAt(f / FPS, shots, W, H);
      const c1 = camAt((f + 1) / FPS, shots, W, H);
      moved = Math.max(moved, Math.abs(c1.s - c0.s) * 1000, Math.hypot(c1.tx - c0.tx, c1.ty - c0.ty));
    }
    if (moved > 0.5) fail(`"${leg.target}": camera still moving ${moved.toFixed(2)} just before the cursor arrives`);
    else ok(`"${leg.target}": camera still before arrival`);
    void cam;
  }
  // cursor must stay on canvas
  let off = false;
  for (let f = 0; f <= durationSec * FPS; f++) {
    const p = cursorPos(f / FPS, legs, plan.start);
    if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) off = true;
  }
  off ? fail('cursor leaves the canvas') : ok('cursor never leaves the canvas');
}

checkShots('UiDemo', ui.SHOTS);
checkCursor('UiDemo', ui.CURSOR, ui.T, ui.SHOTS, ui.DURATION_SEC);
checkShots('Narrator', nar.SHOTS);

console.log('Narrator: pose + lip sync');
{
  const cues = nar.CUES.map(({targetCanvas, ...c}) => ({...c, target: targetCanvas}));
  const at = (t) => narratorPose(t, 0, cues, null);
  at(0.9).armR.wave > 0.9 ? ok('wave cue is fully active mid-cue') : fail('wave cue not active mid-cue');
  at(3.0).armR.wave < 1e-9 && at(3.0).armR.point < 1e-9 ? ok('arms idle between cues') : fail('arm weights leak between cues');
  const pt = at(5.0);
  pt.armR.point > 0.9 && pt.armR.aimTarget ? ok('point cue carries its target') : fail('point cue missing target');
  at(0.9).armL.wave === 0 ? ok('cue only moves its own arm') : fail('cue leaked to the other arm');
  windowed(0.05, 0.05, 1, 0.3) === 0 && windowed(0.35, 0.05, 1, 0.3) === 1 ? ok('cue ramps in and holds') : fail('cue window ramp is wrong');
  let blinks = 0, prev = 0;
  for (let f = 0; f < 11 * FPS; f++) { const b = blinkAt(f / FPS); if (b > 0.5 && prev <= 0.5) blinks++; prev = b; }
  blinks >= 2 && blinks <= 6 ? ok(`${blinks} blinks in 11 s, deterministic`) : fail(`blink count ${blinks} outside 2..6`);
  blinkAt(1.234) === blinkAt(1.234) ? ok('blink is a pure function of time') : fail('blink not deterministic');
  const envFile = new URL('../public/narration/sample.envelope.json', import.meta.url);
  if (existsSync(envFile)) {
    const env = JSON.parse(readFileSync(envFile, 'utf8'));
    const speech = envAt(env, Math.round(0.3 * FPS), FPS), quiet = envAt(env, Math.round(3.9 * FPS), FPS);
    speech > 0.2 && quiet < 0.05 ? ok(`mouth follows the voice (speech ${speech.toFixed(2)}, silence ${quiet.toFixed(2)})`) : fail(`envelope does not match the sample narration (speech ${speech}, silence ${quiet})`);
    env.values.length / env.fps >= nar.DURATION_SEC - 1 ? ok('envelope covers the scene') : warn('envelope is much shorter than the scene');
  } else warn('no sample envelope found; lip-sync check skipped');
}

console.log(fails ? `\n${fails} FAIL` : '\nALL OK');
process.exit(fails ? 1 : 0);
