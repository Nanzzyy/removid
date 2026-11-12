#!/usr/bin/env bash
# audio.sh <removid-project>; Python with numpy/scipy and a full ffmpeg required.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project="$(cd "${1:?usage: audio.sh <removid-project>}" && pwd)"
node "$here/project.mjs" "$project"
ffmpeg_bin="${REMOVID_FFMPEG:-${HYPERFRAMES_FFMPEG_PATH:-ffmpeg}}"
python_bin="${REMOVID_PYTHON:-python3}"
"$python_bin" -c 'import numpy, scipy.signal' || { echo 'FAIL audio requires numpy and scipy in REMOVID_PYTHON' >&2; exit 1; }
cd "$project/Source/remotion"
"$python_bin" "$here/../audio/make_audio.py"
# Keep the previously validated mix if synthesis or measurement fails.
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"; rm -f raw_mix.wav' EXIT
# Reserve headroom for transient overshoot when HyperFrames encodes the mix to AAC.
"$ffmpeg_bin" -y -loglevel error -i raw_mix.wav -af loudnorm=I=-14:TP=-4:LRA=11 -ar 44100 "$tmp/mix.wav"
"$ffmpeg_bin" -nostats -i "$tmp/mix.wav" -af ebur128=peak=true -f null - >"$tmp/loudness.log" 2>&1
node "$here/loudness.mjs" <"$tmp/loudness.log"
# The delivered file is AAC, and its true peak can differ from the WAV's by several dB depending on bitrate (128-192k overshot on test mixes). Measure the encode.
"$ffmpeg_bin" -y -loglevel error -i "$tmp/mix.wav" -c:a aac -b:a 256k "$tmp/mix.m4a"
"$ffmpeg_bin" -nostats -i "$tmp/mix.m4a" -af ebur128=peak=true -f null - >"$tmp/aac.log" 2>&1
node "$here/loudness.mjs" <"$tmp/aac.log" || { echo 'FAIL the 256k AAC encode of the mix breaks the loudness limits; lower the mix before assembling' >&2; exit 1; }
cp "$tmp/mix.wav" "$project/Asset/agen/sfx.wav"
echo 'audio: Asset/agen/sfx.wav (synthesized music + effects; HyperFrames assembly track)'
