import type { Server, Socket } from "socket.io";
import { ApiError, errorPayload } from "./errors.js";
import type { Role, Session } from "./sessions.js";
import { SessionStore } from "./sessions.js";

type Ack<T = Record<string, never>> = (result: { ok: true; data: T } | { ok: false; error: ReturnType<typeof errorPayload> }) => void;
const peerStates = new Set(["new", "connecting", "connected", "disconnected", "failed", "closed"]);

function safeAck<T>(ack: unknown, work: () => T): void {
  if (typeof ack !== "function") return;
  try { (ack as Ack<T>)({ ok: true, data: work() }); }
  catch (error) { (ack as Ack<T>)({ ok: false, error: errorPayload(error) }); }
}

function peerId(session: Session, role: Role) {
  return role === "viewer" ? session.sender : session.viewer;
}

function validateDescription(payload: unknown, expected: "offer" | "answer") {
  if (!payload || typeof payload !== "object") throw new ApiError("INVALID_SIGNAL", "Invalid session description.");
  const { type, sdp } = payload as Record<string, unknown>;
  if (type !== expected || typeof sdp !== "string" || sdp.length < 1 || sdp.length > 200_000) {
    throw new ApiError("INVALID_SIGNAL", "Invalid session description.");
  }
  return { type: expected, sdp };
}

function validateCandidate(payload: unknown): RTCIceCandidateInit | null {
  if (payload === null) return null;
  if (!payload || typeof payload !== "object") throw new ApiError("INVALID_SIGNAL", "Invalid ICE candidate.");
  const item = payload as Record<string, unknown>;
  if (typeof item.candidate !== "string" || item.candidate.length > 10_000) {
    throw new ApiError("INVALID_SIGNAL", "Invalid ICE candidate.");
  }
  if (item.sdpMid !== undefined && item.sdpMid !== null && typeof item.sdpMid !== "string") {
    throw new ApiError("INVALID_SIGNAL", "Invalid ICE candidate.");
  }
  if (item.sdpMLineIndex !== undefined && item.sdpMLineIndex !== null && (!Number.isInteger(item.sdpMLineIndex) || Number(item.sdpMLineIndex) < 0)) {
    throw new ApiError("INVALID_SIGNAL", "Invalid ICE candidate.");
  }
  return {
    candidate: item.candidate,
    sdpMid: item.sdpMid as string | null | undefined,
    sdpMLineIndex: item.sdpMLineIndex as number | null | undefined,
    usernameFragment: typeof item.usernameFragment === "string" ? item.usernameFragment : undefined,
  };
}

function rateGuard(socket: Socket) {
  let start = Date.now();
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - start >= 10_000) { start = now; count = 0; }
    count += 1;
    if (count > 150) {
      socket.disconnect(true);
      throw new ApiError("RATE_LIMITED", "Too many signaling messages.", 429);
    }
  };
}

export function attachSignaling(io: Server, store: SessionStore) {
  io.on("connection", (socket) => {
    const guard = rateGuard(socket);

    socket.on("session:join", (payload, ack) => safeAck(ack, () => {
      guard();
      const { session, role } = store.join(socket.id, payload);
      socket.join(session.id);
      if (session.ready && session.viewer && session.sender) io.to(session.id).emit("peer:ready", {});
      return { sessionId: session.id, role, expiresAt: session.expiresAt };
    }));

    socket.on("sender:ready", (_payload, ack) => safeAck(ack, () => {
      guard();
      const { session, role } = store.member(socket.id);
      if (role !== "sender") throw new ApiError("WRONG_ROLE", "Only the sender can mark the camera ready.", 403);
      if (!session.viewer) throw new ApiError("PEER_NOT_READY", "The viewer has not joined yet.", 409);
      session.ready = true;
      io.to(session.id).emit("peer:ready", {});
      return {};
    }));

    socket.on("signal:offer", (payload, ack) => safeAck(ack, () => {
      guard();
      const { session, role } = store.member(socket.id);
      if (role !== "viewer") throw new ApiError("WRONG_ROLE", "Only the viewer can send an offer.", 403);
      if (!session.ready || !session.sender) throw new ApiError("PEER_NOT_READY", "The camera sender is not ready.", 409);
      if (session.offerSent) throw new ApiError("INVALID_STATE", "An offer has already been sent.", 409);
      const offer = validateDescription(payload, "offer");
      session.offerSent = true;
      io.to(session.sender).emit("signal:offer", offer);
      return {};
    }));

    socket.on("signal:answer", (payload, ack) => safeAck(ack, () => {
      guard();
      const { session, role } = store.member(socket.id);
      if (role !== "sender") throw new ApiError("WRONG_ROLE", "Only the sender can send an answer.", 403);
      if (!session.offerSent || !session.viewer) throw new ApiError("INVALID_STATE", "No offer is waiting for an answer.", 409);
      if (session.answerSent) throw new ApiError("INVALID_STATE", "An answer has already been sent.", 409);
      const answer = validateDescription(payload, "answer");
      session.answerSent = true;
      io.to(session.viewer).emit("signal:answer", answer);
      return {};
    }));

    socket.on("signal:ice", (payload, ack) => safeAck(ack, () => {
      guard();
      const { session, role } = store.member(socket.id);
      const target = peerId(session, role);
      if (!target) throw new ApiError("PEER_NOT_READY", "The other peer has not joined.", 409);
      io.to(target).emit("signal:ice", validateCandidate(payload));
      return {};
    }));

    socket.on("peer:state", (payload, ack) => safeAck(ack, () => {
      guard();
      const { session, role } = store.member(socket.id);
      const state = payload && typeof payload === "object" ? (payload as Record<string, unknown>).state : undefined;
      if (typeof state !== "string" || !peerStates.has(state)) throw new ApiError("INVALID_REQUEST", "Invalid peer state.");
      const target = peerId(session, role);
      if (target) io.to(target).emit("peer:state", { state });
      return {};
    }));

    socket.on("session:end", (_payload, ack) => safeAck(ack, () => {
      guard();
      const { session } = store.member(socket.id);
      store.end(session.id, "ended");
      return {};
    }));

    socket.on("disconnect", () => store.disconnect(socket.id));
  });
}
