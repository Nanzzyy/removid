#!/usr/bin/env node
// Find and fetch openly licensed sound effects from Openverse (https://api.openverse.org/v1). Node only, no dependencies.
//   node openverse.mjs search "<keywords>" [--source freesound] [--category sound_effect] [--license by,by-sa,cc0,pdm] [--min-sec 0] [--max-sec 6]
//                      [--ext wav,mp3] [--limit 10] [--pages 1] [--json]
// Most sound effects in Openverse come from Freesound with NO category (measured on the live API: `category=sound_effect` returned nothing for
// "door slam"), so no category is asked for unless --category says so. Keywords, --source and --max-sec do the narrowing.
//   node openverse.mjs fetch <id> --project <proj> [--name whoosh-01] [--allow-nc-nd] [--max-mb 20]
// Search and fetch run while the video is BUILT, never while it renders. Only the keywords go to Openverse: never the script or the brief.
// A fetched file lands in <proj>/Asset/agen/sfx/ and gets a row in Asset/ASSETS.md with its licence and attribution. Use it in the
// storyboard as `- sfx: lib <file> @1.20 [gain=0.6]`; sfx.mjs mixes it.
// Credentials (optional): OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET from the environment, exchanged for a token. They are never printed or
// written. Without them the anonymous quota is 5 requests an hour and 100 a day. OPENVERSE_API overrides the base URL (https, or loopback for tests).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2);
const cmd = args.shift();
const valued = new Set(['--category', '--source', '--license', '--min-sec', '--max-sec', '--ext', '--limit', '--pages', '--project', '--name', '--max-mb']);
const flags = new Set(['--json', '--allow-nc-nd']);
const opt = {}, pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (valued.has(a)) { if (i + 1 >= args.length) die(`${a} needs a value`, 2); opt[a] = args[++i]; }
  else if (flags.has(a)) opt[a] = true;
  else if (a.startsWith('--')) die(`unknown option ${a}`, 2);
  else pos.push(a);
}
function die(msg, code = 1) { console.error(msg); process.exit(code); }

const BASE = (process.env.OPENVERSE_API || 'https://api.openverse.org/v1').replace(/\/+$/, '');
const base = new URL(BASE);
const loopback = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(base.hostname);
if (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) die(`OPENVERSE_API must be https (or http on loopback): ${BASE}`, 2);
const CATEGORIES = ['sound_effect', 'music', 'podcast', 'pronunciation', 'news', 'audiobook'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'];
const DEFAULT_LICENSES = 'by,by-sa,cc0,pdm'; // commercial use and modification both allowed
const num = (v, d, name) => { if (v === undefined) return d; const n = Number(v); if (!Number.isFinite(n) || n < 0) die(`${name} must be a number >= 0 (got "${v}")`, 2); return n; };

async function http(url, init = {}, what = 'request') {
  let r;
  try { r = await fetch(url, {...init, signal: AbortSignal.timeout(30000), headers: {'User-Agent': 'removid-openverse/1', ...(init.headers || {})}}); }
  catch (e) { die(`${what}: cannot reach ${new URL(url).host} (${e.cause?.code || e.message})`); }
  if (r.status === 429) die(`${what}: Openverse rate limit hit (anonymous: 5/hour, 100/day). Set OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET (register at ${BASE}/auth_tokens/register/), or wait.`);
  if (!r.ok) { const t = (await r.text().catch(() => '')).slice(0, 200); die(`${what}: HTTP ${r.status} ${t}`); }
  return r;
}
let token = null, tokenTried = false;
async function authHeaders() {
  if (!tokenTried) {
    tokenTried = true;
    const id = process.env.OPENVERSE_CLIENT_ID, secret = process.env.OPENVERSE_CLIENT_SECRET;
    if (id && secret) {
      const r = await http(`${BASE}/auth_tokens/token/`, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'client_credentials', client_id: id, client_secret: secret})}, 'token');
      token = (await r.json()).access_token || null;
      if (!token) die('token: Openverse answered without an access_token');
    } else if (id || secret) die('set both OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET, or neither', 2);
  }
  return token ? {Authorization: `Bearer ${token}`} : {};
}
async function getJson(url, what) { return (await http(url, {headers: {Accept: 'application/json', ...(await authHeaders())}}, what)).json(); }

