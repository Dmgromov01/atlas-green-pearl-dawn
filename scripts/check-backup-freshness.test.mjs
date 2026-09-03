import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { backupFreshness, sha256File, verifyBackupStatus } from "./check-backup-freshness.mjs";

test("fresh successful backup passes", () => {
  assert.deepEqual(
    backupFreshness({ status: "ok", completedAt: "2026-09-03T10:00:00Z", snapshot: "/x", sha256: "abc" }, Date.parse("2026-09-03T11:00:00Z"), 2 * 60 * 60_000),
    { ok: true, ageMs: 60 * 60_000 },
  );
});

test("stale and failed status are rejected", () => {
  assert.equal(backupFreshness({ status: "failed" }).ok, false);
  assert.match(
    backupFreshness({ status: "ok", completedAt: "2026-09-01T00:00:00Z", snapshot: "/x", sha256: "abc" }, Date.parse("2026-09-03T00:00:00Z"), 26 * 60 * 60_000).error,
    /stale/,
  );
});

test("status verification checks file size and checksum", () => {
  const dir = mkdtempSync(join(tmpdir(), "hub-backup-check-"));
  const snapshot = join(dir, "snapshot.tar.gz");
  writeFileSync(snapshot, Buffer.alloc(2048, 7));
  const statusPath = join(dir, "status.json");
  writeFileSync(statusPath, JSON.stringify({ status: "ok", completedAt: "2026-09-03T10:00:00Z", snapshot, sha256: sha256File(snapshot) }));
  assert.equal(verifyBackupStatus(statusPath, { now: Date.parse("2026-09-03T11:00:00Z") }).ok, true);
  writeFileSync(snapshot, Buffer.alloc(2048, 8));
  assert.match(verifyBackupStatus(statusPath, { now: Date.parse("2026-09-03T11:00:00Z") }).error, /checksum/);
});
