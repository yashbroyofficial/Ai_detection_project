import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";
import { CeovaError } from "./errors";
import { getBackendOrigin } from "./endpoint";

export type CeovaSocket = Socket;
type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function createSocket() {
  const options: Partial<ManagerOptions & SocketOptions> = {
    path: "/socket.io",
    autoConnect: false,
    reconnection: false,
    transports: ["websocket", "polling"],
  };
  const backendOrigin = getBackendOrigin();
  return backendOrigin ? io(backendOrigin, options) : io(options);
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
  const response = await socket.timeout(8_000).emitWithAck(event, payload).catch((error) => {
    throw new CeovaError("ACK_TIMEOUT", `The signaling server did not acknowledge ${event} within 8 seconds.`, { cause: error });
  }) as Ack<T>;
  if (!response?.ok) throw new CeovaError(response?.error?.code ?? "NETWORK_ERROR", response?.error?.message ?? "The signaling request failed.");
  return response.data;
}
