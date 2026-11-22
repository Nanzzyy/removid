// Tests for skills/removid/scripts/openverse.mjs against a fake Openverse on loopback. No network, no credentials.
//   node --test tests/
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {execFile, spawnSync} from 'node:child_process';
import {promisify} from 'node:util';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OV = path.join(ROOT, 'skills/removid/scripts/openverse.mjs');
const hasFfprobe = spawnSync('ffprobe', ['-version']).status === 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'removid-ov-'));
process.on('exit', () => fs.rmSync(tmp, {recursive: true, force: true}));

/** A 0.5 s, 8 kHz, 16-bit mono WAV with a 440 Hz tone. */
function wav() {
  const n = 4000, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(9000 * Math.sin(2 * Math.PI * 440 * i / 8000)), 44 + i * 2);
  return b;
}
const WAV = wav();

let server, origin;
const seen = []; // every request the fake received: {method, url, auth, body}
let mode = 'ok';
const item = (id, o = {}) => ({id, title: 'Door slam ' + id.slice(0, 2), creator: 'Foley | Joe', category: 'sound_effect', duration: 800, filetype: 'wav', license: 'cc0', license_version: '1.0', source: 'freesound', provider: 'freesound', foreign_landing_url: 'https://freesound.org/s/' + id, url: `/files/${id}.wav`, attribution: `"Door slam" by Foley | Joe is marked CC0 1.0.`, ...o});
const A = 'aaaaaaaa-0000-4000-8000-000000000001', NC = 'bbbbbbbb-0000-4000-8000-000000000002', LONG = 'cccccccc-0000-4000-8000-000000000003', HTML = 'dddddddd-0000-4000-8000-000000000004', NOAUD = 'eeeeeeee-0000-4000-8000-000000000005', BIG = 'ffffffff-0000-4000-8000-000000000006', CHUNK = '11111111-0000-4000-8000-000000000007', MP32 = '22222222-0000-4000-8000-000000000008';
const DB = {[A]: item(A), [NC]: item(NC, {license: 'by-nc-sa', license_version: '4.0'}), [LONG]: item(LONG, {duration: 90000}), [HTML]: item(HTML), [NOAUD]: item(NOAUD, {filetype: 'exe', url: '/files/x.exe'}), [BIG]: item(BIG), [CHUNK]: item(CHUNK), [MP32]: item(MP32, {filetype: 'mp32', source: 'jamendo'})};

