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
  // Early humans and other figures. All optional; leave them out for an ordinary modern person.
  scale?: number; // overall size, 1 = 4.4 world units tall (the camera does not change, so a 0.7 figure really looks smaller)
  stoop?: number; // radians, forward lean of the upper body (0.4 = clearly hunched)
  fur?: number; // bare, hairy body in this colour instead of clothes (outfit is ignored); the face keeps `skin`
  brow?: number; // brow ridge, 0..0.2
  jaw?: number; // protruding lower face, 0..1
  headScale?: number; // 0.85 = a smaller head
  armLength?: number; // multiplier, 1.3 = long arms
  eyeScale?: number; // 1.3 = big, friendly eyes (cuter)
  blush?: number | false; // cheek colour; default a soft pink, false for none
  hat?: number; // straw hat colour
  holding?: 'phone' | 'torch' | 'wheat'; // carried in the right hand
  groundY?: number;
};

export function humanoid(spec: HumanoidSpec): CharacterDef {
  return {
    id: spec.id,
    label: spec.label,
    about: spec.about,
    camera: frameCamera(4.4, 2.2, 720), // the same for every person, so scale shows
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
  const dress = spec.outfit === 'dress' && spec.fur === undefined;
  const fur = spec.fur;
  const furMat = fur !== undefined ? std(fur, 0.95) : null;
  const k = spec.scale ?? 1;
  root.scale.setScalar(k);
  const bodyTop = furMat ?? top;
  const bodyBottom = furMat ?? bottom;

  // legs and shoes
  for (const x of [-0.34, 0.34]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.75, 6, 14), dress ? skin : bodyBottom);
    leg.position.set(x, 0.72, 0);
    root.add(leg);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.3, 0.95, 4, 0.12), fur !== undefined ? skin : shoes);
    shoe.position.set(x, 0.15, 0.14);
    root.add(shoe);
  }
  if (dress) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.98, 0.95, 28, 1), top);
    skirt.position.set(0, 1.45, 0);
    root.add(skirt);
  }

  // upper body (torso, head, arms) hangs from the hips and can lean forward
  const HIPS = 1.3;
  const upper = new THREE.Group();
  upper.position.set(0, HIPS, 0);
  upper.rotation.x = spec.stoop ?? 0;
  root.add(upper);
  // torso (its origin is at the hips so breathing grows it upward)
  const torso = new THREE.Group();
  upper.add(torso);
  const trunk = new THREE.Mesh(new RoundedBoxGeometry(torsoW, 1.55, 0.88, 6, 0.3), bodyTop);
  trunk.position.set(0, 0.8, 0);
  torso.add(trunk);
  if (spec.outfit === 'blazer' && fur === undefined) {
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
  if (spec.accent !== undefined && spec.outfit !== 'dress' && fur === undefined) {
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
  head.position.set(0, HEAD_Y - HIPS, 0);
  head.scale.setScalar(spec.headScale ?? 1);
  head.rotation.x = -(spec.stoop ?? 0) * 0.85; // a hunched body still looks ahead
  upper.add(head);
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
  const brows: Array<{mesh: THREE.Mesh; x: number}> = [];
  for (const x of [-0.33, 0.33]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.135 * (spec.eyeScale ?? 1.1), 18, 14), white);
    sclera.scale.set(1, 1.15, 0.45);
    sclera.position.set(x, -0.12, 0.8);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.082 * (spec.eyeScale ?? 1.1), 16, 12), ink);
    pupil.scale.set(1, 1.1, 0.5);
    pupil.position.set(x, -0.12, 0.86);
    eyes.add(sclera, pupil);
    eyeMeshes.push(sclera, pupil);
    const brow = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.06, 0.06, 2, 0.02), hair);
    brow.position.set(x, 0.09, 0.82);
    head.add(brow);
    brows.push({mesh: brow, x});
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
  if (spec.blush !== false) {
    const cheek = new THREE.MeshStandardMaterial({color: spec.blush ?? 0xe58a78, roughness: 0.9, transparent: true, opacity: 0.5});
    for (const x of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), cheek);
      c.scale.set(1.2, 0.7, 0.35);
      c.position.set(x * 0.52, -0.3, 0.66 + 0.1 * (spec.jaw ?? 0) * 0);
      c.rotation.y = x * 0.55;
      head.add(c);
    }
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(spec.skin, 0.8));
  nose.scale.set(1, 0.9, 0.9);
  nose.position.set(0, -0.3, 0.87 + 0.12 * (spec.jaw ?? 0));
  head.add(nose);
  const jaw = spec.jaw ?? 0;
  const mouthZ = 0.8 + 0.3 * jaw;
  if (jaw > 0) {
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), std(spec.skin, 0.75));
    muzzle.scale.set(0.95, 0.7, 0.9);
    muzzle.position.set(0, -0.4, 0.38 + 0.3 * jaw);
    head.add(muzzle);
  }
  if ((spec.brow ?? 0) > 0) {
    const ridge = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.08 + (spec.brow ?? 0), 0.22, 3, 0.04), std(spec.skin, 0.8));
    ridge.position.set(0, 0.07, 0.76);
    head.add(ridge);
  }
  if (spec.hat !== undefined) {
    const straw = std(spec.hat, 0.9);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 36), straw);
    brim.position.set(0, 0.55, 0);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.68, 0.5, 28), straw);
    crown.position.set(0, 0.82, 0);
    head.add(brim, crown);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), lip);
  head.add(mouth);
  // a curved smile for the closed mouth; the ellipse above is the open (speaking) mouth
  const smileMesh = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 8, 24, Math.PI), lip);
  smileMesh.rotation.z = Math.PI;
  head.add(smileMesh);

  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, -0.15, 0.85);
  head.add(headAnchor);

  // arms: sleeve on the upper part (skin when sleeveless), skin hand and finger; optional carried prop
  const ak = spec.armLength ?? 1;
  const flame: THREE.Object3D[] = [];
  const makeProp = (): THREE.Group | null => {
    const g = new THREE.Group();
    if (spec.holding === 'phone') {
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.66, 0.07, 2, 0.03), new THREE.MeshStandardMaterial({color: 0x1b1f24, roughness: 0.4}));
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.58), new THREE.MeshBasicMaterial({color: 0x7fd8ff}));
      screen.position.z = 0.04;
      g.add(body, screen);
      g.position.set(0, 0, 0.26);
    } else if (spec.holding === 'torch') {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.15, 10), std(0x6a4a2a, 0.9));
      stick.position.y = 0.3;
      g.add(stick);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 14), new THREE.MeshBasicMaterial({color: 0xff8a1f}));
      outer.position.y = 1.18;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 12), new THREE.MeshBasicMaterial({color: 0xffe066}));
      inner.position.set(0, 1.1, 0.02);
      g.add(outer, inner);
      flame.push(outer, inner);
      g.position.set(0, 0, 0.12);
    } else if (spec.holding === 'wheat') {
      for (const [x, tilt] of [[-0.12, 0.18], [0, 0], [0.12, -0.18]] as const) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.0, 6), std(0xb89a45, 0.9));
        stalk.position.set(x * 1.3, 0.4, 0);
        stalk.rotation.z = tilt;
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.28, 4, 8), std(0xe3c25a, 0.8));
        ear.position.set(x * 1.3 + tilt * -0.55, 0.98, 0);
        ear.rotation.z = tilt;
        g.add(stalk, ear);
      }
      g.position.set(0, 0, 0.1);
    } else return null;
    return g;
  };
  const makeArm = (side: Side) => {
    const sgn = side === 'L' ? -1 : 1;
    const pivot = new THREE.Group();
    pivot.position.set(sgn * shoulderX, 2.78 - HIPS, 0);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.75, 6, 14), bodyTop);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), skin);
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 10), skin);
    pivot.add(limb, hand, finger);
    const prop = side === 'R' ? makeProp() : null;
    if (prop) pivot.add(prop);
    upper.add(pivot);
    const setReach = (r: number, pointing: boolean) => {
      limb.scale.y = r * ak;
      limb.position.y = -0.52 * r * ak;
      hand.position.y = -1.14 * r * ak;
      finger.position.y = -1.46 * r * ak;
      finger.visible = pointing;
      if (prop) { prop.position.y = -1.14 * r * ak; prop.visible = !pointing; }
    };
    setReach(1, false);
    return {pivot, length: 1.75 * ak * k, setReach}; // world units: the figure scale counts
  };

  const model: Model = {
    root,
    headAnchor,
    torso,
    eyes,
    eyeMeshes,
    // smile: -1 frown .. 0 flat .. 1 broad smile (0.55 = the resting smile of the first version, drawn exactly as before)
    setMouth(open, smile) {
      const closed = open < 0.12;
      smileMesh.visible = closed;
      mouth.visible = !closed;
      const m = Math.abs(smile);
      smileMesh.rotation.z = smile < 0 ? 0 : Math.PI;
      smileMesh.position.set(0, smile < 0 ? -0.5 : -0.46, mouthZ);
      smileMesh.scale.set(0.9 + m * 0.5, m <= 0.5 ? 0.15 + 1.9 * m : 0.9 + 0.4 * m, 1);
      mouth.scale.set(0.17 + m * 0.05 + open * 0.035, 0.028 + open * 0.17, 0.08);
      mouth.position.set(0, -0.52 - open * 0.04, mouthZ);
    },
    // brows: tilt the inner ends (angry down, sad up) and lift them (curious, surprised); symmetric, so no random asymmetry appears
    setExpression(e) {
      for (const {mesh, x} of brows) {
        mesh.rotation.z = (x < 0 ? -1 : 1) * e.brow * 0.45;
        mesh.position.y = 0.09 + e.raise * 0.075 - Math.max(0, e.brow) * 0.025 + Math.max(0, -e.brow) * 0.015;
      }
    },
    arms: {L: makeArm('L'), R: makeArm('R')},
    update(pose) {
      flame.forEach((f, i) => f.scale.set(1 + 0.08 * Math.sin(pose.time * 17 + i), 1 + 0.16 * Math.sin(pose.time * 23 + i * 2), 1));
    },
  };
  model.setMouth(0, 0.5); // a unit shape until it is sized
  model.setExpression?.({smile: 0.5, brow: 0, raise: 0, eye: 1, tilt: 0});
  return model;
}
