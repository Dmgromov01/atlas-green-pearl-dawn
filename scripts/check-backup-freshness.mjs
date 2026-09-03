#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function backupFreshness(status, now = Date.now(), maxAgeMs = 26 * 60 * 60_000) {
  if (!status || status.status !== "ok") return { ok: false, error: "backup status is not ok" };
  const completed = Date.parse(status.completedAt);
  if (!Number.isFinite(completed)) return { ok: false, error: "invalid completedAt" };
  const ageMs = Math.max(0, now - completed);
  if (ageMs > maxAgeMs) return { ok: false, error: `backup is stale (${Math.floor(ageMs / 60_000)} min)` };
  if (!status.snapshot || !status.sha256) return { ok: false, error: "snapshot metadata is incomplete" };
  return { ok: true, ageMs };
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function verifyBackupStatus(statusPath, opts = {}) {
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  const fresh = backupFreshness(status, opts.now, opts.maxAgeMs);
  if (!fresh.ok) return fresh;
  const snapshot = resolve(status.snapshot);
  if (!existsSync(snapshot)) return { ok: false, error: "snapshot is missing" };
  const stat = statSync(snapshot);
  if (!stat.isFile() || stat.size < 1024) return { ok: false, error: "snapshot is empty" };
  if (sha256File(snapshot) !== status.sha256) return { ok: false, error: "snapshot checksum mismatch" };
  return { ok: true, ageMs: fresh.ageMs, bytes: stat.size, snapshot };
}

function isMain() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const statusPath = process.argv[2] || process.env.HUB_BACKUP_STATUS || "/var/backups/r2d2/status.json";
  const maxHours = Number(process.env.HUB_BACKUP_MAX_AGE_HOURS || 26);
  try {
    const result = verifyBackupStatus(statusPath, { maxAgeMs: maxHours * 60 * 60_000 });
    if (!result.ok) throw new Error(result.error);
    console.log(`backup fresh: ${result.bytes} bytes, age ${Math.floor(result.ageMs / 60_000)} min`);
  } catch (error) {
    console.error(`[backup-check] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