before(async () => {
  server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({method: req.method, url: req.url, auth: req.headers.authorization || null, body});
      const u = new URL(req.url, 'http://x');
      if (mode === '429') { res.writeHead(429); return res.end('{"detail":"throttled"}'); }
      if (u.pathname === '/v1/auth_tokens/token/') { res.writeHead(200, {'content-type': 'application/json'}); return res.end(JSON.stringify({access_token: 'tok-123', expires_in: 36000, token_type: 'Bearer'})); }
      if (u.pathname === '/v1/audio/') { res.writeHead(200, {'content-type': 'application/json'}); return res.end(JSON.stringify({result_count: 4, page_count: 1, page_size: 20, page: 1, results: [DB[A], DB[NC], DB[LONG], DB[HTML]]})); }
      const d = u.pathname.match(/^\/v1\/audio\/([0-9a-f-]+)\/$/);
      if (d && DB[d[1]]) { res.writeHead(200, {'content-type': 'application/json'}); return res.end(JSON.stringify(DB[d[1]])); }
      if (u.pathname === `/files/${A}.wav` || u.pathname === `/files/${NC}.wav` || u.pathname === `/files/${BIG}.wav` || u.pathname === `/files/${MP32}.wav`) { res.writeHead(200, {'content-type': 'audio/wav', 'content-length': WAV.length}); return res.end(WAV); }
      if (u.pathname === `/files/${CHUNK}.wav`) { res.writeHead(200, {'content-type': 'audio/wav'}); return res.end(WAV); } // chunked: no content-length
      if (u.pathname === `/files/${HTML}.wav`) { res.writeHead(200, {'content-type': 'text/html'}); return res.end('<html><body>404 not found</body></html>'); }
      res.writeHead(404); res.end('{}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  for (const o of Object.values(DB)) o.url = origin + o.url; // the port is known only now
});
after(() => server.close());

const ov = async (args, env = {}) => {
  try { const r = await promisify(execFile)('node', [OV, ...args], {env: {PATH: process.env.PATH, OPENVERSE_API: origin + '/v1', ...env}}); return {code: 0, out: r.stdout + r.stderr}; }
  catch (e) { return {code: e.code, out: (e.stdout || '') + (e.stderr || '')}; }
};
let n = 0;
function project() {
  const d = path.join(tmp, 'proj' + n++); fs.mkdirSync(path.join(d, 'Asset'), {recursive: true});
  fs.writeFileSync(path.join(d, 'PROJECT.md'), '---\ntype: motion\n---\n');
  fs.writeFileSync(path.join(d, 'Asset/ASSETS.md'), '# Project assets\n\n| file | made by | origin / note | used in frame |\n|---|---|---|---|\n');
  return d;
}

test('search asks under licences that allow commercial use and modification, without a category (Freesound effects have none), and drops what does not fit', async () => {
  seen.length = 0;
  const r = await ov(['search', 'door', 'slam', '--max-sec', '6']);
  assert.equal(r.code, 0, r.out);
  const q = new URL(seen[0].url, 'http://x').searchParams;
  assert.equal(q.get('q'), 'door slam'); assert.equal(q.get('category'), null, 'a category filter hides every Freesound effect'); assert.equal(q.get('source'), null); assert.equal(q.get('license'), 'by,by-sa,cc0,pdm'); assert.equal(q.get('page_size'), '20');
  assert.equal(seen[0].auth, null, 'anonymous without credentials');
  assert.match(r.out, new RegExp(A)); assert.doesNotMatch(r.out, new RegExp(NC), 'nc licence is dropped'); assert.doesNotMatch(r.out, new RegExp(LONG), '90 s is over --max-sec');
  assert.match(r.out, /1 outside 0-6s, 1 with an nc\/nd licence/);
  seen.length = 0; await ov(['search', 'door', '--category', 'music', '--source', 'freesound,jamendo']);
  const q2 = new URL(seen[0].url, 'http://x').searchParams; assert.equal(q2.get('category'), 'music'); assert.equal(q2.get('source'), 'freesound,jamendo');
});
test('search --json is machine readable; --allow-nc-nd lets the nc file through; nothing left is exit 1', async () => {
  const j = JSON.parse((await ov(['search', 'door', '--json'])).out);
  assert.equal(j.results[0].id, A); assert.equal(j.results[0].seconds, 0.8); assert.equal(j.blocked_license, 1);
  assert.ok((await ov(['search', 'door', '--json', '--allow-nc-nd'])).out.includes(NC));
  const none = await ov(['search', 'door', '--min-sec', '500']); assert.equal(none.code, 1, none.out);
});
test('credentials are exchanged for a token, sent as a bearer, and never printed', async () => {
  seen.length = 0;
  const r = await ov(['search', 'door'], {OPENVERSE_CLIENT_ID: 'my-id', OPENVERSE_CLIENT_SECRET: 'my-secret-value'});
  assert.equal(r.code, 0, r.out);
  assert.match(seen[0].body, /grant_type=client_credentials/); assert.equal(seen.at(-1).auth, 'Bearer tok-123'); assert.equal(new URL(seen.at(-1).url, 'http://x').searchParams.get('page_size'), '50');
  assert.ok(!r.out.includes('my-secret-value') && !r.out.includes('tok-123'), 'secret or token leaked');
  const half = await ov(['search', 'door'], {OPENVERSE_CLIENT_ID: 'only-id'}); assert.equal(half.code, 2); assert.match(half.out, /both OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET/);
});
test('bad input and a rate limit are explained and fail', async () => {
  assert.equal((await ov(['search'])).code, 2);
  assert.equal((await ov(['search', 'x', '--category', 'jazz'])).code, 2); assert.equal((await ov(['search', 'x', '--source', 'a b;c'])).code, 2);
  assert.equal((await ov(['search', 'x', '--min-sec', '5', '--max-sec', '2'])).code, 2);
  assert.equal((await ov(['search', 'x', '--limit'])).code, 2);
  const plain = await ov(['search', 'x'], {OPENVERSE_API: 'http://openverse.example.org/v1'}); assert.equal(plain.code, 2); assert.match(plain.out, /must be https/);
  mode = '429'; const t = await ov(['search', 'x']); mode = 'ok'; assert.equal(t.code, 1); assert.match(t.out, /rate limit.*5\/hour/);
  const gone = await ov(['search', 'x'], {OPENVERSE_API: 'http://127.0.0.1:9/v1'}); assert.equal(gone.code, 1); assert.match(gone.out, /cannot reach/);
});
test('fetch saves the file in Asset/agen/sfx, adds a ledger row with the licence, and refuses to overwrite', { skip: !hasFfprobe && 'needs ffprobe' }, async () => {
  const d = project();
  const r = await ov(['fetch', A, '--project', d, '--name', 'Door Slam 01']);
  assert.equal(r.code, 0, r.out);
  const f = path.join(d, 'Asset/agen/sfx/door-slam-01.wav'); assert.ok(fs.readFileSync(f).equals(WAV), 'bytes differ');
  assert.equal(fs.existsSync(f + '.part'), false);
  const ledger = fs.readFileSync(path.join(d, 'Asset/ASSETS.md'), 'utf8');
  assert.match(ledger, /\| agen\/sfx\/door-slam-01\.wav \| third party \(Openverse, freesound\)/); assert.match(ledger, /CC0 1\.0/); assert.match(ledger, /Foley \/ Joe/); assert.ok(!/Foley \| Joe/.test(ledger), 'a | in a name must not split the table');
  assert.match(r.out, /- sfx: lib door-slam-01\.wav @1\.20/);
  const j32 = await ov(['fetch', MP32, '--project', d, '--name', 'jam']); assert.equal(j32.code, 0, j32.out); assert.ok(fs.existsSync(path.join(d, 'Asset/agen/sfx/jam.mp3')), 'Jamendo "mp32" is mp3');
  const again = await ov(['fetch', A, '--project', d, '--name', 'Door Slam 01']); assert.equal(again.code, 1); assert.match(again.out, /already exists/);
  fs.writeFileSync(path.join(d, 'Asset/ASSETS.md'), '# Project assets\n'); // the file is there, the ledger forgot it: still no overwrite
  assert.equal((await ov(['fetch', A, '--project', d, '--name', 'door-slam-01'])).code, 1); assert.ok(fs.readFileSync(f).equals(WAV));
  fs.rmSync(f); fs.writeFileSync(path.join(d, 'Asset/ASSETS.md'), ledger); // the ledger has it, the file is gone: still refused (a name is never reused)
  assert.equal((await ov(['fetch', A, '--project', d, '--name', 'door-slam-01'])).code, 1); assert.equal(fs.existsSync(f), false);
});
test('fetch refuses nc/nd licences, a non-audio type, an error page saved as audio, a too-large file and a folder that is not a project', { skip: !hasFfprobe && 'needs ffprobe' }, async () => {
  const d = project();
  const nc = await ov(['fetch', NC, '--project', d]); assert.equal(nc.code, 1); assert.match(nc.out, /non-commercial or no-derivatives/);
  assert.equal(fs.existsSync(path.join(d, 'Asset/agen/sfx')), false);
  assert.equal((await ov(['fetch', NC, '--project', d, '--allow-nc-nd', '--name', 'nc'])).code, 0);
  const exe = await ov(['fetch', NOAUD, '--project', d]); assert.equal(exe.code, 1); assert.match(exe.out, /not audio/);
  const page = await ov(['fetch', HTML, '--project', d, '--name', 'page']); assert.equal(page.code, 1); assert.match(page.out, /no audio stream/);
  assert.deepEqual(fs.readdirSync(path.join(d, 'Asset/agen/sfx')), ['nc.wav'], 'the error page was kept or left a .part file');
  assert.doesNotMatch(fs.readFileSync(path.join(d, 'Asset/ASSETS.md'), 'utf8'), /page\.wav/);
  const big = await ov(['fetch', BIG, '--project', d, '--name', 'big', '--max-mb', '0']); assert.equal(big.code, 1); assert.match(big.out, /over --max-mb/);
  const chunked = await ov(['fetch', CHUNK, '--project', d, '--name', 'chunk', '--max-mb', '0.001']); assert.equal(chunked.code, 1, chunked.out); assert.match(chunked.out, /over --max-mb/); // no content-length to stop it early
  assert.equal(fs.existsSync(path.join(d, 'Asset/agen/sfx/chunk.wav')), false);
  const bare = path.join(tmp, 'not-a-project'); fs.mkdirSync(bare); const np = await ov(['fetch', A, '--project', bare]); assert.equal(np.code, 1); assert.match(np.out, /not a removid project/);
  assert.equal((await ov(['fetch', '../etc/passwd', '--project', d])).code, 2);
  assert.equal((await ov(['fetch', '99999999-0000-4000-8000-000000000009', '--project', d])).code, 1);
});
