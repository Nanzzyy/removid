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
import * as THREE from 'three';
import {CHARACTERS} from '../src/characters/index.ts';
import {blinkAt, narratorPose, windowed} from '../src/lib/pose.ts';
import {clipRange, exitAlpha, HANDLE_FRAMES, revealTimes} from '../src/lib/plan.ts';

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


/**
 * Framing at full zoom: the highlighted rect must be completely on screen (FAIL if clipped), should sit inside the 90% action-safe
 * box (WARN: a target in a canvas corner cannot be centred), and must not touch the `keepClear` zone, e.g. where the narrator stands (FAIL).
 */
function checkFraming(name, shots, keepClear) {
  console.log(`${name}: zoom framing`);
  shots.forEach((z, k) => {
    const cam = camAt(z.start + z.inDur + z.hold / 2, shots, W, H);
    const r = rectToScreen(cam, z.focus);
    const right = r.x + r.w, bottom = r.y + r.h;
    const span = `x ${r.x.toFixed(0)}..${right.toFixed(0)}, y ${r.y.toFixed(0)}..${bottom.toFixed(0)}`;
    if (r.x < 0 || r.y < 0 || right > W || bottom > H) fail(`zoom #${k + 1}: the focus is CLIPPED by the screen at full zoom (${span} on ${W}x${H})`);
    else if (r.x < W * 0.05 || r.y < H * 0.05 || right > W * 0.95 || bottom > H * 0.95) warn(`zoom #${k + 1}: the focus leaves the 90% safe box (${span})`);
    else ok(`zoom #${k + 1}: focus fully visible and inside the safe box (${span})`);
    if (keepClear) {
      const hit = r.x < keepClear.x + keepClear.w && right > keepClear.x && r.y < keepClear.y + keepClear.h && bottom > keepClear.y;
      hit ? fail(`zoom #${k + 1}: the focus (${span}) overlaps the keep-clear zone x ${keepClear.x}..${keepClear.x + keepClear.w} (narrator)`) : ok(`zoom #${k + 1}: clear of the keep-clear zone`);
    }
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
checkFraming('UiDemo', ui.SHOTS);
checkCursor('UiDemo', ui.CURSOR, ui.T, ui.SHOTS, ui.DURATION_SEC);
checkShots('Narrator', nar.SHOTS);
checkFraming('Narrator', nar.SHOTS, nar.KEEP_CLEAR);

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

console.log('Characters: contract of every character in src/characters');
for (const def of Object.values(CHARACTERS)) {
  const tag = `${def.id}`;
  let m;
  try { m = def.build(); } catch (e) { fail(`${tag}: build() throws: ${e.message}`); continue; }
  const problems = [];
  if (!def.about || def.about.length < 20) problems.push('`about` should say who it suits');
  if (!(m.eyeMeshes?.length >= 2)) problems.push('needs at least 2 eyeMeshes (blink)');
  if (!m.eyes || !m.torso || !m.headAnchor) problems.push('needs eyes, torso and headAnchor');
  m.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m.root);
  const height = box.max.y - box.min.y;
  if (Math.abs(box.min.y) > 0.06) problems.push(`feet must stand at y = 0 (lowest point ${box.min.y.toFixed(2)})`);
  if (height < 2.5 || height > 6) problems.push(`height ${height.toFixed(2)} units is outside 2.5..6`);
  if (box.max.z - box.min.z < 0.5) problems.push('has no depth (flat?)');
  // facing: the face anchor must be in front of the body centre
  const anchor = m.headAnchor.getWorldPosition(new THREE.Vector3());
  if (anchor.z <= 0.3) problems.push(`headAnchor must sit on the front of the face (z ${anchor.z.toFixed(2)})`);
  for (const side of ['L', 'R']) {
    const a = m.arms[side];
    if (!a) { problems.push(`missing arm ${side}`); continue; }
    a.setReach(1, true);
    a.pivot.rotation.z = 0;
    m.root.updateMatrixWorld(true);
    const sh = a.pivot.getWorldPosition(new THREE.Vector3());
    const ab = new THREE.Box3().setFromObject(a.pivot);
    const hang = sh.y - ab.min.y;
    if (Math.abs(hang - a.length) > 0.3 * a.length) problems.push(`arm ${side}: declared length ${a.length} but it hangs ${hang.toFixed(2)}`);
    if ((side === 'L') !== (sh.x < 0)) problems.push(`arm ${side} is on the wrong side (x ${sh.x.toFixed(2)}): L must be on the screen's left`);
    if (sh.y < box.min.y + 0.5 * height || sh.y > box.min.y + 0.85 * height) problems.push(`arm ${side}: shoulder at ${((sh.y - box.min.y) / height * 100).toFixed(0)}% of the height, expected 50..85%`);
    a.setReach(0.5, false);
    const short = new THREE.Box3().setFromObject(a.pivot);
    if (!(sh.y - short.min.y < hang - 0.2)) problems.push(`arm ${side}: setReach(0.5) does not shorten the arm`);
    a.setReach(1, false);
  }
  const {pos, lookAt, fov} = def.camera;
  const cam = new THREE.PerspectiveCamera(fov, 900 / 1080, 0.1, 100);
  cam.position.set(...pos); cam.lookAt(...lookAt); cam.updateMatrixWorld(true);
  // Where the character really lands on a 1080 px canvas: project every vertex.
  let topPx = 1e9, feetPx = -1e9;
  const v = new THREE.Vector3();
  m.root.traverse((o) => { if (!o.isMesh || !o.geometry.attributes.position) return; const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld).project(cam); const y = ((1 - v.y) / 2) * 1080; if (y < topPx) topPx = y; if (y > feetPx) feetPx = y; } });
  if (topPx < 20 || feetPx > 1060) problems.push(`does not fit the camera (head ${topPx.toFixed(0)} px, feet ${feetPx.toFixed(0)} px of 1080)`);
  if (Math.abs(feetPx - def.groundY) > 40) problems.push(`groundY ${def.groundY} is far from where the feet land (~${feetPx.toFixed(0)} px); use about ${Math.round(feetPx - 8)}`);
  problems.length ? problems.forEach((p) => fail(`${tag}: ${p}`)) : ok(`${tag}: ${height.toFixed(2)} units tall, both arms hang ${m.arms.L.length} long, feet at ~${feetPx.toFixed(0)} px`);
}

