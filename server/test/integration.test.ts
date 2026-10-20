import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { io as connect, type Socket } from "socket.io-client";
import { createCeovaServer } from "../src/app.js";

function ack<T>(socket: Socket, event: string, payload: unknown): Promise<{ ok: boolean; data?: T; error?: { code: string } }> {
  return socket.timeout(2_000).emitWithAck(event, payload);
}
function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2_000);
    socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });
}

test("HTTP creation and authenticated signaling complete then invalidate the session", async () => {
  const origin = "https://192.168.1.10:5173";
  const instance = createCeovaServer({ publicOrigin: origin, allowedOrigins: [origin], iceServers: [{ urls: "stun:example.test" }], maxSessions: 10, allowMissingSocketOrigin: false });
  await new Promise<void>((resolve) => instance.server.listen(0, "127.0.0.1", resolve));
  const port = (instance.server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const sockets: Socket[] = [];
  try {
    const health = await request(instance.app).get("/api/health").set("Origin", origin)
      .expect("Access-Control-Allow-Origin", origin).expect(200);
    assert.deepEqual(health.body, { status: "ok" });
    const preflight = await request(instance.app).options("/api/sessions").set("Origin", origin)
      .set("Access-Control-Request-Method", "POST").expect(204);
    assert.equal(preflight.headers["access-control-allow-origin"], origin);
    const deniedHttp = await request(instance.app).get("/api/health").set("Origin", "https://evil.example").expect(403);
    assert.equal(deniedHttp.body.error.code, "ORIGIN_NOT_ALLOWED");

    const deniedSocket = connect(base, { forceNew: true, reconnection: false, timeout: 1_000, extraHeaders: { Origin: "https://evil.example" } });
    const deniedError = await once<Error>(deniedSocket, "connect_error");
    assert.ok(deniedError instanceof Error);
    deniedSocket.disconnect();
    const created = await request(instance.app).post("/api/sessions").send({}).expect(201);
    const join = new URL(created.body.joinUrl);
    assert.equal(join.origin, origin);
    const senderToken = new URLSearchParams(join.hash.slice(1)).get("token");
    assert.ok(senderToken);

    const makeSocket = () => {
      const socket = connect(base, {
        forceNew: true,
        reconnection: false,
        transports: ["websocket"],
        extraHeaders: { Origin: origin },
      });
      sockets.push(socket);
      return socket;
    };
    const viewer = makeSocket();
    const sender = makeSocket();
    await Promise.all([once(viewer, "connect"), once(sender, "connect")]);
    const invalidJoin = await ack(sender, "session:join", { sessionId: created.body.sessionId, token: "invalid", role: "sender" });
    assert.equal(invalidJoin.ok, false);
    assert.equal(invalidJoin.error?.code, "INVALID_REQUEST");
    const invalidToken = await ack(sender, "session:join", {
      sessionId: created.body.sessionId,
      token: "A".repeat(43),
      role: "sender",
    });
    assert.equal(invalidToken.ok, false);
    assert.equal(invalidToken.error?.code, "INVALID_TOKEN");
    assert.equal((await ack(viewer, "session:join", { sessionId: created.body.sessionId, token: created.body.viewerToken, role: "viewer" })).ok, true);
    assert.equal((await ack(sender, "session:join", { sessionId: created.body.sessionId, token: senderToken, role: "sender" })).ok, true);

    const readyForViewer = once(viewer, "peer:ready");
    const readyForSender = once(sender, "peer:ready");
    assert.equal((await ack(sender, "sender:ready", {})).ok, true);
    await Promise.all([readyForViewer, readyForSender]);

    const offerReceived = once<{ type: string; sdp: string }>(sender, "signal:offer");
    assert.equal((await ack(viewer, "signal:offer", { type: "offer", sdp: "v=0\r\n" })).ok, true);
    assert.deepEqual(await offerReceived, { type: "offer", sdp: "v=0\r\n" });
    const answerReceived = once<{ type: string; sdp: string }>(viewer, "signal:answer");
    assert.equal((await ack(sender, "signal:answer", { type: "answer", sdp: "v=0\r\n" })).ok, true);
    assert.deepEqual(await answerReceived, { type: "answer", sdp: "v=0\r\n" });

    const ended = once<{ reason: string }>(sender, "session:ended");
    assert.equal((await ack(viewer, "session:end", {})).ok, true);
    assert.deepEqual(await ended, { reason: "ended" });
    await request(instance.app).get(`/api/sessions/${created.body.sessionId}`).expect(404);

    const expiredJoin = await ack(sender, "session:join", {
      sessionId: created.body.sessionId,
      token: senderToken,
      role: "sender",
    });
    assert.equal(expiredJoin.ok, false);
    assert.equal(expiredJoin.error?.code, "SESSION_UNAVAILABLE");

    const fresh = await request(instance.app).post("/api/sessions").send({}).expect(201);
    const freshSenderToken = new URLSearchParams(new URL(fresh.body.joinUrl).hash.slice(1)).get("token");
    assert.ok(freshSenderToken);
    const freshViewer = makeSocket();
    const freshSender = makeSocket();
    await Promise.all([once(freshViewer, "connect"), once(freshSender, "connect")]);
    assert.equal((await ack(freshViewer, "session:join", {
      sessionId: fresh.body.sessionId,
      token: fresh.body.viewerToken,
      role: "viewer",
    })).ok, true);
    assert.equal((await ack(freshSender, "session:join", {
      sessionId: fresh.body.sessionId,
      token: freshSenderToken,
      role: "sender",
    })).ok, true);
    assert.equal((await ack(freshViewer, "session:end", {})).ok, true);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await instance.close();
  }
});

test("session creation is disabled without a reachable HTTPS origin", async () => {
  const instance = createCeovaServer({ allowedOrigins: [], iceServers: [], maxSessions: 10 });
  try {
    const response = await request(instance.app).post("/api/sessions").send({}).expect(503);
    assert.equal(response.body.error.code, "PUBLIC_ORIGIN_REQUIRED");
  } finally { await instance.close(); }
});
