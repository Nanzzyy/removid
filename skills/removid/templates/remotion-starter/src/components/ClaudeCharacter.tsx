// Narrator character in Claude's visual language: warm coral body, cream accents, a spark badge, simple dark eyes.
// It is an original character, not an official Anthropic asset.
//
// Deterministic: every frame is drawn from `pose` (pure function of time). The renderer and meshes are built once;
// each React render only applies the pose and draws. Needs Config.setChromiumOpenGlRenderer('angle') for headless GL.
import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {Point} from '../lib/geom.ts';
import type {ArmPose, Pose, Side} from '../lib/pose.ts';

export const PALETTE = {coral: 0xd97757, coralDark: 0xb9573a, cream: 0xfaf9f5, ink: 0x1f1e1d, blush: 0xe9967a};

type ArmRig = {pivot: THREE.Group; limb: THREE.Mesh; hand: THREE.Mesh; finger: THREE.Mesh; side: Side};
type Rig = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  body: THREE.Mesh;
  face: THREE.Group;
  eyes: THREE.Group;
  eyeMeshes: THREE.Mesh[];
  mouth: THREE.Mesh;
  spark: THREE.Mesh;
  arms: Record<Side, ArmRig>;
  head: THREE.Object3D;
  dispose: () => void;
};

const SHOULDER = {x: 1.5, y: 2.3};
const CAM_Z = 12.6;
const FOV = 24;

