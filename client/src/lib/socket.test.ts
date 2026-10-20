import { afterEach, describe, expect, it, vi } from "vitest";
import { CeovaError } from "./errors";
import { emitAck, type CeovaSocket } from "./socket";

type Listener = (...args: unknown[]) => void;

afterEach(() => vi.useRealTimers());

function fakeSocket(handler?: (event: string, ack: (value: unknown) => void) => void) {
  const listeners = new Map<string, Set<Listener>>();
  const socket = {
    connected: true,
    once(event: string, listener: Listener) {
      const wrapped: Listener = (...args) => {
        this.off(event, wrapped);
        listener(...args);
      };
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(wrapped);
      listeners.set(event, set);
      return this;
    },
    off(event: string, listener: Listener) {
      listeners.get(event)?.delete(listener);
      return this;
    },
    emit(event: string, _payload: unknown, ack: (value: unknown) => void) {
      handler?.(event, ack);
      return this;
    },
    disconnectNow(reason: string) {
      this.connected = false;
      for (const listener of [...(listeners.get("disconnect") ?? [])]) listener(reason);
    },
  };
  return socket as unknown as CeovaSocket & { disconnectNow(reason: string): void };
}

describe("emitAck", () => {
  it("returns acknowledged data and preserves acknowledged server errors", async () => {
    const accepted = fakeSocket((_event, ack) => ack({ ok: true, data: { role: "sender" } }));
    await expect(emitAck(accepted, "session:join", {})).resolves.toEqual({ role: "sender" });

    const rejected = fakeSocket((_event, ack) => ack({
      ok: false,
      error: { code: "SESSION_UNAVAILABLE", message: "Session expired or unavailable." },
    }));
    await expect(emitAck(rejected, "session:join", {})).rejects.toMatchObject({
      code: "SESSION_UNAVAILABLE",
    });
  });

  it("distinguishes a disconnected transport from a missing acknowledgement", async () => {
    const disconnected = fakeSocket();
    const pending = emitAck(disconnected, "session:join", {});
    disconnected.disconnectNow("transport close");
    await expect(pending).rejects.toMatchObject({ code: "SIGNALING_DISCONNECTED" });

    vi.useFakeTimers();
    const connected = fakeSocket();
    const timedOut = emitAck(connected, "session:join", {});
    const timeoutExpectation = expect(timedOut).rejects.toMatchObject({ code: "ACK_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(8_000);
    await timeoutExpectation;
  });

  it("fails immediately when the socket is already disconnected", async () => {
    const socket = fakeSocket();
    socket.connected = false;
    await expect(emitAck(socket, "session:join", {})).rejects.toBeInstanceOf(CeovaError);
    await expect(emitAck(socket, "session:join", {})).rejects.toMatchObject({
      code: "SIGNALING_DISCONNECTED",
    });
  });
});
