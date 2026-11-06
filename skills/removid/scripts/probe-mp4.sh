#!/usr/bin/env bash
# Assert a rendered video. Usage: probe-mp4.sh out.mp4 [WxH] [fps] [seconds]
# Prints a summary; exits 1 on any mismatch so it can gate delivery.
set -u
f="${1:-}"; want_size="${2:-}"; want_fps="${3:-}"; want_dur="${4:-}"
[ -n "$f" ] || { echo "usage: $0 file.mp4 [WxH] [fps] [seconds]"; exit 2; }
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

[ -z "$want_size" ] || [ "$want_size" = "${w}x${h}" ] || fail "size is ${w}x${h}, want $want_size"
[ -z "$want_fps" ]  || close "$fps" "$want_fps" 0.05 || fail "fps is $fps, want $want_fps"
[ -z "$want_dur" ]  || close "$dur" "$want_dur" 0.2  || fail "duration is ${dur}s, want ~${want_dur}s"

[ "$rc" -eq 0 ] && echo "OK"
exit "$rc"
