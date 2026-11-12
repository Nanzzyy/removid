#!/usr/bin/env bash
# Assert a rendered video. Usage: probe-mp4.sh [--require-audio] out.mp4 [WxH] [fps] [seconds]
# --require-audio: exit 1 when the file has no audio stream. Use it on the final video (a video without sound is a defect);
# leave it off for scene clips, which are rendered without audio on purpose.
# Prints a summary; exits 1 on any mismatch so it can gate delivery. For a video with audio it also prints the integrated loudness
# (target -14 LUFS +-2, true peak <= -1 dBFS) as FAIL/warn lines when ffmpeg has the ebur128 filter (FFMPEG=/path/to/full/ffmpeg).
set -u
require_audio=0
if [ "${1:-}" = "--require-audio" ]; then require_audio=1; shift; fi
f="${1:-}"; want_size="${2:-}"; want_fps="${3:-}"; want_dur="${4:-}"
[ -n "$f" ] || { echo "usage: $0 [--require-audio] file.mp4 [WxH] [fps] [seconds]"; exit 2; }
[ -s "$f" ] || { echo "FAIL: $f missing or empty"; exit 1; }
command -v ffprobe >/dev/null || { echo "FAIL: ffprobe not found"; exit 1; }

IFS=, read -r w h rate < <(ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate -of csv=p=0 "$f")
[ -n "${w:-}" ] || { echo "FAIL: no video stream in $f"; exit 1; }
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
fps=$(awk -v r="$rate" 'BEGIN{n=split(r,a,"/"); printf "%.2f", (n>1 && a[2]>0) ? a[1]/a[2] : a[1]}')
audio=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$f" | head -n1)
echo "file: $f ($(du -h "$f" | cut -f1))"
echo "size: ${w}x${h}  fps: $fps  duration: ${dur}s  audio: ${audio:-none}"

rc=0
fail() { echo "FAIL: $1"; rc=1; }
close() { awk -v a="$1" -v b="$2" -v t="$3" 'BEGIN{d=a-b; if(d<0)d=-d; exit !(d<=t)}'; }

[ "$require_audio" -eq 0 ] || [ -n "${audio:-}" ] || fail "no audio stream (a video without sound is a defect)"
[ -z "$want_size" ] || [ "$want_size" = "${w}x${h}" ] || fail "size is ${w}x${h}, want $want_size"
[ -z "$want_fps" ]  || close "$fps" "$want_fps" 0.05 || fail "fps is $fps, want $want_fps"
[ -z "$want_dur" ]  || close "$dur" "$want_dur" 0.2  || fail "duration is ${dur}s, want ~${want_dur}s"

if [ -n "${audio:-}" ]; then
  ff="${FFMPEG:-${REMOVID_FFMPEG:-${HYPERFRAMES_FFMPEG_PATH:-ffmpeg}}}"
  if "$ff" -hide_banner -filters 2>/dev/null | grep -q ' ebur128 '; then
    m=$("$ff" -hide_banner -nostats -i "$f" -vn -af ebur128=peak=true -f null - 2>&1 | awk '/^ +I:/{i=$2} /^ +Peak:/{p=$2} END{print i, p}')
    lufs=${m% *}; peak=${m#* }
    echo "loudness: ${lufs} LUFS  true peak: ${peak} dBFS"
    close "$lufs" "-14" 2 || echo "warn: loudness ${lufs} LUFS is outside -14 +-2 (mix the voice/music levels again)"
    awk -v p="$peak" 'BEGIN{exit !(p>-1)}' && fail "true peak ${peak} dBFS is above -1 (clipping risk)"
  else
    echo "loudness: not measured (this ffmpeg lacks ebur128; set FFMPEG to a full build)"
  fi
fi
[ "$rc" -eq 0 ] && echo "OK"
exit "$rc"
