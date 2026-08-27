#!/bin/sh
# Nightly snapshot of hub PGLite and OpenClaw state. No secrets printed.
set -eu
DEST="${HUB_BACKUP_DIR:-/var/backups/r2d2}"
KEEP="${HUB_BACKUP_KEEP:-7}"
STAMP=$(date +%Y%m%d)
mkdir -p "$DEST"

if [ -d /var/lib/r2d2/pglite ]; then
  tar -C /var/lib/r2d2 -czf "$DEST/pglite-$STAMP.tar.gz" pglite
fi
if [ -d /root/.openclaw ]; then
  tar -C /root --exclude='.openclaw/.env' --exclude='.openclaw/credentials' \
    -czf "$DEST/openclaw-state-$STAMP.tar.gz" .openclaw || true
fi
# rotate
ls -1t "$DEST"/pglite-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$DEST"/openclaw-state-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "backup ok $STAMP"
