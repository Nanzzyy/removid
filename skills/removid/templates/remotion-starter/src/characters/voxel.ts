// A pixel / voxel character built only from boxes (flat-shaded, blocky), with a pixel face. Palette and hair are data.
import * as THREE from 'three';
import type {Side} from '../lib/pose.ts';
import {frameCamera, type CharacterDef, type Model} from './types.ts';

export type VoxelSpec = {
  id: string;
  label: string;
  about: string;
  skin: number;
  hair: number;
  hairStyle: 'short' | 'long' | 'cap';
  top: number; // hoodie / shirt
  bottom: number;
  shoes: number;
  accent?: number; // stripe on the chest, band on the cap
  groundY?: number;
};

export function voxel(spec: VoxelSpec): CharacterDef {
  return {
    id: spec.id,
    label: spec.label,
    about: spec.about,
    camera: frameCamera(4.3, 2.15, 700),
    groundY: spec.groundY ?? 800,
    build: () => buildVoxel(spec),
  };
}

function buildVoxel(spec: VoxelSpec): Model {
  const flat = (c: number) => new THREE.MeshStandardMaterial({color: c, roughness: 0.9, metalness: 0, flatShading: true});
  const skin = flat(spec.skin);
  const hair = flat(spec.hair);
  const top = flat(spec.top);
  const bottom = flat(spec.bottom);
  const shoes = flat(spec.shoes);
  const ink = new THREE.MeshBasicMaterial({color: 0x161616});
  const white = new THREE.MeshBasicMaterial({color: 0xffffff});
  const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const root = new THREE.Group();

  for (const x of [-0.4, 0.4]) {
    const leg = box(0.72, 1.2, 0.8, bottom);
    leg.position.set(x, 0.85, 0);
    root.add(leg);
    const shoe = box(0.74, 0.25, 0.95, shoes);
    shoe.position.set(x, 0.125, 0.07);
    root.add(shoe);
  }

  const torso = new THREE.Group();
  torso.position.set(0, 1.45, 0);
  root.add(torso);
  const trunk = box(1.65, 1.6, 0.95, top);
  trunk.position.set(0, 0.8, 0);
  torso.add(trunk);
  if (spec.accent !== undefined) {
    const stripe = box(1.67, 0.2, 0.97, flat(spec.accent));
    stripe.position.set(0, 0.7, 0);
    torso.add(stripe);
  }

  const HEAD = 1.55;
  const HEAD_Y = 3.05 + HEAD / 2;
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  root.add(head);
  head.add(box(HEAD, HEAD, HEAD, skin));

  // hair from blocks
  const top1 = box(HEAD + 0.12, 0.42, HEAD + 0.12, hair);
  top1.position.set(0, HEAD / 2 - 0.1, 0);
  head.add(top1);
  const back = box(HEAD + 0.12, spec.hairStyle === 'long' ? 1.9 : 0.9, 0.3, hair);
  back.position.set(0, HEAD / 2 - (spec.hairStyle === 'long' ? 1.0 : 0.55), -HEAD / 2 - 0.0);
  head.add(back);
  for (const s of [-1, 1]) {
    const side = box(0.22, spec.hairStyle === 'long' ? 1.6 : 0.8, HEAD + 0.1, hair);
    side.position.set(s * (HEAD / 2 + 0.03), HEAD / 2 - (spec.hairStyle === 'long' ? 0.85 : 0.45), -0.02);
    head.add(side);
  }
  if (spec.hairStyle === 'cap') {
    const brim = box(HEAD + 0.1, 0.12, 0.7, spec.accent !== undefined ? flat(spec.accent) : hair);
    brim.position.set(0, HEAD / 2 - 0.2, HEAD / 2 + 0.3);
    head.add(brim);
  } else {
    // pixel fringe: three blocks of different length
    [[-0.5, 0.3], [0, 0.45], [0.5, 0.25]].forEach(([x, len]) => {
      const f = box(0.5, len, 0.16, hair);
      f.position.set(x, HEAD / 2 - 0.1 - len / 2 + 0.05, HEAD / 2 + 0.04);
      head.add(f);
    });
  }

  // face: square eyes with a highlight pixel, a flat mouth
  const eyes = new THREE.Group();
  head.add(eyes);
  const eyeMeshes: THREE.Mesh[] = [];
  for (const x of [-0.38, 0.38]) {
    const eye = box(0.26, 0.34, 0.05, ink);
    eye.position.set(x, -0.02, HEAD / 2 + 0.03);
    const glint = box(0.09, 0.09, 0.02, white);
    glint.position.set(x + 0.05, 0.08, HEAD / 2 + 0.07);
    eyes.add(eye, glint);
    eyeMeshes.push(eye, glint);
    const brow = box(0.34, 0.07, 0.05, hair);
    brow.position.set(x, 0.3, HEAD / 2 + 0.03);
    head.add(brow);
  }
  const mouth = box(1, 1, 0.05, ink);
  head.add(mouth);

  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, -0.1, HEAD / 2);
  head.add(headAnchor);

  const makeArm = (side: Side) => {
    const sgn = side === 'L' ? -1 : 1;
    const pivot = new THREE.Group();
    pivot.position.set(sgn * 1.2, 2.95, 0);
    const limb = box(0.52, 1, 0.58, top);
    const hand = box(0.5, 0.42, 0.56, skin);
    const finger = box(0.16, 0.4, 0.16, skin);
    pivot.add(limb, hand, finger);
    root.add(pivot);
    const setReach = (r: number, pointing: boolean) => {
      limb.scale.y = 1.2 * r;
      limb.position.y = -0.62 * r;
      hand.position.y = -1.3 * r;
      finger.position.y = -1.7 * r;
      finger.visible = pointing;
    };
    setReach(1, false);
    return {pivot, length: 1.8, setReach};
  };

  const model: Model = {
    root,
    headAnchor,
    torso,
    eyes,
    eyeMeshes,
    setMouth(open, smile) {
      mouth.scale.set(0.42 + smile * 0.06 + open * 0.06, 0.07 + open * 0.3, 1);
      mouth.position.set(0, -0.42 - open * 0.08, HEAD / 2 + 0.03);
    },
    arms: {L: makeArm('L'), R: makeArm('R')},
  };
  model.setMouth(0, 0.5); // a unit shape until it is sized
  return model;
}
