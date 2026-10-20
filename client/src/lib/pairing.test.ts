import { describe, expect, it } from "vitest";
import { CeovaError } from "./errors";
import { parseCameraLink } from "./pairing";

describe("parseCameraLink", () => {
  it("extracts credentials from a camera link fragment", () => {
    const sessionId = "abcdefghijklmnopqrstuvwx";
    const token = "a".repeat(43);
    expect(parseCameraLink(`https://192.168.1.2:5173/camera#session=${sessionId}&token=${token}`))
      .toEqual({ sessionId, token });
  });

  it("rejects absent or malformed credentials", () => {
    expect(() => parseCameraLink("https://example.test/camera#session=short"))
      .toThrowError(CeovaError);
  });
});
