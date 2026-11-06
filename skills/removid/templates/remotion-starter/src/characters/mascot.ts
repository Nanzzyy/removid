// A rounded-box mascot: a friendly blob with stubby arms and legs. Pure data in, meshes out.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {Side} from '../lib/pose.ts';
import {frameCamera, type CharacterDef, type Model} from './types.ts';

export type MascotSpec = {
  id: string;
  label: string;
  about: string;
  body: number; // main colour
  limbs: number; // legs, hands (a darker shade of body reads well)
  belly?: number; // a soft oval patch on the belly; omit for none
  ink: number; // eyes and mouth
  groundY?: number;
};

export function mascot(spec: MascotSpec): CharacterDef {
  return {
    id: spec.id,
    label: spec.label,
    about: spec.about,
    camera: {pos: [0, 1.9, 12.6], lookAt: [0, 1.55, 0], fov: 24},
    groundY: spec.groundY ?? 770,
    build: () => buildMascot(spec),
  };
}

function buildMascot(spec: MascotSpec): Model {
  const mat = (c: number, rough = 0.55) => new THREE.MeshStandardMaterial({color: c, roughness: rough, metalness: 0});
  const body = mat(spec.body);
  const limbs = mat(spec.limbs, 0.6);
  const ink = new THREE.MeshBasicMaterial({color: spec.ink});
  const root = new THREE.Group();

  const torso = new THREE.Mesh(new RoundedBoxGeometry(2.7, 2.3, 1.9, 8, 0.55), body);
  torso.position.set(0, 1.75, 0);
  root.add(torso);
  for (const x of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.85, 0.85, 6, 0.25), limbs);
    leg.position.set(x, 0.4, 0.05);
    root.add(leg);
  }
  if (spec.belly !== undefined) {
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat(spec.belly, 0.7));
    belly.scale.set(0.78, 0.4, 0.12);
    belly.position.set(0, 1.02, 0.93);
    root.add(belly);
  }

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
  face.add(mouth);

  const makeArm = (side: Side) => {
    const sgn = side === 'L' ? -1 : 1;
    const pivot = new THREE.Group();
    pivot.position.set(sgn * 1.5, 2.3, 0.05);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 6, 14), body);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), limbs);
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.26, 4, 10), limbs);
    pivot.add(limb, hand, finger);
    root.add(pivot);
    const setReach = (r: number, pointing: boolean) => {
      limb.scale.y = r;
      limb.position.y = -0.55 * r;
      hand.position.y = -1.15 * r;
      finger.position.y = -1.5 * r;
      finger.visible = pointing;
    };
    setReach(1, false);
    return {pivot, length: 1.75, setReach};
  };

  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 2.15, 0.9);
  root.add(headAnchor);

  const model: Model = {
    root,
    headAnchor,
    torso,
    eyes,
    eyeMeshes,
    setMouth(open, smile) {
      mouth.scale.set(0.3 + smile * 0.05 + open * 0.04, 0.045 + open * 0.3, 0.12);
      mouth.position.set(0, 1.62 - open * 0.04, 0);
    },
    arms: {L: makeArm('L'), R: makeArm('R')},
  };
  model.setMouth(0, 0.5); // a unit shape until it is sized
  return model;
}