const sec = (ms) => (typeof ms === 'number' ? ms / 1000 : null);
const row = (r) => ({id: r.id, title: r.title, creator: r.creator || null, category: r.category || null, seconds: sec(r.duration), filetype: r.filetype || null, license: r.license, version: r.license_version || null, source: r.source || r.provider || null, page: r.foreign_landing_url || null, url: r.url, attribution: r.attribution || null});
const ndnc = (lic) => /(^|-)(nc|nd)(-|$)/.test(String(lic || '').toLowerCase());

async function search() {
  const q = pos.join(' ').trim();
  if (!q) die('usage: openverse.mjs search "<keywords>" [--source freesound] [--category sound_effect] [--license by,by-sa,cc0,pdm] [--min-sec N] [--max-sec N] [--ext wav,mp3] [--limit N] [--pages N] [--json]', 2);
  const category = opt['--category'] || null;
  if (category && !CATEGORIES.includes(category)) die(`--category must be one of ${CATEGORIES.join(', ')}`, 2);
  const source = opt['--source'] || null;
  if (source && !/^[a-z0-9_,]+$/.test(source)) die('--source is a comma separated list of source names, e.g. freesound', 2);
  const lic = opt['--license'] || DEFAULT_LICENSES;
  const min = num(opt['--min-sec'], 0, '--min-sec'), max = num(opt['--max-sec'], Infinity, '--max-sec'), limit = Math.max(1, Math.floor(num(opt['--limit'], 10, '--limit'))), pages = Math.max(1, Math.min(5, Math.floor(num(opt['--pages'], 1, '--pages'))));
  if (min > max) die('--min-sec is larger than --max-sec', 2);
  const hdr = await authHeaders();
  const out = [];
  let seen = 0, outside = 0, blocked = 0;
  for (let page = 1; page <= pages && out.length < limit; page++) {
    const u = new URL(`${BASE}/audio/`);
    u.search = new URLSearchParams({q, ...(category ? {category} : {}), ...(source ? {source} : {}), license: lic, page_size: token ? '50' : '20', page: String(page), ...(opt['--ext'] ? {extension: opt['--ext']} : {})}).toString();
    const data = await getJson(u, 'search');
    if (!Array.isArray(data.results)) die('search: unexpected answer from Openverse (no "results")');
    for (const r of data.results) {
      seen++;
      const s = sec(r.duration);
      if (s !== null && (s < min || s > max)) { outside++; continue; }
      if (!opt['--allow-nc-nd'] && ndnc(r.license)) { blocked++; continue; }
      out.push(row(r)); if (out.length >= limit) break;
    }
    if (page >= (data.page_count || 1)) break;
  }
  if (opt['--json']) { console.log(JSON.stringify({query: q, category, source, license: lic, seen, outside_duration: outside, blocked_license: blocked, results: out}, null, 1)); }
  else {
    for (const r of out) console.log(`${r.id}  ${r.seconds === null ? '?' : r.seconds.toFixed(1)}s  ${r.filetype || '?'}  ${r.license}${r.version ? ' ' + r.version : ''}  ${r.source || ''}  "${r.title}" by ${r.creator || 'unknown'}`);
    console.log(`${out.length} result(s) of ${seen} seen (${outside} outside ${min}-${max === Infinity ? 'any' : max}s, ${blocked} with an nc/nd licence)${token ? '' : '; anonymous quota is small'}`);
  }
  if (!out.length) process.exit(1);
}

const safeName = (s) => String(s).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 60);
const cell = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim();

