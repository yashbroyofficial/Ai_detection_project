import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors.js";

export type Role = "viewer" | "sender";
export type EndReason = "ended" | "peer-disconnected" | "expired" | "server-shutdown";
export type Session = {
  id: string;
  createdAt: number;
  expiresAt: number;
  viewerHash: Buffer;
  senderHash: Buffer;
  viewer?: string;
  sender?: string;
  ready: boolean;
  offerSent: boolean;
  answerSent: boolean;
};
export const PAIRING_TTL = 5 * 60_000;
export const MAX_LIFETIME = 2 * 60 * 60_000;
export const SESSION_ID = /^[A-Za-z0-9_-]{24}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const hash = (token: string) => createHash("sha256").update(token).digest();

export class SessionStore {
  readonly sessions = new Map<string, Session>();
  readonly memberships = new Map<string, { sessionId: string; role: Role }>();

  constructor(
    private readonly onEnd: (session: Session, reason: EndReason) => void,
    private readonly now = Date.now,
    private readonly maxSessions = 500,
  ) {}

  create(publicOrigin: string) {
    this.sweep();
    if (this.sessions.size >= this.maxSessions) {
      throw new ApiError("SERVER_BUSY", "Too many sessions. Try again shortly.", 503);
    }
    let id: string;
    do { id = randomBytes(18).toString("base64url"); } while (this.sessions.has(id));
    const viewerToken = randomBytes(32).toString("base64url");
    const senderToken = randomBytes(32).toString("base64url");
    const createdAt = this.now();
    const session: Session = {
      id, createdAt, expiresAt: createdAt + PAIRING_TTL,
      viewerHash: hash(viewerToken), senderHash: hash(senderToken),
      ready: false, offerSent: false, answerSent: false,
    };
    this.sessions.set(id, session);
    const link = new URL("/camera", publicOrigin);
    link.hash = new URLSearchParams({ session: id, token: senderToken }).toString();
    return { sessionId: id, viewerToken, joinUrl: link.href, expiresAt: session.expiresAt };
  }

  get(id: string) {
    const session = this.sessions.get(id);
    if (!session) throw new ApiError("SESSION_UNAVAILABLE", "Session expired or unavailable.", 404);
    const deadline = session.ready
      ? session.createdAt + MAX_LIFETIME
      : session.expiresAt;
    if (this.now() >= deadline) {
      this.end(id, "expired");
      throw new ApiError("SESSION_UNAVAILABLE", "Session expired or unavailable.", 404);
    }
    return session;
  }

  join(socketId: string, input: unknown) {
    if (!input || typeof input !== "object") {
      throw new ApiError("INVALID_REQUEST", "Invalid pairing credentials.");
    }
    const { sessionId, token, role } = input as Record<string, unknown>;
    if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)
      || typeof token !== "string" || !TOKEN.test(token)
      || (role !== "viewer" && role !== "sender")) {
      throw new ApiError("INVALID_REQUEST", "Invalid pairing credentials.");
    }
    if (this.memberships.has(socketId)) throw new ApiError("ALREADY_JOINED", "Socket already joined a session.");
    const session = this.get(sessionId);
    const expected = role === "viewer" ? session.viewerHash : session.senderHash;
    if (!timingSafeEqual(hash(token), expected)) throw new ApiError("INVALID_TOKEN", "Invalid pairing credentials.", 403);
    if (session[role]) throw new ApiError("ROLE_TAKEN", "This session role has already been claimed.", 409);
    session[role] = socketId;
    this.memberships.set(socketId, { sessionId, role });
    return { session, role };
  }

  member(socketId: string) {
    const membership = this.memberships.get(socketId);
    if (!membership) throw new ApiError("NOT_JOINED", "Join a session first.", 403);
    return { session: this.get(membership.sessionId), role: membership.role };
  }

  end(id: string, reason: EndReason) {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    if (session.viewer) this.memberships.delete(session.viewer);
    if (session.sender) this.memberships.delete(session.sender);
    this.onEnd(session, reason);
  }

  disconnect(socketId: string) {
    const member = this.memberships.get(socketId);
    if (member) this.end(member.sessionId, "peer-disconnected");
  }

  sweep() {
    for (const session of this.sessions.values()) {
      if (this.now() >= (session.ready ? session.createdAt + MAX_LIFETIME : session.expiresAt)) {
        this.end(session.id, "expired");
      }
    }
  }

  close() {
    for (const id of this.sessions.keys()) this.end(id, "server-shutdown");
  }
}
