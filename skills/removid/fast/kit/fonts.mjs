#!/usr/bin/env node
// Download selected Fontsource packages at setup, then render from local WOFF2 files.
import {existsSync, mkdirSync, copyFileSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const style = JSON.parse(readFileSync('src/style.json', 'utf8'));
const list = process.argv.length > 2 ? process.argv.slice(2) : [style.font.head, style.font.body];
mkdirSync('public/fonts', {recursive: true});
for (const id of new Set(list)) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*@[1-9]00$/.test(id)) throw new Error(`invalid font id: ${id}`);
  const [slug, w] = id.split('@'), src = `node_modules/@fontsource/${slug}/files/${slug}-latin-${w}-normal.woff2`;
  if (!existsSync(src)) {
    const r = spawnSync('npm', ['install', '--no-audit', '--no-fund', `@fontsource/${slug}`], {stdio: 'inherit'});
    if (r.status !== 0) throw new Error(`font package install failed: ${slug}`);
  }
  if (!existsSync(src)) throw new Error(`missing font weight: ${src}`);
  copyFileSync(src, `public/fonts/${slug}-${w}.woff2`);
  console.log('font', id);
}
