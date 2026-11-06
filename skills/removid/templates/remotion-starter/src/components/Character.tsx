// Draws any character from src/characters. Deterministic: every frame is drawn from `pose` (a pure function of time).
// The renderer and meshes are built once; each React render only applies the pose and draws. Needs
// Config.setChromiumOpenGlRenderer('swangle') for headless GL (see remotion.config.ts).
import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {getCharacter} from '../characters/index.ts';
import type {ArmModel, CharacterDef, Model} from '../characters/types.ts';
import type {Point} from '../lib/geom.ts';
import type {ArmPose, Pose} from '../lib/pose.ts';

type Rig = {renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; model: Model; def: CharacterDef; eyeBase: THREE.Vector3; dispose: () => void};

function buildRig(def: CharacterDef, canvas: HTMLCanvasElement, width: number, height: number): Rig {
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, preserveDrawingBuffer: true});
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const {pos, lookAt, fov} = def.camera;
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
  camera.position.set(...pos);
  camera.lookAt(...lookAt);
  camera.updateMatrixWorld(true);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xa8a8b0, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.0);
  rim.position.set(5, 3, -5);
  scene.add(rim);

  const model = def.build();
  scene.add(model.root);
  return {
    renderer,
    scene,
    camera,
    model,
    def,
    eyeBase: model.eyes.position.clone(),
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

function applyArm(rig: Rig, side: 'L' | 'R', arm: ArmModel, p: ArmPose, width: number, height: number, local: (pt: Point) => Point) {
  const sgn = side === 'L' ? -1 : 1;
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
    const [px, py, pz] = rig.def.camera.pos;
    const [lx, ly, lz] = rig.def.camera.lookAt;
    const dist = Math.hypot(px - lx, py - ly, pz - lz);
    const pxPerUnit = height / (2 * dist * Math.tan((rig.def.camera.fov / 2) * (Math.PI / 180)));
    reach = Math.max(0.5, Math.min(1, Math.hypot(t.x - sh.x, t.y - sh.y) / pxPerUnit / arm.length));
  }
  const w = Math.max(p.present, p.point);
  phi = lerp(phi, p.present > 0 && !p.aimTarget ? presentPhi : aimPhi, w);
  const r = lerp(1, reach, w);
  arm.pivot.rotation.z = phi;
  arm.setReach(r, p.point > 0.4);
}

/** Apply a pose and draw one frame. `origin` is the canvas top-left in composition px (to map aim targets). */
function drawPose(rig: Rig, pose: Pose, width: number, height: number, origin: Point) {
  const m = rig.model;
  const local = (pt: Point): Point => ({x: pt.x - origin.x, y: pt.y - origin.y});
  const breathe = pose.breathe;

  m.root.position.y = pose.bounce * 0.09 + breathe * 0.012;
  m.torso.scale.set(1 - pose.bounce * 0.015, 1 + breathe * 0.012 + pose.bounce * 0.02, 1);

  // look: head turn (body yaw) and eye shift toward the target
  let dx = 0;
  let dy = 0;
  if (pose.look && pose.lookWeight > 0) {
    const headPx = project(rig, m.headAnchor.getWorldPosition(new THREE.Vector3()), width, height);
    const t = local(pose.look);
    dx = Math.max(-1, Math.min(1, (t.x - headPx.x) / (width * 0.5))) * pose.lookWeight;
    dy = Math.max(-1, Math.min(1, (t.y - headPx.y) / (height * 0.5))) * pose.lookWeight;
  }
  m.root.rotation.y = dx * 0.38;
  m.root.rotation.x = dy * 0.06;
  m.eyes.position.set(rig.eyeBase.x + dx * 0.16, rig.eyeBase.y - dy * 0.1 + breathe * 0.01, rig.eyeBase.z);
  for (const e of m.eyeMeshes) e.scale.y = Math.max(0.08, 1 - 0.92 * pose.blink);

  m.setMouth(pose.talk, pose.smile);
  m.update?.(pose);
  applyArm(rig, 'L', m.arms.L, pose.armL, width, height, local);
  applyArm(rig, 'R', m.arms.R, pose.armR, width, height, local);

  rig.renderer.render(rig.scene, rig.camera);
}

export const Character: React.FC<{id: string; width: number; height: number; pose: Pose; origin?: Point; style?: React.CSSProperties}> = ({id, width, height, pose, origin = {x: 0, y: 0}, style}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigRef = useRef<Rig | null>(null);

  useLayoutEffect(() => {
    const rig = buildRig(getCharacter(id), canvasRef.current!, width, height);
    rigRef.current = rig;
    return () => {
      rig.dispose();
      rigRef.current = null;
    };
  }, [id, width, height]);

  // No deps: draw on every render (every frame). Synchronous, so Remotion captures the finished frame.
  useLayoutEffect(() => {
    if (rigRef.current) drawPose(rigRef.current, pose, width, height, origin);
  });

  return <canvas ref={canvasRef} width={width} height={height} style={{width, height, display: 'block', ...style}} />;
};
