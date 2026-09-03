import assert from "node:assert/strict";
import { test } from "node:test";
import { cronSecretAuthorized } from "./backup-auth.ts";

test("backup auth fails closed without a configured secret", () => {
  assert.equal(cronSecretAuthorized(undefined, null), false);
  assert.equal(cronSecretAuthorized("", ""), false);
});

test("backup auth requires the exact cron secret", () => {
  assert.equal(cronSecretAuthorized("secret-value", "secret-value"), true);
  assert.equal(cronSecretAuthorized("secret-value", "secret-valuE"), false);
  assert.equal(cronSecretAuthorized("secret-value", "short"), false);
});
