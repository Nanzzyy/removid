// A group shot: several characters standing side by side in ONE WebGL canvas (one context, so it stays fast).
// Real sizes show (each character keeps its own `scale`). `silhouetteLast` turns the last one into a dark silhouette.
import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {getCharacter} from '../characters/index.ts';
import type {Model} from '../characters/types.ts';
import type {Pose} from '../lib/pose.ts';

export const CharacterRow: React.FC<{ids: string[]; width: number; height: number; pose: Pose; spacing?: number; silhouetteLast?: boolean; silhouette?: string; style?: React.CSSProperties}> = ({ids, width, height, pose, spacing = 2.1, silhouetteLast = false, silhouette = '#0d0a24', style}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigRef = useRef<{renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; models: Model[]; base: THREE.Vector3[]} | null>(null);

  useLayoutEffect(() => {
    const renderer = new THREE.WebGLRenderer({canvas: canvasRef.current!, alpha: true, antialias: true, preserveDrawingBuffer: true});
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    // Wide enough for the row: the vertical field is fixed (24 degrees), the distance is chosen from the row's width.
    const rowW = (ids.length - 1) * spacing + 3.2;
    const dist = Math.max(11, rowW / (2 * Math.tan((12 * Math.PI) / 180) * (width / height)));
    const camera = new THREE.PerspectiveCamera(24, width / height, 0.1, 100);
    camera.position.set(0, 2.5, dist);
    camera.lookAt(0, 2.15, 0);
    camera.updateMatrixWorld(true);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa8a8b0, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-4, 6, 8);
    scene.add(key);
    const models = ids.map((id, i) => {
      const m = getCharacter(id).build();
      m.root.position.x = (i - (ids.length - 1) / 2) * spacing;
      if (silhouetteLast && i === ids.length - 1) {
        m.root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) mesh.material = new THREE.MeshBasicMaterial({color: silhouette});
        });
      }
      scene.add(m.root);
      return m;
    });
    rigRef.current = {renderer, scene, camera, models, base: models.map((m) => m.eyes.position.clone())};
    return () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      rigRef.current = null;
    };
  }, [ids.join(','), width, height, spacing, silhouetteLast, silhouette]);

  useLayoutEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.models.forEach((m, i) => {
      // idle: breathing, blinking, closed mouth, arms at rest; a prop (flame) animates from the pose time
      m.torso.scale.set(1, 1 + pose.breathe * 0.012, 1);
      for (const e of m.eyeMeshes) e.scale.y = Math.max(0.08, 1 - 0.92 * pose.blink);
      m.setMouth(0, pose.smile);
      m.arms.L.pivot.rotation.z = -0.12;
      m.arms.R.pivot.rotation.z = 0.12;
      m.update?.(pose);
    });
    rig.renderer.render(rig.scene, rig.camera);
  });

  return <canvas ref={canvasRef} width={width} height={height} style={{width, height, display: 'block', ...style}} />;
};
