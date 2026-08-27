import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDue, splitHubReply } from "./action-parse.ts";

describe("splitHubReply", () => {
  it("strips the HUB fence and reads actions", () => {
    const raw = `Ок, добавил.\n<<<HUB\n{"actions":[{"op":"task","text":"купить молоко","due":"2026-08-27T18:00","repeat":"none"}]}\nHUB>>>`;
    const { text, actions, fenced } = splitHubReply(raw);
    assert.equal(text, "Ок, добавил.");
    assert.equal(fenced, true);
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0], {
      op: "task",
      text: "купить молоко",
      due: "2026-08-27T18:00",
      repeat: "none",
      shared: false,
    });
  });

  it("accepts a json fence with actions", () => {
    const raw = "Готово.\n```json\n{\"actions\":[{\"op\":\"note\",\"text\":\"идея\"}]}\n```";
    const { text, actions } = splitHubReply(raw);
    assert.equal(text, "Готово.");
    assert.equal(actions[0]?.op, "note");
  });

  it("ignores malformed json", () => {
    const { text, actions, fenced } = splitHubReply("привет <<<HUB {nope} HUB>>>");
    assert.equal(text, "привет");
    assert.equal(fenced, true);
    assert.equal(actions.length, 0);
  });
});

describe("parseDue", () => {
  it("parses ISO local datetimes", () => {
    const ts = parseDue("2026-08-27T18:00");
    assert.ok(ts);
    const d = new Date(ts!);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 27);
    assert.equal(d.getHours(), 18);
  });

  it("returns null for empty", () => {
    assert.equal(parseDue(""), null);
    assert.equal(parseDue(null), null);
  });
});
