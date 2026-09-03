import { randomBytes } from "node:crypto";

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const SCRIPT = new URL("./hub-backup.sh", import.meta.url).pathname;
const CHECK = new URL("./check-backup-freshness.mjs", import.meta.url).pathname;

function fixture(valid = true) {
  const root = mkdtempSync(join(tmpdir(), "hub-backup-"));
  const source = join(root, "source");
  const bin = join(root, "bin");
  const dest = join(root, "dest");
  mkdirSync(join(source, "global"), { recursive: true });
  mkdirSync(bin);
  mkdirSync(dest);
  writeFileSync(join(source, "PG_VERSION"), "17\n");
  if (valid) writeFileSync(join(source, "global/pg_control"), randomBytes(4096));
  const archive = join(root, "fixture.tar.gz");
  assert.equal(spawnSync("tar", ["-czf", archive, "-C", source, "."]).status, 0);
  const curl = join(bin, "curl");
  writeFileSync(curl, `#!/bin/sh\nout=""\nwhile [ "$#" -gt 0 ]; do [ "$1" = "-o" ] && { out="$2"; shift 2; continue; }; shift; done\ncp "${archive}" "$out"\n`);
  chmodSync(curl, 0o755);
  const envFile = join(root, ".env");
  writeFileSync(envFile, "INTERNAL_CRON_SECRET=test-only\n");
  const restore = join(root, "restore.mjs");
  writeFileSync(restore, 'console.log("snapshot restore ok: test fixture");\n');
  return { root, bin, dest, envFile, restore };
}

function run(f) {
  return spawnSync("/bin/sh", [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${f.bin}:${process.env.PATH}`,
      HUB_BACKUP_DIR: f.dest,
      HUB_ENV: f.envFile,
      OPENCLAW_STATE_DIR: join(f.root, "absent"),
      HUB_BACKUP_CHECK_SCRIPT: CHECK,
      HUB_BACKUP_RESTORE_SCRIPT: f.restore,
    },
  });
}

test("backup publishes snapshot, manifest and verified status atomically", () => {
  const f = fixture();
  const result = run(f);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const status = JSON.parse(readFileSync(join(f.dest, "status.json"), "utf8"));
  assert.equal(status.status, "ok");
  assert.equal(status.format, "pglite-dump-v1");
  assert.ok(status.bytes >= 1024);
  assert.match(status.sha256, /^[a-f0-9]{64}$/);
  assert.match(result.stdout, /backup fresh:/);
});

test("backup refuses an archive without pg_control and publishes no status", () => {
  const f = fixture(false);
  const result = run(f);
  assert.notEqual(result.status, 0);
  assert.throws(() => readFileSync(join(f.dest, "status.json")));
});
