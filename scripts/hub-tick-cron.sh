#!/bin/sh
# Loopback tick: reminders over Telegram + digest snapshot.
# Secret lives in the hub .env (INTERNAL_CRON_SECRET). Do not put it in git.
set -eu
HUB="${HUB_URL:-http://127.0.0.1:8091}"
ENV_FILE="${HUB_ENV:-/root/atlas-green-pearl-dawn/.env}"
SECRET=""
if [ -f "$ENV_FILE" ]; then
  SECRET=$(grep -E '^INTERNAL_CRON_SECRET=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"')
fi
if [ -n "$SECRET" ]; then
  curl -fsS --max-time 20 -H "X-Cron-Secret: $SECRET" "$HUB/internal/tick" >/dev/null
else
  curl -fsS --max-time 20 "$HUB/internal/tick" >/dev/null
fi
