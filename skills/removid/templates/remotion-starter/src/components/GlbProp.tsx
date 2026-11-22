// Draws a GLB prop (made with sand3d, see references/props-3d.md, or any GLB) and poses its joints. Deterministic: the file is a local
// static file loaded before the first frame (delayRender), and every frame is drawn from `joints`, which the scene computes from time.
// Needs Config.setChromiumOpenGlRenderer('swangle') for headless GL (see remotion.config.ts), like Character.tsx.
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {jointInfo, poseJoint, restOf, type JointInfo, type Rest} from '../lib/glb-joints.ts';

export type GlbPropProps = {
  /** Path inside public/, e.g. "props/gift_box.glb". */
  src: string;
  /** Joint name -> value: degrees (revolute, continuous) or metres (prismatic). Joints not named stay at 0. */
  joints?: Record<string, number>;
  /** Turn the camera around the prop (degrees) and raise it (degrees above the horizon). */
  yaw?: number;
  pitch?: number;
  width: number;
  height: number;
  /** Free space around the prop's bounding sphere, as a fraction of its radius. */
  margin?: number;
};

type Rig = {renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; center: THREE.Vector3; dist: number; parts: {node: THREE.Object3D; info: JointInfo; rest: Rest}[]};

export const GlbProp: React.FC<GlbPropProps> = ({src, joints = {}, yaw = 30, pitch = 18, width, height, margin = 0.25}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender(`glb ${src}`));
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const rig = useRef<Rig | null>(null);
  const released = useRef(false);

  useEffect(() => {
    let live = true;
    new GLTFLoader().loadAsync(staticFile(src)).then((g) => live && setGltf(g), (e) => cancelRender(new Error(`cannot load ${src}: ${e?.message ?? e}`)));
    return () => { live = false; };
  }, [src]);

  useLayoutEffect(() => {
    if (!gltf || !canvas.current) return;
    const renderer = new THREE.WebGLRenderer({canvas: canvas.current, alpha: true, antialias: true, preserveDrawingBuffer: true});
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa8a8b0, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.0); rim.position.set(5, 3, -5); scene.add(rim);
    scene.add(gltf.scene);
    const parts: Rig['parts'] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((node) => { const info = jointInfo(node.userData); if (info) parts.push({node, info, rest: restOf(node, info)}); });
    // Frame the prop once for its whole range of motion: the box of the rest pose plus each joint alone at its low, middle and high value.
    const box = new THREE.Box3();
    const grow = () => { gltf.scene.updateMatrixWorld(true); box.union(new THREE.Box3().setFromObject(gltf.scene)); };
    for (const p of parts) poseJoint(p.node, p.rest, p.info, 0);
    grow();
    for (const p of parts) {
      const unit = p.info.type === 'prismatic' ? 1 : 180 / Math.PI; // joint ranges are recorded in radians / metres
      const [lo, hi] = p.info.type === 'continuous' ? [0, 0] : [(p.info.lower ?? 0) * unit, (p.info.upper ?? 0) * unit];
      for (const v of [lo, (lo + hi) / 2, hi]) { poseJoint(p.node, p.rest, p.info, v); grow(); }
      poseJoint(p.node, p.rest, p.info, 0);
    }
    gltf.scene.updateMatrixWorld(true);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.01, 1000);
    const fovHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(30) / 2) * Math.min(1, width / height)); // the narrower side decides
    rig.current = {renderer, scene, camera, center: sphere.center, dist: (sphere.radius * (1 + margin)) / Math.sin(fovHalf), parts};
    return () => {
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
      rig.current = null;
    };
  }, [gltf, width, height, margin]);

  const key = JSON.stringify([joints, yaw, pitch]);
  useLayoutEffect(() => {
    const r = rig.current;
    if (!gltf || !r) return;
    try {
      const unknown = Object.keys(joints).filter((n) => !r.parts.some((p) => p.info.name === n));
      if (unknown.length) throw new Error(`${src}: no joint named ${unknown.join(', ')} (joints in the file: ${r.parts.map((p) => p.info.name).join(', ') || 'none'})`);
      for (const p of r.parts) poseJoint(p.node, p.rest, p.info, joints[p.info.name] ?? 0);
    } catch (e) { cancelRender(e); return; }
    const a = THREE.MathUtils.degToRad(yaw), b = THREE.MathUtils.degToRad(pitch);
    r.camera.position.set(r.center.x + r.dist * Math.sin(a) * Math.cos(b), r.center.y + r.dist * Math.sin(b), r.center.z + r.dist * Math.cos(a) * Math.cos(b));
    r.camera.lookAt(r.center);
    r.camera.updateMatrixWorld(true);
    r.renderer.render(r.scene, r.camera);
    if (!released.current) { released.current = true; continueRender(handle); }
  }, [gltf, key, width, height, margin]);

  return <canvas ref={canvas} width={width} height={height} style={{width, height, display: 'block'}} />;
};
