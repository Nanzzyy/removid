#!/usr/bin/env bash
# qa.sh <video.mp4> [fps=60] [out-dir] [expected-size] [expected-duration]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
video="${1:?usage: qa.sh <video.mp4> [fps] [out-dir] [size] [duration]}"
fps="${2:-60}"; output="${3:-$(dirname "$video")/qa}"; fail=0
ffmpeg_bin="${REMOVID_FFMPEG:-${HYPERFRAMES_FFMPEG_PATH:-ffmpeg}}"; ffprobe_bin="${REMOVID_FFPROBE:-ffprobe}"
[ -s "$video" ] || { echo "FAIL no video: $video" >&2; exit 1; }
mkdir -p "$output"
"$ffprobe_bin" -v error -show_streams -show_format -of json "$video" >"$output/probe.json"
node --input-type=module - "$output/probe.json" "$fps" "${4:-}" "${5:-}" <<'JS' || fail=1
import fs from 'node:fs';
const [file, fps, size, seconds] = process.argv.slice(2), p = JSON.parse(fs.readFileSync(file));
const v = p.streams.find((s) => s.codec_type === 'video'), a = p.streams.find((s) => s.codec_type === 'audio');
const bad = (m) => { console.error('FAIL ' + m); process.exitCode = 1; };
if (!v) bad('no video stream');
else {
  const rate = (s) => { const [n, d] = String(s).split('/').map(Number); return n / d; };
  if (!Number.isFinite(Number(fps)) || Number(fps) <= 0 || [v.r_frame_rate, v.avg_frame_rate].some((r) => !Number.isFinite(rate(r)) || Math.abs(rate(r) - Number(fps)) > .01)) bad(`fps ${v.r_frame_rate}/${v.avg_frame_rate}, expected ${fps}`);
  if (size && `${v.width}x${v.height}` !== size) bad(`size ${v.width}x${v.height}, expected ${size}`);
}
if (!a) bad('no audio stream');
const dur = Number(p.format.duration);
if (!Number.isFinite(dur) || dur <= 0) bad('invalid duration');
if (seconds && (!Number.isFinite(Number(seconds)) || Math.abs(dur - Number(seconds)) > .1)) bad(`duration ${dur}, expected ${seconds}`);
console.log(`video: ${v?.width}x${v?.height}, ${v?.r_frame_rate}, ${dur}s, audio=${a?.codec_name ?? 'NONE'}`);
JS
if "$ffmpeg_bin" -nostats -i "$video" -af ebur128=peak=true -f null - >"$output/loudness.log" 2>&1; then
  node "$here/loudness.mjs" <"$output/loudness.log" || fail=1
else echo 'FAIL ffmpeg audio measurement' >&2; fail=1; fi
for filter in 'freezedetect=n=-55dB:d=0.5' 'blackdetect=d=0.1:pix_th=0.05'; do
  name="${filter%%=*}"
  if "$ffmpeg_bin" -nostats -i "$video" -vf "$filter" -an -f null - >"$output/$name.log" 2>&1; then
    if grep -Eq 'freeze_start|black_start' "$output/$name.log"; then echo "FAIL $name found frozen/black frames" >&2; fail=1; fi
  else echo "FAIL ffmpeg $name" >&2; fail=1; fi
done
duration="$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1])); console.log(p.format.duration)' "$output/probe.json")"
if "$ffmpeg_bin" -y -loglevel error -i "$video" -vf "fps=10/$duration,scale=270:-1,tile=5x2" -frames:v 1 -q:v 3 "$output/sheet.jpg" && [ -s "$output/sheet.jpg" ]; then
  echo "sheet: $output/sheet.jpg (inspect overlap, contrast and clipped text)"
else echo 'FAIL contact sheet' >&2; fail=1; fi
exit "$fail"
