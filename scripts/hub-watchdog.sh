#!/bin/sh
# Lightweight health loop for the hub on a mini-PC.
# Does not rebuild. Does not print secrets.
# Env: HUB_HEALTH_URL (default http://127.0.0.1:8080/)
#      HUB_RESTART_CMD (optional, e.g. systemctl restart hub)
#      TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_ID for crash alerts
#      WATCHDOG_STATE_DIR (default /tmp/hub-watchdog)

set -eu

HEALTH_URL="${HUB_HEALTH_URL:-http://127.0.0.1:8080/}"
STATE_DIR="${WATCHDOG_STATE_DIR:-/tmp/hub-watchdog}"
STORM_SEC="${WATCHDOG_STORM_SEC:-600}"
mkdir -p "$STATE_DIR"

alert() {
  msg="$1"
  last="$STATE_DIR/last-alert"
  now=$(date +%s)
  if [ -f "$last" ]; then
    prev=$(cat "$last" 2>/dev/null || echo 0)
    if [ $((now - prev)) -lt "$STORM_SEC" ]; then
      return 0
    fi
  fi
  echo "$now" > "$last"
  token="${TELEGRAM_BOT_TOKEN:-}"
  chat="${TELEGRAM_OWNER_ID:-}"
  if [ -n "$token" ] && [ -n "$chat" ]; then
    curl -sS -o /dev/null --max-time 8 -X POST \
      "https://api.telegram.org/bot${token}/sendMessage" \
      -H 'content-type: application/json' \
      -d "{\"chat_id\":${chat},\"text\":$(printf '%s' "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\"disable_web_page_preview\":true}" \
      || true
  fi
  echo "$msg"
}

if curl -fsS --max-time 8 "$HEALTH_URL" >/dev/null; then
  echo "ok" > "$STATE_DIR/last-ok"
  exit 0
fi

alert "AI Personal Hub не отвечает (${HEALTH_URL}). Пробую перезапуск."

if [ -n "${HUB_RESTART_CMD:-}" ]; then
  sh -c "$HUB_RESTART_CMD" || true
  sleep 5
  if curl -fsS --max-time 8 "$HEALTH_URL" >/dev/null; then
    alert "AI Personal Hub перезапущен и снова отвечает."
    echo "ok" > "$STATE_DIR/last-ok"
    exit 0
  fi
fi

alert "AI Personal Hub не поднялся после перезапуска. Нужна ручная проверка."
exit 1
