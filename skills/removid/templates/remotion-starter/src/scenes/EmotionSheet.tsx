import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {getCharacter} from '../characters/index.ts';
import type {Model} from '../characters/types.ts';
import {EMOTION_TABLE} from '../emotions.ts';
import type {Mood} from '../lib/emotion.ts';
import {applyFace} from '../lib/face.ts';
import {SHEET_BG} from './CharacterSheet.tsx';

export const EMOTION_TAGS = Object.keys(EMOTION_TABLE) as Array<keyof typeof EMOTION_TABLE>;
export const EMO_SHEET = {cols: 6, cell: {w: 500, h: 560}, rows: Math.ceil(EMOTION_TAGS.length / 6)};
const moodOf = (tag: keyof typeof EMOTION_TABLE): Mood => ({...EMOTION_TABLE[tag].face, bounce: EMOTION_TABLE[tag].body.bounce, energy: EMOTION_TABLE[tag].energy});

/** Every emotion of the table on the same character, head and shoulders, in one canvas: what the viewer will see for each [tag]. */
export const EmotionSheet: React.FC<{id: string}> = ({id}) => {
  const W = EMO_SHEET.cols * EMO_SHEET.cell.w, H = EMO_SHEET.rows * EMO_SHEET.cell.h;
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const renderer = new THREE.WebGLRenderer({canvas: ref.current!, alpha: true, antialias: true, preserveDrawingBuffer: true});
    renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa8a8b0, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 6, 8); scene.add(key);
    const models: Model[] = EMOTION_TAGS.map(() => getCharacter(id).build());
    models.forEach((m, i) => { applyFace(m, moodOf(EMOTION_TAGS[i]), 0, 0); m.arms.L.pivot.rotation.z = -0.12; m.arms.R.pivot.rotation.z = 0.12; m.root.visible = false; scene.add(m.root); });
    // Every emotion is drawn with the SAME camera and position into its own cell (a scissored viewport), so the only difference between
    // two cells is the face. The camera frames the head and shoulders of this character.
    models[0].root.updateMatrixWorld(true);
    const headY = models[0].headAnchor.getWorldPosition(new THREE.Vector3()).y;
    const {w: cw, h: ch} = EMO_SHEET.cell; const visibleH = 4.0, centerY = headY - 0.7;
    const camera = new THREE.PerspectiveCamera(24, cw / ch, 0.1, 100);
    camera.position.set(0, centerY, visibleH / (2 * Math.tan((12 * Math.PI) / 180))); camera.lookAt(0, centerY, 0); camera.updateMatrixWorld(true);
    renderer.setClearColor(0x000000, 0); renderer.autoClear = false; renderer.setScissorTest(true);
    models.forEach((m, i) => {
      const x = (i % EMO_SHEET.cols) * cw, yTop = Math.floor(i / EMO_SHEET.cols) * ch;
      renderer.setViewport(x, H - yTop - ch, cw, ch); renderer.setScissor(x, H - yTop - ch, cw, ch);
      renderer.clear(); m.root.visible = true; renderer.render(scene, camera); m.root.visible = false;
    });
    return () => { scene.traverse((o) => { const g = (o as THREE.Mesh).geometry; if (g) g.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); };
  }, [id, W, H]);
  return (
    <AbsoluteFill style={{background: SHEET_BG}}>
      <canvas ref={ref} width={W} height={H} style={{width: W, height: H, display: 'block'}} />
      {EMOTION_TAGS.map((tag, i) => (
        <div key={tag} style={{position: 'absolute', left: (i % EMO_SHEET.cols) * EMO_SHEET.cell.w, top: Math.floor(i / EMO_SHEET.cols) * EMO_SHEET.cell.h + EMO_SHEET.cell.h - 56, width: EMO_SHEET.cell.w, textAlign: 'center', fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: 34, color: '#fff', letterSpacing: 1}}>{tag}</div>
      ))}
    </AbsoluteFill>
  );
};
