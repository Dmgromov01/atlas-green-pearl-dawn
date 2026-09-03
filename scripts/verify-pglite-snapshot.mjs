#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const REQUIRED_TABLES = ["_migrations", "hub_users", "hub_sessions", "hub_audit"];

export async function verifyPgliteSnapshot(path) {
  const bytes = readFileSync(resolve(path));
  if (bytes.byteLength < 1024) throw new Error("snapshot is empty");
  const pg = await PGlite.create({ loadDataDir: new Blob([bytes]) });
  try {
    const result = await pg.query("select tablename from pg_tables where schemaname = 'public'");
    const tables = new Set(result.rows.map((row) => String(row.tablename)));
    const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
    if (missing.length) throw new Error(`required tables missing: ${missing.join(", ")}`);
    await pg.query("select 1 as ok");
    return { ok: true, bytes: bytes.byteLength, tableCount: tables.size };
  } finally {
    await pg.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: node scripts/verify-pglite-snapshot.mjs SNAPSHOT");
    process.exit(2);
  }
  try {
    const result = await verifyPgliteSnapshot(path);
    console.log(`snapshot restore ok: ${result.tableCount} tables, ${result.bytes} bytes`);
  } catch (error) {
    console.error(`[snapshot-restore] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