console.log('Plan helpers: clips, exit fade, voice-synced reveal');
{
  const first = clipRange(900, {startFrame: 0, endFrame: 180}), mid = clipRange(900, {startFrame: 180, endFrame: 480}), last = clipRange(900, {startFrame: 705, endFrame: 900});
  first.from === 0 && first.to === 180 + HANDLE_FRAMES ? ok('first clip starts at 0 (no head handle) and keeps a tail handle') : fail(`first clip range ${JSON.stringify(first)}`);
  mid.from === 180 - HANDLE_FRAMES && mid.durationInFrames === 300 + 2 * HANDLE_FRAMES ? ok('a middle clip carries a handle on both sides') : fail(`middle clip range ${JSON.stringify(mid)}`);
  last.to === 900 ? ok('last clip ends at the last frame of the video') : fail(`last clip range ${JSON.stringify(last)}`);
  const a = (t) => exitAlpha(t, 8, false);
  a(7.5) === 1 && a(8) === 0 && Math.abs(a(7.875) - 0.5) < 1e-9 && exitAlpha(14.99, 15, true) === 1 ? ok('content fades out in the last 0.25 s; the last scene never leaves') : fail('exitAlpha is wrong');
  const r = revealTimes(['BISNISMU', 'SUDAH', 'PUNYA', 'WEBSITE', 'SENDIRI?'], 0.2, 2.2);
  const inOrder = r.every((x, i) => i === 0 || x > r[i - 1]);
  inOrder && Math.abs(r[0] - 0.32) < 1e-9 && r.at(-1) < 2.2 - 0.28 ? ok(`words appear in order inside the voice window (${r.map((x) => x.toFixed(2)).join(', ')})`) : fail(`revealTimes ${r.join(', ')}`);
}

console.log(fails ? `\n${fails} FAIL` : '\nALL OK');
process.exit(fails ? 1 : 0);
