// Joints of a GLB written by sand3d (`s3d.export(machine, "x.glb")`): a moving part hangs on a node named after its joint, and the joint is in the
// node's extras (`userData.s3d_joint`: name, type, value, axis, lower, upper). The axis is in the node's own frame, revolute values are radians and
// prismatic values metres, while the node's translation is in the file's own length unit (millimetres under sand3d's 0.001 root scale).
// Pure functions of the value: no time, no state, so a frame is a pure function of the joint values it is given.
import * as THREE from 'three';

export type JointInfo = {name: string; type: 'revolute' | 'continuous' | 'prismatic'; axis: THREE.Vector3; lower: number | null; upper: number | null; recorded: number};
export type Rest = {pos: THREE.Vector3; quat: THREE.Quaternion};

/** The joint recorded on a node's `userData`, or null when the node is not a joint. Throws on a joint kind this file cannot pose. */
export function jointInfo(userData: unknown): JointInfo | null {
  const j = (userData as {s3d_joint?: Record<string, unknown>} | null | undefined)?.s3d_joint;
  if (!j || typeof j.name !== 'string') return null;
  const axis = j.axis;
  if (j.type !== 'revolute' && j.type !== 'continuous' && j.type !== 'prismatic') throw new Error(`joint "${j.name}": kind "${String(j.type)}" is not supported (revolute, continuous, prismatic)`);
  if (!Array.isArray(axis) || axis.length !== 3 || axis.some((v) => typeof v !== 'number')) throw new Error(`joint "${j.name}": no axis in the file`);
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  return {name: j.name, type: j.type, axis: new THREE.Vector3(axis[0], axis[1], axis[2]).normalize(), lower: num(j.lower), upper: num(j.upper), recorded: num(j.value) ?? 0};
}

/** Length of one unit of the node's parent space in metres (0.001 for a millimetre file). */
const unitMetres = (node: THREE.Object3D) => {
  const s = new THREE.Vector3();
  (node.parent ?? node).getWorldScale(s);
  return s.x || 1;
};

/** The node as it stands with the joint at 0. The file may have been exported with the joint already moved (`pose` before `export`): undo that. */
export function restOf(node: THREE.Object3D, info: JointInfo): Rest {
  const quat = node.quaternion.clone(), pos = node.position.clone();
  if (info.type === 'prismatic') pos.addScaledVector(info.axis.clone().applyQuaternion(quat), -info.recorded / unitMetres(node));
  else quat.multiply(new THREE.Quaternion().setFromAxisAngle(info.axis, info.recorded).invert());
  return {pos, quat};
}

/** Move `node` to `value`: degrees for revolute and continuous joints, metres for prismatic. A value outside the joint's range throws (sand3d's `pose` does the same). */
export function poseJoint(node: THREE.Object3D, rest: Rest, info: JointInfo, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`joint "${info.name}": value ${value} is not a number`);
  const v = info.type === 'prismatic' ? value : THREE.MathUtils.degToRad(value);
  const eps = 1e-6;
  if (info.type !== 'continuous' && ((info.lower !== null && v < info.lower - eps) || (info.upper !== null && v > info.upper + eps))) {
    const unit = info.type === 'prismatic' ? ' m' : '°', k = info.type === 'prismatic' ? 1 : 180 / Math.PI;
    throw new Error(`joint "${info.name}": ${value}${unit} is outside its range ${((info.lower ?? -Infinity) * k).toFixed(2)}..${((info.upper ?? Infinity) * k).toFixed(2)}${unit}`);
  }
  node.quaternion.copy(rest.quat);
  node.position.copy(rest.pos);
  if (info.type === 'prismatic') node.position.addScaledVector(info.axis.clone().applyQuaternion(rest.quat), v / unitMetres(node));
  else node.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(info.axis, v));
  node.updateMatrix();
}