function sparkGeometry(): THREE.ExtrudeGeometry {
  // 8-ray burst with alternating ray lengths, rounded by a bevel.
  const shape = new THREE.Shape();
  const rays = 8;
  for (let i = 0; i < rays * 2; i++) {
    const a = (i / (rays * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? (i % 4 === 0 ? 1 : 0.8) : 0.2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {depth: 0.06, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 3});
}

function buildRig(canvas: HTMLCanvasElement, width: number, height: number): Rig {
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, preserveDrawingBuffer: true});
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 100);
  camera.position.set(0, 1.9, CAM_Z);
  camera.lookAt(0, 1.55, 0);
  camera.updateMatrixWorld(true);

  scene.add(new THREE.HemisphereLight(0xfff4ea, 0xb89a86, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9c4, 1.1);
  rim.position.set(5, 3, -5);
  scene.add(rim);

  const mat = (c: number, rough = 0.55) => new THREE.MeshStandardMaterial({color: c, roughness: rough, metalness: 0});
  const coral = mat(PALETTE.coral);
  const coralDark = mat(PALETTE.coralDark, 0.6);
  const cream = mat(PALETTE.cream, 0.5);
  const ink = new THREE.MeshBasicMaterial({color: PALETTE.ink});

  const root = new THREE.Group();
  scene.add(root);

  const body = new THREE.Mesh(new RoundedBoxGeometry(2.7, 2.3, 1.9, 8, 0.55), coral);
  body.position.set(0, 1.75, 0);
  root.add(body);

  // legs
  for (const x of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.85, 0.85, 6, 0.25), coralDark);
    leg.position.set(x, 0.4, 0.05);
    root.add(leg);
  }

  // face (eyes + mouth) is a group so it can slide a little with the head turn for parallax
  const face = new THREE.Group();
  face.position.set(0, 0, 0.96);
  root.add(face);
  const eyes = new THREE.Group();
  face.add(eyes);
  const eyeMeshes: THREE.Mesh[] = [];
  for (const x of [-0.55, 0.55]) {
    const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.26, 6, 14), ink);
    eye.position.set(x, 2.15, 0);
    eye.scale.set(1, 1, 0.5);
    eyes.add(eye);
    eyeMeshes.push(eye);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), ink);
  mouth.position.set(0, 1.6, 0.0);
  face.add(mouth);

  // spark badge on the belly
  const spark = new THREE.Mesh(sparkGeometry(), cream);
  spark.scale.setScalar(0.34);
  spark.position.set(0, 1.05, 0.93);
  root.add(spark);

  // arms: pivot at the shoulder, arm hangs along -Y in local space
  const makeArm = (side: Side): ArmRig => {
    const sgn = side === 'L' ? -1 : 1;
    const pivot = new THREE.Group();
    pivot.position.set(sgn * SHOULDER.x, SHOULDER.y, 0.05);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 6, 14), coral);
    arm.position.set(0, -0.55, 0);
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), coralDark);
    hand.position.set(0, -1.15, 0);
    pivot.add(hand);
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.26, 4, 10), coralDark);
    finger.position.set(0, -1.5, 0);
    finger.visible = false;
    pivot.add(finger);
    root.add(pivot);
    return {pivot, limb: arm, hand, finger, side};
  };

  const head = new THREE.Object3D();
  head.position.set(0, 2.15, 0.9);
  root.add(head);

  return {
    renderer,
    scene,
    camera,
    root,
    body,
    face,
    eyes,
    eyeMeshes,
    mouth,
    spark,
    arms: {L: makeArm('L'), R: makeArm('R')},
    head,
    dispose: () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Canvas-pixel position of a world point. */
function project(rig: Rig, v: THREE.Vector3, width: number, height: number): Point {
  const p = v.clone().project(rig.camera);
  return {x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height};
}

const ARM_FULL = 1.75; // world units from shoulder to fingertip when fully extended

function applyArm(rig: Rig, arm: ArmRig, p: ArmPose, width: number, height: number, local: (pt: Point) => Point) {
  const sgn = arm.side === 'L' ? -1 : 1;
  const rest = sgn * 0.12;
  const wavePhi = sgn * (Math.PI - 0.5) + Math.sin(p.wavePhase) * 0.32;
  const presentPhi = sgn * (Math.PI / 2 + 0.3);
  let phi = lerp(rest, wavePhi, p.wave);

  let aimPhi = presentPhi;
  let reach = 1;
  if (p.aimTarget) {
    const sh = project(rig, arm.pivot.getWorldPosition(new THREE.Vector3()), width, height);
    const t = local(p.aimTarget);
    aimPhi = wrapPi(Math.atan2(-(t.y - sh.y), t.x - sh.x) + Math.PI / 2);
    // The arm stops at the target instead of reaching through it (keeps the pointed-at content readable).
    const pxPerUnit = height / (2 * CAM_Z * Math.tan((FOV / 2) * (Math.PI / 180)));
    reach = Math.max(0.5, Math.min(1, Math.hypot(t.x - sh.x, t.y - sh.y) / pxPerUnit / ARM_FULL));
  }
  const w = Math.max(p.present, p.point);
  phi = lerp(phi, p.present > 0 && !p.aimTarget ? presentPhi : aimPhi, w);
  const r = lerp(1, reach, w);
  arm.pivot.rotation.z = phi;
  arm.limb.scale.y = r;
  arm.limb.position.y = -0.55 * r;
  arm.hand.position.y = -1.15 * r;
  arm.finger.position.y = -1.5 * r;
  arm.finger.visible = p.point > 0.4;
}

/** Apply a pose and draw one frame. `origin` is the canvas top-left in composition px (to map aim targets). */
function drawPose(rig: Rig, pose: Pose, width: number, height: number, origin: Point) {
  const local = (pt: Point): Point => ({x: pt.x - origin.x, y: pt.y - origin.y});
  const breathe = pose.breathe;

  rig.root.position.y = pose.bounce * 0.09 + breathe * 0.012;
  rig.body.scale.set(1 - pose.bounce * 0.015, 1 + breathe * 0.012 + pose.bounce * 0.02, 1);

  // look: head turn (body yaw) and eye shift toward the target
  let dx = 0;
  let dy = 0;
  if (pose.look && pose.lookWeight > 0) {
    const headPx = project(rig, rig.head.getWorldPosition(new THREE.Vector3()), width, height);
    const t = local(pose.look);
    dx = Math.max(-1, Math.min(1, (t.x - headPx.x) / (width * 0.5))) * pose.lookWeight;
    dy = Math.max(-1, Math.min(1, (t.y - headPx.y) / (height * 0.5))) * pose.lookWeight;
  }
  rig.root.rotation.y = dx * 0.38;
  rig.root.rotation.x = dy * 0.06;
  rig.eyes.position.x = dx * 0.16;
  rig.eyes.position.y = -dy * 0.1 + breathe * 0.01;
  for (const e of rig.eyeMeshes) e.scale.y = Math.max(0.08, 1 - 0.92 * pose.blink);

  // mouth: thin smile line at rest, opens with the voice envelope
  const open = pose.talk;
  rig.mouth.scale.set(0.3 + pose.smile * 0.05 + open * 0.04, 0.045 + open * 0.3, 0.12);
  rig.mouth.position.y = 1.62 - open * 0.04;

  rig.spark.scale.setScalar(0.34 * (1 + pose.talk * 0.12));
  rig.spark.rotation.z = breathe * 0.08;

  applyArm(rig, rig.arms.L, pose.armL, width, height, local);
  applyArm(rig, rig.arms.R, pose.armR, width, height, local);

  rig.renderer.render(rig.scene, rig.camera);
}

export const ClaudeCharacter: React.FC<{width: number; height: number; pose: Pose; origin?: Point; style?: React.CSSProperties}> = ({
  width,
  height,
  pose,
  origin = {x: 0, y: 0},
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigRef = useRef<Rig | null>(null);

  useLayoutEffect(() => {
    const rig = buildRig(canvasRef.current!, width, height);
    rigRef.current = rig;
    return () => {
      rig.dispose();
      rigRef.current = null;
    };
  }, [width, height]);

  // No deps: draw on every render (every frame). Synchronous, so Remotion captures the finished frame.
  useLayoutEffect(() => {
    if (rigRef.current) drawPose(rigRef.current, pose, width, height, origin);
  });

  return <canvas ref={canvasRef} width={width} height={height} style={{width, height, display: 'block', ...style}} />;
};
