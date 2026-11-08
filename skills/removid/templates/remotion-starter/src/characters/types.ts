// The character contract. A character is a function that builds three.js meshes and returns a Model: the handful of parts the
// shared rig drives from a Pose (src/lib/pose.ts). The rig does the rest: breathing, head turn, blink, lip sync, arm cues.
// Any style fits (male, female, pixel/voxel, mascot, robot, animal...) as long as it returns these parts. No renderer in here,
// so `npm run check` can build every character in plain Node and verify the contract.
import type * as THREE from 'three';
import type {Side} from '../lib/pose.ts';

export type ArmModel = {
  /** At the shoulder. The arm hangs along -Y; the rig swings it with `pivot.rotation.z`. */
  pivot: THREE.Group;
  /** World units from the shoulder to the fingertip when fully extended (drives how far the arm reaches a target). */
  length: number;
  /** r in 0.5..1 shortens the arm along its axis (it stops at its target instead of covering it); pointing shows the finger. */
  setReach(r: number, pointing: boolean): void;
};

/** How the delivery looks on the face (from the script's emotion tag), blended smoothly by lib/emotion.ts. */
export type Expression = {
  /** -1 frown .. 1 broad smile. */
  smile: number;
  /** -1 inner brow ends up (sad) .. 1 inner ends down (angry). */
  brow: number;
  /** 0..1 brows lifted. */
  raise: number;
  /** Eye openness multiplier 0.8..1.3 (the rig already applies it to eyeMeshes; use it only for extra parts). */
  eye: number;
  /** Head lean in radians (the rig leans the whole figure by half of it). */
  tilt: number;
};

export type Model = {
  /** Everything. The rig bounces it and turns it a little toward `pose.look`. Front of the character faces +Z, feet at y = 0. */
  root: THREE.Group;
  /** A point on the face; its screen position decides where the character looks. */
  headAnchor: THREE.Object3D;
  /** Breathes (scaled in Y by about 1%). Put its origin at the bottom of the torso. */
  torso: THREE.Object3D;
  /** The eyes as a group (it slides a little toward the look target) and the meshes that squash when blinking. */
  eyes: THREE.Group;
  eyeMeshes: THREE.Mesh[];
  /** open: 0 closed .. 1 wide (follows the voice envelope); smile: 0..1 resting smile. */
  setMouth(open: number, smile: number): void;
  /** Optional. A character that can frown or move its brows implements this; one that cannot still gets the eye, lean and smile parts of the expression from the rig (smile is clamped to 0..1 for it). */
  setExpression?(e: Expression): void;
  arms: Record<Side, ArmModel>;
  /** Optional extras every frame (hair sway, an antenna...). Must be a pure function of the pose. */
  update?(pose: import('../lib/pose.ts').Pose): void;
};

export type CameraSpec = {pos: [number, number, number]; lookAt: [number, number, number]; fov: number};

export type CharacterDef = {
  id: string;
  label: string;
  /** What it is, in one line: style, who it suits. Shown on the character sheet. */
  about: string;
  camera: CameraSpec;
  /** Canvas y (px, on a 1080 px tall canvas) where the feet are; the ground glow sits there. Measured by scripts/character-sheet.mjs. */
  groundY: number;
  build(): Model;
};

/** Camera that frames a character of `height` world units so it fills `fillPx` of a 1080 px tall canvas, centred on `centerY`. */
export function frameCamera(height: number, centerY: number, fillPx = 700, fov = 24): CameraSpec {
  const dist = (height * 1080) / (fillPx * 2 * Math.tan((fov / 2) * (Math.PI / 180)));
  return {pos: [0, centerY + 0.3, dist], lookAt: [0, centerY, 0], fov};
}
