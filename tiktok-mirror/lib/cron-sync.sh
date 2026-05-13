#!/bin/bash
# Daily TikTok profile auto-poll. Reads SYNC_TOKEN from the compose .env
# and posts to /api/tiktok/sync-all, which re-fetches each saved profile
# and adds metadata for any new videos. Videos themselves are still
# lazy-loaded on first watch, so this stays cheap on bandwidth.
#
# Configuration via environment (or hard-edit the defaults below):
#   ELITE_ENV_FILE  – path to the compose .env containing SYNC_TOKEN
#   ELITE_URL_BASE  – public base URL (e.g. https://elite.example.com)
#   ELITE_LOG       – log path

set -uo pipefail

ENV_FILE="${ELITE_ENV_FILE:-/etc/elite/elite.env}"
URL_BASE="${ELITE_URL_BASE:-https://elite.example.com}"
LOG="${ELITE_LOG:-/var/log/elite-tiktok-sync.log}"
URL="$URL_BASE/api/tiktok/sync-all"

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
HTTP_STATUS=$(curl -sS -o /tmp/.elite-tiktok-sync.out -w "%{http_code}" \
  -X POST "$URL" \
  -H "X-Sync-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  --max-time 600)
BODY=$(cat /tmp/.elite-tiktok-sync.out 2>/dev/null || echo "")
rm -f /tmp/.elite-tiktok-sync.out
echo "[$(date -Is)] http=$HTTP_STATUS body=$BODY"
