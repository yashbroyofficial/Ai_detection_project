import { createServer } from "node:http";
import express, { type Request } from "express";
import { Server } from "socket.io";
import { ApiError, errorPayload } from "./errors.js";
import { SessionStore, SESSION_ID } from "./sessions.js";
import { attachSignaling } from "./signaling.js";

export type AppConfig = {
  publicOrigin?: string;
  allowedOrigins: string[];
  iceServers: RTCIceServer[];
  maxSessions: number;
  trustProxy?: boolean;
  allowMissingSocketOrigin?: boolean;
};

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]) {
  return !origin || allowedOrigins.includes(origin);
}

export function createCeovaServer(config: AppConfig) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use(express.json({ limit: "4kb", strict: true }));
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(origin, config.allowedOrigins)) {
      return res.status(403).json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "This frontend origin is not allowed." } });
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.vary("Origin");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  const server = createServer(app);
  const io = new Server(server, {
    path: "/socket.io",
    serveClient: false,
    maxHttpBufferSize: 256_000,
    cors: { origin: config.allowedOrigins, methods: ["GET", "POST"] },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      const allowed = origin
        ? isOriginAllowed(origin, config.allowedOrigins)
        : config.allowMissingSocketOrigin !== false;
      callback(null, allowed);
    },
  });
  const store = new SessionStore((session, reason) => {
    io.to(session.id).emit("session:ended", { reason });
    for (const socketId of [session.viewer, session.sender]) {
      if (socketId) io.sockets.sockets.get(socketId)?.leave(session.id);
    }
  }, Date.now, config.maxSessions);
  attachSignaling(io, store);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/config", (_req, res) => res.json({ iceServers: config.iceServers }));
  app.post("/api/sessions", creationRateLimit(), (req, res, next) => {
    try {
      if (!config.publicOrigin) throw new ApiError("PUBLIC_ORIGIN_REQUIRED", "Configure a reachable HTTPS PUBLIC_ORIGIN before creating sessions.", 503);
      if (Object.keys(req.body ?? {}).length !== 0) throw new ApiError("INVALID_REQUEST", "Session creation does not accept a request body.");
      res.status(201).json(store.create(config.publicOrigin));
    } catch (error) { next(error); }
  });
  app.get("/api/sessions/:id", (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id || !SESSION_ID.test(id)) throw new ApiError("SESSION_UNAVAILABLE", "Session expired or unavailable.", 404);
      const session = store.get(id);
      const status = session.ready ? "active" : session.viewer && session.sender ? "paired" : "waiting";
      res.json({ sessionId: session.id, status, expiresAt: session.expiresAt });
    } catch (error) { next(error); }
  });
  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const apiError = error instanceof ApiError ? error : new ApiError("INVALID_REQUEST", "Invalid request.");
    res.status(apiError.status).json({ error: errorPayload(apiError) });
  });

  const sweepTimer = setInterval(() => store.sweep(), 15_000);
  sweepTimer.unref();
  return {
    app, server, io, store,
    close: async () => {
      clearInterval(sweepTimer);
      store.close();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

function creationRateLimit() {
  const buckets = new Map<string, { start: number; count: number }>();
  return (req: Request, _res: express.Response, next: express.NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= 60_000) { bucket = { start: now, count: 0 }; buckets.set(key, bucket); }
    bucket.count += 1;
    if (bucket.count > 30) return next(new ApiError("RATE_LIMITED", "Too many session requests.", 429));
    next();
  };
}
