// Shared guard for the optional FAST kit (videos without narration). Use the existing project gate and plan.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const projectTool = fileURLToPath(new URL('../../scripts/project.mjs', import.meta.url));
export function approvedProject(input) {
  if (!input) throw new Error('a removid project directory is required');
  const project = path.resolve(input);
  const r = spawnSync(process.execPath, [projectTool, 'gate', 'sample', project], {encoding: 'utf8'});
  if (r.status !== 0) throw new Error((r.stdout || '') + (r.stderr || '') || 'project gate failed');
  const meta = fs.readFileSync(path.join(project, 'PROJECT.md'), 'utf8');
  if (!/^narration: no\s*$/m.test(meta)) throw new Error('FAST supports projects with narration: no only');
  const plan = JSON.parse(fs.readFileSync(path.join(project, 'Storyboard/plan.json'), 'utf8'));
  if (plan.fps !== 60 || plan.totalSec <= 0 || plan.totalSec > 45) throw new Error('FAST needs a 60 fps plan of 0–45 seconds');
  if (plan.frames.some((f) => f.engine !== 'remotion' || f.cursor.length || f.zoom.length || f.vo.length)) throw new Error('footage, cursor, zoom or voice needs the full starter');
  const direction = fs.readFileSync(path.join(project, 'Storyboard/direction.json'), 'utf8');
  const sourceHash = createHash('sha256').update(plan.hash + '\n' + direction).digest('hex');
  return {project, plan, direction: JSON.parse(direction), sourceHash, app: path.join(project, 'Source/remotion')};
}
export function currentCues(input) {
  const p = approvedProject(input);
  const cues = JSON.parse(fs.readFileSync(path.join(p.app, 'src/cues.json'), 'utf8'));
  if (cues.sourceHash !== p.sourceHash) throw new Error('cues are stale; run setup.sh again after storyboard approval');
  return {...p, cues};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { currentCues(process.argv[2]); } catch (e) { console.error(`FAST: ${e.message}`); process.exitCode = 1; }
}
