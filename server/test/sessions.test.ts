import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionStore } from "../src/sessions.js";

test("session credentials are role-bound and an ended token cannot be reused", () => {
  const ended: string[] = [];
  const store = new SessionStore((session) => ended.push(session.id), () => 1_000, 10);
  const created = store.create("https://192.168.1.10:5173");
  assert.match(created.sessionId, /^[A-Za-z0-9_-]{24}$/);
  assert.equal(new URL(created.joinUrl).hostname, "192.168.1.10");
  const fragment = new URLSearchParams(new URL(created.joinUrl).hash.slice(1));
  const senderToken = fragment.get("token");
  assert.ok(senderToken);
  assert.throws(() => store.join("bad", { sessionId: created.sessionId, token: senderToken, role: "viewer" }), { code: "INVALID_TOKEN" });
  store.join("viewer", { sessionId: created.sessionId, token: created.viewerToken, role: "viewer" });
  store.join("sender", { sessionId: created.sessionId, token: senderToken, role: "sender" });
  assert.throws(() => store.join("sender-2", { sessionId: created.sessionId, token: senderToken, role: "sender" }), { code: "ROLE_TAKEN" });
  store.end(created.sessionId, "ended");
  assert.deepEqual(ended, [created.sessionId]);
  assert.throws(() => store.join("again", { sessionId: created.sessionId, token: senderToken, role: "sender" }), { code: "SESSION_UNAVAILABLE" });
});

test("unclaimed sessions expire after five minutes", () => {
  let now = 2_000;
  const ended: string[] = [];
  const store = new SessionStore((session, reason) => ended.push(`${session.id}:${reason}`), () => now, 10);
  const created = store.create("https://10.0.0.2:5173");
  now = created.expiresAt;
  assert.throws(() => store.get(created.sessionId), { code: "SESSION_UNAVAILABLE" });
  assert.deepEqual(ended, [`${created.sessionId}:expired`]);
});
