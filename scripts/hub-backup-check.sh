#!/bin/sh
# Alert when the latest verified Hub backup is stale or corrupt. Never restarts services.
set -eu
HUB="${HUB_ROOT:-/root/atlas-green-pearl-dawn}"
ENV_FILE="${HUB_ENV:-$HUB/.env}"
STATE_DIR="${HUB_BACKUP_MONITOR_STATE:-/var/lib/r2d2/backup-monitor}"
COOLDOWN="${HUB_BACKUP_ALERT_COOLDOWN:-21600}"
mkdir -p "$STATE_DIR"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if node "$HUB/scripts/check-backup-freshness.mjs" "${HUB_BACKUP_STATUS:-/var/backups/r2d2/status.json}"; then
  date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_DIR/last-ok"
  exit 0
fi

now=$(date +%s)
last_file="$STATE_DIR/last-alert"
last=0
[ -f "$last_file" ] && last=$(cat "$last_file" 2>/dev/null || echo 0)
if [ $((now - last)) -lt "$COOLDOWN" ]; then
  exit 1
fi
printf '%s\n' "$now" > "$last_file"
msg="AI Home Hub: резервная копия устарела или повреждена. Нужна проверка backup на сервере."
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_OWNER_ID:-}" ]; then
  curl -sS -o /dev/null --max-time 8 -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H 'content-type: application/json' \
    -d "{\"chat_id\":${TELEGRAM_OWNER_ID},\"text\":$(printf '%s' "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}" \
    || true
fi
echo "$msg" >&2
exit 1
