# Hub backup recovery contract

## Scope

This runbook covers only the Web Hub PGLite database. OpenClaw and Telegram are separate recovery sets.

## Targets

- RPO: 24 hours while the snapshot cron runs nightly.
- RTO: 60 minutes for restoring the latest verified local snapshot.
- Freshness alert: latest successful snapshot older than 26 hours.
- Local retention: seven verified PGLite snapshots and manifests.

Offsite storage and encryption are intentionally deferred until an external recovery-key location is chosen.

## Files

- Snapshots: `/var/backups/r2d2/pglite-<UTC timestamp>.tar.gz`
- Immutable per-snapshot manifest: matching `.json`
- Current status pointer: `/var/backups/r2d2/status.json`
- Backup log: `/var/log/hub-backup.log`
- Freshness log: `/var/log/hub-backup-check.log`

## Verification

Every backup must pass all checks before `status.json` is replaced:

1. authenticated online `PGlite.dumpDataDir("gzip")`;
2. tar contains `PG_VERSION` and `global/pg_control`;
3. snapshot is larger than 1 KiB;
4. SHA-256 is recorded;
5. snapshot opens in a separate in-memory PGlite instance;
6. mandatory Hub tables exist;
7. status checksum verification passes.

Run manually:

```bash
npm run check:backup
node scripts/verify-pglite-snapshot.mjs /var/backups/r2d2/pglite-<timestamp>.tar.gz
```

## Restore drill

Never restore over the live directory. Validate in an isolated process first:

```bash
node scripts/verify-pglite-snapshot.mjs /var/backups/r2d2/pglite-<timestamp>.tar.gz
```

A production restore requires stopping `r2d2-hub`, moving the existing data directory to `/root/_trash/ideal-YYYYMMDD/`, loading the verified snapshot into a new directory, and starting the service only after ownership, probes, and required tables are verified. This is a manual operation and requires explicit approval.