async function fetchOne() {
  const id = pos[0];
  if (!id || !/^[0-9a-f-]{8,40}$/i.test(id) || !opt['--project']) die('usage: openverse.mjs fetch <id> --project <proj> [--name whoosh-01] [--allow-nc-nd] [--max-mb 20]', 2);
  const proj = path.resolve(opt['--project']);
  if (!fs.existsSync(path.join(proj, 'PROJECT.md'))) die(`${proj} is not a removid project folder (no PROJECT.md)`);
  const ledger = path.join(proj, 'Asset', 'ASSETS.md');
  if (!fs.existsSync(ledger)) die(`${ledger} is missing: run project.mjs repair first`);
  const d = await getJson(`${BASE}/audio/${id}/`, 'detail');
  if (!d.url || !d.license) die('detail: Openverse answered without a url or a licence; refusing to use the file');
  if (!opt['--allow-nc-nd'] && ndnc(d.license)) die(`licence ${d.license} is non-commercial or no-derivatives: a video with a soundtrack is a derivative work. Pick another file, or pass --allow-nc-nd if the user accepted that.`);
  const dl = new URL(d.url);
  if (dl.protocol !== 'https:' && !(dl.protocol === 'http:' && loopback)) die(`download url is not https: ${dl.protocol}//${dl.host}`);
  const extRaw = String(d.filetype || path.extname(dl.pathname).slice(1) || '').toLowerCase().replace(/^mp32$/, 'mp3'); // Jamendo calls its mp3 "mp32"
  const ext = AUDIO_EXT.includes(extRaw) ? extRaw : null;
  if (!ext) die(`file type "${extRaw || 'unknown'}" is not audio this tool accepts (${AUDIO_EXT.join(', ')})`);
  const name = safeName(opt['--name'] || d.title || id) || safeName(id);
  const file = `${name}.${ext}`;
  const dir = path.join(proj, 'Asset', 'agen', 'sfx'), dest = path.join(dir, file);
  const ledgerText = fs.readFileSync(ledger, 'utf8');
  if (fs.existsSync(dest) || ledgerText.includes(`agen/sfx/${file}`)) die(`agen/sfx/${file} already exists or is already in the ledger: choose another --name`);
  const maxBytes = num(opt['--max-mb'], 20, '--max-mb') * 1048576;
  const r = await http(dl, {}, 'download');
  if (new URL(r.url).protocol !== 'https:' && !loopback) die(`download was redirected to a non-https url: ${new URL(r.url).host}`);
  const len = Number(r.headers.get('content-length') || 0);
  if (len > maxBytes) die(`download: ${(len / 1048576).toFixed(1)} MB is over --max-mb`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > maxBytes) die(`download: ${(buf.length / 1048576).toFixed(1)} MB is over --max-mb`);
  fs.mkdirSync(dir, {recursive: true});
  const tmp = dest + '.part';
  fs.writeFileSync(tmp, buf);
  const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type:format=duration', '-of', 'json', tmp], {encoding: 'utf8'});
  let seconds = null, note = '';
  if (pr.error) note = ' (ffprobe not found: the file was not checked)';
  else {
    let j = {}; try { j = JSON.parse(pr.stdout || '{}'); } catch { /* handled below */ }
    if (pr.status !== 0 || !(j.streams || []).length) { fs.rmSync(tmp, {force: true}); die('download: the file has no audio stream (an error page saved as audio?). Nothing was kept.'); }
    seconds = Number(j.format?.duration) || null;
  }
  fs.renameSync(tmp, dest);
  const credit = d.attribution || `"${d.title}" by ${d.creator || 'unknown'}, licence ${d.license}${d.license_version ? ' ' + d.license_version : ''}`;
  const line = `| agen/sfx/${file} | third party (Openverse, ${cell(d.source || d.provider || 'unknown')}); not made by the agent | ${cell(credit)} Source: ${cell(d.foreign_landing_url || d.url)}. ${/^(by|by-sa)$/.test(String(d.license).toLowerCase()) ? 'Credit the author in the video or its description (licence ' + d.license + ').' : 'No credit required.'} | not placed yet |`;
  fs.writeFileSync(ledger, ledgerText.replace(/\n*$/, '\n') + line + '\n');
  console.log(`saved ${path.relative(process.cwd(), dest) || dest}${seconds ? ` (${seconds.toFixed(2)} s)` : ''}${note}\nlicence: ${d.license}${d.license_version ? ' ' + d.license_version : ''}\nledger row added to Asset/ASSETS.md\nuse it in the storyboard: - sfx: lib ${file} @1.20 gain=0.6`);
}

if (cmd === 'search') await search();
else if (cmd === 'fetch') await fetchOne();
else die('usage: openverse.mjs search "<keywords>" [options] | fetch <id> --project <proj> [options]', 2);
