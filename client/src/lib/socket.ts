import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";
import { CeovaError } from "./errors";
import { getBackendOrigin } from "./endpoint";

export type CeovaSocket = Socket;
type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

function signalingDisconnected(event: string, reason?: string) {
  const suffix = reason ? ` (${reason})` : "";
  return new CeovaError(
    "SIGNALING_DISCONNECTED",
    `The signaling connection closed before ${event} was acknowledged${suffix}. Create a fresh session and try again.`,
  );
}

export function createSocket() {
  const options: Partial<ManagerOptions & SocketOptions> = {
    path: "/socket.io",
    autoConnect: false,
    reconnection: false,
    transports: ["websocket", "polling"],
  };
  const backendOrigin = getBackendOrigin();
  const socket = backendOrigin ? io(backendOrigin, options) : io(options);
  socket.on("connect", () => {
    console.info(`[CEOVA signaling] connected transport=${socket.io.engine.transport.name}`);
  });
  socket.on("disconnect", (reason) => {
    if (reason !== "io client disconnect") console.warn(`[CEOVA signaling] disconnected reason=${reason}`);
  });
  socket.on("connect_error", () => {
    console.warn("[CEOVA signaling] connection failed");
  });
  return socket;
}

export async function connectSocket(socket: CeovaSocket) {
  if (socket.connected) return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => done(new CeovaError("NETWORK_ERROR", "Timed out connecting to the signaling server.")), 8_000);
    const done = (error?: Error) => {
      window.clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      error ? reject(error) : resolve();
    };
    const onConnect = () => done();
    const onError = () => done(new CeovaError("NETWORK_ERROR", "Could not connect to the signaling server."));
    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.connect();
  });
}

export async function emitAck<T>(socket: CeovaSocket, event: string, payload: unknown): Promise<T> {
  if (!socket.connected) throw signalingDisconnected(event);
  const response = await new Promise<Ack<T>>((resolve, reject) => {
    let settled = false;
    const finish = (result: Ack<T> | CeovaError, failed = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("disconnect", onDisconnect);
      failed ? reject(result) : resolve(result as Ack<T>);
    };
    const onDisconnect = (reason: string) => finish(signalingDisconnected(event, reason), true);
    const timer = setTimeout(() => {
      finish(new CeovaError(
        "ACK_TIMEOUT",
        `The signaling transport remained connected, but the server did not acknowledge ${event} within 8 seconds.`,
      ), true);
    }, 8_000);
    socket.once("disconnect", onDisconnect);
    socket.emit(event, payload, (result: Ack<T>) => finish(result));
  });
  if (!response?.ok) throw new CeovaError(response?.error?.code ?? "NETWORK_ERROR", response?.error?.message ?? "The signaling request failed.");
  return response.data;
}
