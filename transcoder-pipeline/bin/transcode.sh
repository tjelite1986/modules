#!/bin/bash
# Transcode shortvideos/shorts18 originals to <slug>.web.mp4 next to them,
# then delete the original to save space (lib/clips treats orphan
# <slug>.web.mp4 as a clip).
# Fast path: ffmpeg -> H.264 main, capped 4 Mbps, 1080p ceiling, AAC,
# faststart. Slow path: when ffmpeg can't read the header (e.g. DASH
# segments missing the codec config box, like FikFap downloads), fall
# back to VLC which probes the bitstream directly, then remux with
# ffmpeg to add faststart. Failed files get a .web.failed marker so
# the timer doesn't re-attempt them every cycle; replacing the source
# (newer mtime) clears the skip. Uses flock to prevent concurrent runs.
#
# Configuration via environment:
#   ELITE_STORE_ROOT   – host path containing shortvideos/, shorts18/, tiktok/
#                        (default: /mnt/storage/elite)
#   ELITE_LOG          – log path (default: /var/log/elite-transcode.log)

set -uo pipefail

STORE_ROOT="${ELITE_STORE_ROOT:-/mnt/storage/elite}"
ROOTS=("$STORE_ROOT/shortvideos" "$STORE_ROOT/shorts18")
TIKTOK_ROOT="$STORE_ROOT/tiktok"
LOG="${ELITE_LOG:-/var/log/elite-transcode.log}"
LOCK=/var/lock/elite-transcode.lock

exec 9>"$LOCK"
flock -n 9 || exit 0

exec >>"$LOG" 2>&1

ffmpeg_transcode() {
  local src="$1" dst="$2"
  ffmpeg -y -hide_banner -loglevel error -nostdin -i "$src" \
    -c:v libx264 -profile:v main -level 4.0 -preset veryfast -crf 23 \
    -maxrate 4M -bufsize 8M \
    -vf "scale='min(1080,iw)':-2" \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    "$dst"
}

# VLC's --sout mini-language uses ',' and ':' as parameter separators, so a
# destination path that contains either of those characters gets silently
# truncated by VLC and bytes are written to a half-baked filename. Always
# write into a randomized /tmp path with no special chars and rename after.
vlc_transcode() {
  local src="$1" dst="$2"
  local tmp_vlc
  tmp_vlc="$(mktemp -p /tmp elite-vlc-XXXXXX.mp4)"
  rm -f "$tmp_vlc"  # mktemp creates the file; cvlc wants to create it itself
  cvlc --intf=dummy --no-video-title-show --quiet "$src" \
    --sout "#transcode{vcodec=h264,venc=x264{profile=main,level=4.0,preset=veryfast,crf=23},vb=4000,vfilter=canvas{width=1080,height=1920,padd=false},acodec=mp4a,ab=128,channels=2,deinterlace}:standard{access=file,mux=mp4,dst=$tmp_vlc}" \
    vlc://quit </dev/null
  if [ ! -s "$tmp_vlc" ]; then
    rm -f "$tmp_vlc"
    return 1
  fi
  ffmpeg -y -hide_banner -loglevel error -nostdin -i "$tmp_vlc" \
    -c copy -movflags +faststart "$dst"
  local rc=$?
  rm -f "$tmp_vlc"
  return $rc
}

processed=0
recovered=0

# Build per-loop list: shortvideos/shorts18 root + each profile subdir
# under them, plus each tiktok/<user>/. Files used to live only at the top
# level; they're now organised per-profile, so we have to recurse one level.
SCAN_DIRS=()
for root in "${ROOTS[@]}"; do
  [ -d "$root" ] || continue
  SCAN_DIRS+=("$root")
  while IFS= read -r -d '' d; do
    SCAN_DIRS+=("$d")
  done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -print0)
done
# shorts18 now has an extra category layer (shorts18/<category>/<profile>/),
# so also enumerate one more level deep under each ROOT.
for root in "${ROOTS[@]}"; do
  [ -d "$root" ] || continue
  while IFS= read -r -d '' d; do
    SCAN_DIRS+=("$d")
  done < <(find "$root" -mindepth 2 -maxdepth 2 -type d -print0)
done
if [ -d "$TIKTOK_ROOT" ]; then
  while IFS= read -r -d '' d; do
    SCAN_DIRS+=("$d")
  done < <(find "$TIKTOK_ROOT" -mindepth 1 -maxdepth 1 -type d -print0)
fi

for root in "${SCAN_DIRS[@]}"; do
  while IFS= read -r -d '' src; do
    case "${src,,}" in
      *.web.mp4) continue ;;
    esac

    base="${src%.*}"
    web="${base}.web.mp4"
    failed="${base}.web.failed"

    if [ -f "$web" ] && [ "$web" -nt "$src" ]; then
      continue
    fi
    if [ -f "$failed" ] && [ "$failed" -nt "$src" ]; then
      continue
    fi

    echo "[$(date -Is)] transcoding: $src"
    tmp="${web}.tmp.mp4"
    if ffmpeg_transcode "$src" "$tmp" 2>/dev/null; then
      mv "$tmp" "$web"
      rm -f "$failed"
      rm -f -- "$src"
      echo "[$(date -Is)] done: $web (original removed)"
      processed=$((processed + 1))
    else
      rm -f "$tmp"
      echo "[$(date -Is)] ffmpeg failed, trying VLC fallback: $src"
      if vlc_transcode "$src" "$tmp" 2>/dev/null && [ -s "$tmp" ]; then
        mv "$tmp" "$web"
        rm -f "$failed"
        rm -f -- "$src"
        echo "[$(date -Is)] done (vlc): $web (original removed)"
        processed=$((processed + 1))
        recovered=$((recovered + 1))
      else
        rm -f "$tmp"
        touch "$failed"
        echo "[$(date -Is)] failed (marked): $src"
      fi
    fi
  done < <(find "$root" -maxdepth 1 -type f \
    \( -iname '*.mp4' -o -iname '*.webm' -o -iname '*.mov' -o -iname '*.m4v' \) \
    -print0)
done

if [ "$processed" -gt 0 ]; then
  echo "[$(date -Is)] processed $processed file(s) ($recovered via VLC fallback)"
fi
