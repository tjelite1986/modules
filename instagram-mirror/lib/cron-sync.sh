#!/bin/bash
# Daily Instagram profile auto-poll. Reads SYNC_TOKEN from the compose
# .env and posts to /api/instagram/sync-all, which iterates every saved
# profile and runs syncProfile (yt-dlp first, gallery-dl fallback). New
# media lands under PHOTOS_ROOT/<username>/ where the Photo browser and
# /feed Discover tab pick it up.
#
# Configuration via environment (or hard-edit the defaults below):
#   ELITE_ENV_FILE  – path to the compose .env containing SYNC_TOKEN
#   ELITE_URL_BASE  – public base URL (e.g. https://elite.example.com)
#   ELITE_LOG       – log path

set -uo pipefail

ENV_FILE="${ELITE_ENV_FILE:-/etc/elite/elite.env}"
URL_BASE="${ELITE_URL_BASE:-https://elite.example.com}"
LOG="${ELITE_LOG:-/var/log/elite-instagram-sync.log}"
URL="$URL_BASE/api/instagram/sync-all"

exec >>"$LOG" 2>&1

if [ ! -r "$ENV_FILE" ]; then
  echo "[$(date -Is)] env file not readable: $ENV_FILE"
  exit 1
fi

TOKEN=$(grep '^SYNC_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "$TOKEN" ]; then
  echo "[$(date -Is)] SYNC_TOKEN not set in $ENV_FILE"
  exit 1
fi

echo "[$(date -Is)] starting sync"
HTTP_STATUS=$(curl -sS -o /tmp/.elite-instagram-sync.out -w "%{http_code}" \
  -X POST "$URL" \
  -H "X-Sync-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"photos"}' --max-time 1800)
BODY=$(cat /tmp/.elite-instagram-sync.out 2>/dev/null || echo "")
rm -f /tmp/.elite-instagram-sync.out
echo "[$(date -Is)] http=$HTTP_STATUS body=$BODY"
