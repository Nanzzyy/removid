// A stylised 3D person (big head, simple limbs). One builder, many people: presentation, skin, hair, outfit and glasses are data.
// Proportions are chosen for readability at video size, not realism. Total height about 4.4 world units.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {Side} from '../lib/pose.ts';
import {frameCamera, type CharacterDef, type Model} from './types.ts';

export type HumanoidSpec = {
  id: string;
  label: string;
  about: string;
  presentation: 'female' | 'male' | 'neutral'; // body proportions and default silhouette
  skin: number;
  hair: number;
  hairStyle: 'short' | 'buzz' | 'long' | 'bob' | 'bun';
  outfit: 'shirt' | 'blazer' | 'dress';
  top: number; // shirt / blazer / dress colour
  bottom: number; // trousers (ignored for a dress)
  shoes: number;
  accent?: number; // tie, scarf or collar detail
  glasses?: boolean;
  groundY?: number;
};

export function humanoid(spec: HumanoidSpec): CharacterDef {
  return {
    id: spec.id,
    label: spec.label,
    about: spec.about,
    camera: frameCamera(4.4, 2.2, 720),
    groundY: spec.groundY ?? 800,
    build: () => buildHumanoid(spec),
  };
}

function buildHumanoid(spec: HumanoidSpec): Model {
  const std = (c: number, rough = 0.6) => new THREE.MeshStandardMaterial({color: c, roughness: rough, metalness: 0});
  const skin = std(spec.skin, 0.7);
  const hair = std(spec.hair, 0.5);
  const top = std(spec.top, 0.65);
  const bottom = std(spec.bottom, 0.7);
  const shoes = std(spec.shoes, 0.5);
  const ink = new THREE.MeshBasicMaterial({color: 0x1b1a1a});
  const white = new THREE.MeshBasicMaterial({color: 0xf6f3ee});
  const lip = new THREE.MeshBasicMaterial({color: 0x5a2230});
  const root = new THREE.Group();

  const female = spec.presentation === 'female';
  const male = spec.presentation === 'male';
  const torsoW = male ? 1.6 : female ? 1.3 : 1.45;
  const shoulderX = torsoW / 2 + 0.14;
  const dress = spec.outfit === 'dress';

  // legs and shoes
  for (const x of [-0.34, 0.34]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.75, 6, 14), dress ? skin : bottom);
    leg.position.set(x, 0.72, 0);
    root.add(leg);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.3, 0.95, 4, 0.12), shoes);
    shoe.position.set(x, 0.15, 0.14);
    root.add(shoe);
  }
  if (dress) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.98, 0.95, 28, 1), top);
    skirt.position.set(0, 1.45, 0);
    root.add(skirt);
  }

  // torso (its origin is at the hips so breathing grows it upward)
  const torso = new THREE.Group();
  torso.position.set(0, 1.3, 0);
  root.add(torso);
  const trunk = new THREE.Mesh(new RoundedBoxGeometry(torsoW, 1.55, 0.88, 6, 0.3), top);
  trunk.position.set(0, 0.8, 0);
  torso.add(trunk);
  if (spec.outfit === 'blazer') {
    // open jacket: an inner shirt panel and two lapels
    const inner = new THREE.Mesh(new RoundedBoxGeometry(torsoW * 0.36, 1.2, 0.1, 3, 0.04), std(0xf2efe8, 0.7));
    inner.position.set(0, 0.9, 0.45);
    torso.add(inner);
    for (const s of [-1, 1]) {
      const lapel = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.95, 0.1, 3, 0.04), top);
      lapel.position.set(s * torsoW * 0.22, 0.95, 0.46);
      lapel.rotation.z = s * -0.18;
      torso.add(lapel);
    }
  }
  if (spec.accent !== undefined && spec.outfit !== 'dress') {
    const tie = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.9, 0.08, 3, 0.04), std(spec.accent, 0.5));
    tie.position.set(0, 0.85, 0.48);
    torso.add(tie);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.35, 16), skin);
  neck.position.set(0, 1.65, 0);
  torso.add(neck);

  // head
  const HEAD_Y = 3.4;
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  root.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.88, 40, 30), skin);
  skull.scale.set(1, 1.04, 0.96);
  head.add(skull);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(s * 0.87, -0.05, 0);
    head.add(ear);
  }

  // hair: a cap tilted back so the forehead shows, plus style pieces
  const cap = new THREE.Mesh(new THREE.SphereGeometry(spec.hairStyle === 'buzz' ? 0.9 : 0.96, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
  cap.scale.set(1, 1.02, 1.0);
  cap.rotation.x = -0.4;
  cap.position.set(0, 0.04, -0.03);
  head.add(cap);
  if (spec.hairStyle === 'long' || spec.hairStyle === 'bob') {
    const len = spec.hairStyle === 'long' ? 1.7 : 0.8;
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, len, 8, 16), hair);
    back.scale.set(1.1, 1, 0.55);
    back.position.set(0, -0.35 - len / 2 + 0.5, -0.45);
    head.add(back);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, len * 0.5 + 0.2, 6, 12), hair);
      side.position.set(s * 0.86, -0.3 - len * 0.2, -0.05);
      side.rotation.z = s * -0.05;
      head.add(side);
    }
    const bang = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 6, 12), hair);
    bang.rotation.z = 1.3;
    bang.position.set(-0.3, 0.52, 0.72);
    head.add(bang);
  }
  if (spec.hairStyle === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), hair);
    bun.position.set(0, 0.98, -0.3);
    head.add(bun);
  }
  if (spec.hairStyle === 'short') {
    const quiff = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 6, 12), hair);
    quiff.rotation.z = -1.35;
    quiff.position.set(0.1, 0.58, 0.64);
    head.add(quiff);
  }

  // face: dark eyes with a white, brows, nose, mouth
  const eyes = new THREE.Group();
  head.add(eyes);
  const eyeMeshes: THREE.Mesh[] = [];
  for (const x of [-0.33, 0.33]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), white);
    sclera.scale.set(1, 1.15, 0.45);
    sclera.position.set(x, -0.12, 0.8);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 12), ink);
    pupil.scale.set(1, 1.1, 0.5);
    pupil.position.set(x, -0.12, 0.86);
    eyes.add(sclera, pupil);
    eyeMeshes.push(sclera, pupil);
    const brow = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.06, 0.06, 2, 0.02), hair);
    brow.position.set(x, 0.06, 0.82);
    brow.rotation.z = x < 0 ? 0.05 : -0.05;
    head.add(brow);
    if (spec.glasses) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.028, 10, 32), new THREE.MeshStandardMaterial({color: 0x23262b, roughness: 0.4}));
      ring.position.set(x, -0.12, 0.86);
      ring.scale.setScalar(0.85);
      head.add(ring);
    }
  }
  if (spec.glasses) {
    const bridge = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.03, 0.03, 2, 0.01), new THREE.MeshStandardMaterial({color: 0x23262b, roughness: 0.4}));
    bridge.position.set(0, -0.1, 0.88);
    head.add(bridge);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(spec.skin, 0.8));
  nose.scale.set(1, 0.9, 0.9);
  nose.position.set(0, -0.3, 0.87);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), lip);
  head.add(mouth);

  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, -0.15, 0.85);
  head.add(headAnchor);

  // arms: sleeve on the upper part (skin when sleeveless), skin hand and finger
  const makeArm = (side: Side) => {
    const sgn = side === 'L' ? -1 : 1;
    const pivot = new THREE.Group();
    pivot.position.set(sgn * shoulderX, 2.78, 0);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.75, 6, 14), top);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), skin);
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 10), skin);
    pivot.add(limb, hand, finger);
    root.add(pivot);
    const setReach = (r: number, pointing: boolean) => {
      limb.scale.y = r;
      limb.position.y = -0.52 * r;
      hand.position.y = -1.14 * r;
      finger.position.y = -1.46 * r;
      finger.visible = pointing;
    };
    setReach(1, false);
    return {pivot, length: 1.75, setReach};
  };

  const model: Model = {
    root,
    headAnchor,
    torso,
    eyes,
    eyeMeshes,
    setMouth(open, smile) {
      mouth.scale.set(0.17 + smile * 0.05 + open * 0.035, 0.028 + open * 0.17, 0.08);
      mouth.position.set(0, -0.52 - open * 0.04, 0.8);
    },
    arms: {L: makeArm('L'), R: makeArm('R')},
  };
  model.setMouth(0, 0.5); // a unit shape until it is sized
  return model;
}
