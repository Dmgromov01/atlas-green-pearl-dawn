#!/bin/sh
# Consistent PGLite snapshot plus a separate best-effort OpenClaw state archive.
# Secrets are read from the hub env and never printed.
set -eu

DEST="${HUB_BACKUP_DIR:-/var/backups/r2d2}"
KEEP="${HUB_BACKUP_KEEP:-7}"
HUB="${HUB_URL:-http://127.0.0.1:8091}"
ENV_FILE="${HUB_ENV:-/root/atlas-green-pearl-dawn/.env}"
OPENCLAW_DIR="${OPENCLAW_STATE_DIR:-/root/.openclaw}"
CHECK_SCRIPT="${HUB_BACKUP_CHECK_SCRIPT:-/root/atlas-green-pearl-dawn/scripts/check-backup-freshness.mjs}"
RESTORE_SCRIPT="${HUB_BACKUP_RESTORE_SCRIPT:-/root/atlas-green-pearl-dawn/scripts/verify-pglite-snapshot.mjs}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOCK="$DEST/.backup-lock"
TMP="$DEST/.pglite-$STAMP.tar.gz.tmp"
SNAPSHOT="$DEST/pglite-$STAMP.tar.gz"
MANIFEST="$DEST/pglite-$STAMP.json"
STATUS="$DEST/status.json"

mkdir -p "$DEST"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "[backup] another backup is running" >&2
  exit 1
fi
cleanup() {
  rm -f "$TMP" "$MANIFEST.tmp" "$STATUS.tmp"
  rmdir "$LOCK" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

SECRET=""
if [ -f "$ENV_FILE" ]; then
  SECRET=$(grep -E '^INTERNAL_CRON_SECRET=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"')
fi
if [ -z "$SECRET" ]; then
  echo "[backup] INTERNAL_CRON_SECRET is missing" >&2
  exit 1
fi

curl -fsS --max-time 180 -H "X-Cron-Secret: $SECRET" \
  "$HUB/internal/backup/pglite" -o "$TMP"
tar -tzf "$TMP" | grep -Eq '(^|/)PG_VERSION$'
tar -tzf "$TMP" | grep -Eq '(^|/)global/pg_control$'
BYTES=$(wc -c < "$TMP" | tr -d ' ')
if [ "$BYTES" -lt 1024 ]; then
  echo "[backup] snapshot is unexpectedly small" >&2
  exit 1
fi
SHA256=$(sha256sum "$TMP" | awk '{print $1}')
node "$RESTORE_SCRIPT" "$TMP"
mv "$TMP" "$SNAPSHOT"

node -e '
const fs = require("node:fs");
const out = {
  format: "pglite-dump-v1",
  status: "ok",
  completedAt: process.argv[1],
  snapshot: process.argv[2],
  bytes: Number(process.argv[3]),
  sha256: process.argv[4],
};
fs.writeFileSync(process.argv[5], JSON.stringify(out, null, 2) + "\n", { mode: 0o600 });
' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SNAPSHOT" "$BYTES" "$SHA256" "$MANIFEST.tmp"
mv "$MANIFEST.tmp" "$MANIFEST"
cp "$MANIFEST" "$STATUS.tmp"
mv "$STATUS.tmp" "$STATUS"
chmod 600 "$SNAPSHOT" "$MANIFEST" "$STATUS"

# OpenClaw is a separate recovery set. Never include credentials or env files.
if [ -d "$OPENCLAW_DIR" ]; then
  tar -C "$(dirname "$OPENCLAW_DIR")" \
    --exclude="$(basename "$OPENCLAW_DIR")/.env" \
    --exclude="$(basename "$OPENCLAW_DIR")/credentials" \
    --exclude="$(basename "$OPENCLAW_DIR")/media" \
    -czf "$DEST/openclaw-state-$STAMP.tar.gz" "$(basename "$OPENCLAW_DIR")" \
    || echo "[backup] OpenClaw state archive failed; PGLite snapshot is safe" >&2
fi

ls -1t "$DEST"/pglite-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$DEST"/pglite-*.json 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$DEST"/openclaw-state-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

node "$CHECK_SCRIPT" "$STATUS"
echo "backup ok $STAMP ($BYTES bytes)"
