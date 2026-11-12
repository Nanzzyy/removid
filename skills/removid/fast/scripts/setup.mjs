#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {approvedProject} from './project.mjs';
import {compile} from './cues.mjs';
try {
  if (process.argv.length > 4 || (process.argv[3] && process.argv[3] !== '--no-install')) throw new Error('usage: setup.sh <project> [--no-install]');
  const {app} = approvedProject(process.argv[2]);
  const kit = fileURLToPath(new URL('..', import.meta.url));
  const pkg = path.join(app, 'package.json');
  if (fs.existsSync(pkg)) {
    if (JSON.parse(fs.readFileSync(pkg, 'utf8')).name !== 'removid-fast-video') throw new Error('Source/remotion already contains another starter; use that starter');
  } else if (fs.readdirSync(app).length) throw new Error('Source/remotion must be empty for the first FAST setup');
  compile(process.argv[2]);
  // Preserve scene edits on refresh; cues and style are regenerated from approved inputs.
  for (const [from, to] of [
    ['kit/motion.tsx', 'src/motion.tsx'], ['kit/fonts.mjs', 'fonts.mjs'],
    ...['package.json', 'tsconfig.json'].map((f) => [`example/${f}`, f]),
    ...['index.ts', 'Root.tsx', 'Scenes.tsx', 'Presets.tsx'].map((f) => [`example/src/${f}`, `src/${f}`]),
  ]) if (!fs.existsSync(path.join(app, to))) fs.copyFileSync(path.join(kit, from), path.join(app, to));
  fs.mkdirSync(path.join(app, 'public/fonts'), {recursive: true});
  if (process.argv[3] !== '--no-install') {
    for (const [cmd, args] of [['npm', ['install', '--no-audit', '--no-fund']], [process.execPath, ['fonts.mjs']]]) {
      const r = spawnSync(cmd, args, {cwd: app, stdio: 'inherit'});
      if (r.status !== 0) throw new Error(`${cmd} failed`);
    }
  }
  console.log(`ready: ${app}`);
} catch (e) { console.error(`setup: ${e.message}`); process.exitCode = 1; }
