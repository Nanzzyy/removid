// Optional connector to a local, OpenAI-compatible speech server (Voice Studio's POST /v1/audio/speech). removid never installs, starts
// or bundles a voice engine, and never sends a script anywhere but a loopback address unless the owner sets REMOVID_VOICE_ALLOW_REMOTE=1.
// The owner decides whether such a server exists; this file only asks it, read-only for the probe, one request per line for synthesis.
// Pure Node (fetch), no dependencies. Tested against a fake server (tests/style.test.mjs); NOT yet verified against a live Voice Studio.
export const DEFAULT_URL = 'http://127.0.0.1:3900';
export const voiceUrl = (opt = {}) => String((opt.url && opt.url !== true ? opt.url : process.env.REMOVID_VOICE_URL) || DEFAULT_URL).replace(/\/+$/, '');

/** Throws unless the URL is a loopback address (or the owner allowed remote use explicitly). */
export function assertLocal(url) {
  let h; try { h = new URL(url).hostname; } catch { throw new Error(`not a URL: ${url}`); }
  const local = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(h);
  if (!local && process.env.REMOVID_VOICE_ALLOW_REMOTE !== '1') throw new Error(`${h} is not a loopback address. The script is only sent to this machine; set REMOVID_VOICE_ALLOW_REMOTE=1 if the owner has accepted that server.`);
  return url;
}

/** Read-only: does something answer at the capability address? Never starts anything. */
export async function probe(url, ms = 2500) {
  assertLocal(url);
  try {
    const r = await fetch(`${url}/.well-known/voicestudio-speech`, {signal: AbortSignal.timeout(ms)});
    return {up: r.ok, status: r.status, url};
  } catch (e) { return {up: false, status: 0, url, error: String(e && e.cause?.code || e && e.name || e)}; }
}

/** One line of text to WAV bytes. `voice` is the server's voice name. */
export async function synth(url, text, {voice = 'alloy', ms = 600000} = {}) {
  assertLocal(url);
  const r = await fetch(`${url}/v1/audio/speech`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({model: 'tts-1', voice, input: text, response_format: 'wav'}), signal: AbortSignal.timeout(ms)});
  if (!r.ok) throw new Error(`speech server answered ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 100 || buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('the server did not return a WAV file');
  return buf;
}
