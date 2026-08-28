#!/bin/sh
set -eu
HUB=/root/atlas-green-pearl-dawn
if [ -f "$HUB/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$HUB/.env"
  set +a
fi
export HUB_HEALTH_URL="${HUB_HEALTH_URL:-http://127.0.0.1:8091/}"
export HUB_RESTART_CMD="${HUB_RESTART_CMD:-systemctl restart r2d2-hub}"
exec /bin/sh "$HUB/scripts/hub-watchdog.sh"
