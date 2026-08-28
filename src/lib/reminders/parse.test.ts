import assert from "node:assert/strict";
import test from "node:test";
import { nextDue, parseReminder } from "./parse.ts";

const now = new Date("2026-08-28T10:00:00+03:00");

test("через 2 часа", () => {
  const p = parseReminder("позвонить маме через 2 часа", now);
  assert.ok(p);
  assert.equal(p.text.includes("позвонить маме"), true);
  assert.equal(p.dueAt.getTime(), new Date("2026-08-28T12:00:00+03:00").getTime());
  assert.equal(p.recurrence, "none");
});

test("завтра в 9", () => {
  const p = parseReminder("завтра в 9 забрать посылку", now);
  assert.ok(p);
  assert.equal(p.dueAt.getHours(), 9);
  assert.equal(p.dueAt.getDate(), 29);
  assert.match(p.text, /посылк/);
});

test("каждый день в 8", () => {
  const p = parseReminder("каждый день в 8 таблетки", now);
  assert.ok(p);
  assert.equal(p.recurrence, "daily");
  assert.equal(p.dueAt.getHours(), 8);
  assert.ok(p.dueAt.getTime() > now.getTime());
});

test("nextDue weekdays skips weekend", () => {
  const friday = new Date("2026-08-28T18:00:00+03:00");
  const next = nextDue(friday, "weekdays");
  assert.equal(next.getDay(), 1);
});
