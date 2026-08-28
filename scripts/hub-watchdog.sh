#!/bin/sh
# Health loop for the hub. Does not rebuild. Does not print secrets.
# Env: HUB_HEALTH_URL (default http://127.0.0.1:8091/)
#      HUB_RESTART_CMD (default: systemctl restart r2d2-hub)
#      TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_ID for crash alerts
#      WATCHDOG_STATE_DIR (default /tmp/hub-watchdog)

set -eu

HEALTH_URL="${HUB_HEALTH_URL:-http://127.0.0.1:8091/}"
STATE_DIR="${WATCHDOG_STATE_DIR:-/tmp/hub-watchdog}"
STORM_SEC="${WATCHDOG_STORM_SEC:-600}"
RESTART_CMD="${HUB_RESTART_CMD:-systemctl restart r2d2-hub}"
mkdir -p "$STATE_DIR"

diag() {
  {
    echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "url: $HEALTH_URL"
    echo "---- memory ----"
    free -h 2>/dev/null || true
    echo "---- disk ----"
    df -h / /var/lib/r2d2 2>/dev/null || df -h /
    echo "---- unit ----"
    systemctl is-active r2d2-hub 2>/dev/null || true
    echo "---- last log ----"
    journalctl -u r2d2-hub -n 25 --no-pager 2>/dev/null | tail -n 25
  } 2>/dev/null | python3 -c '
import sys
text = sys.stdin.read()[:2800]
print(text)
' || true
}

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

SNAP=$(diag)
alert "AI Personal Hub не отвечает (${HEALTH_URL}). Диагностика:
${SNAP}"

sh -c "$RESTART_CMD" || true
sleep 8
if curl -fsS --max-time 8 "$HEALTH_URL" >/dev/null; then
  alert "AI Personal Hub перезапущен и снова отвечает."
  echo "ok" > "$STATE_DIR/last-ok"
  exit 0
fi

SNAP2=$(diag)
alert "AI Personal Hub не поднялся после перезапуска. Нужна ручная проверка.
${SNAP2}"
exit 1
