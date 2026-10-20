import { afterEach, describe, expect, it, vi } from "vitest";
import { CeovaError } from "./errors";
import { apiUrl, getBackendOrigin } from "./endpoint";

afterEach(() => vi.unstubAllEnvs());

describe("production backend endpoint configuration", () => {
  it("uses same-origin URLs when VITE_API_ORIGIN is unset", () => {
    vi.stubEnv("VITE_API_ORIGIN", "");
    expect(getBackendOrigin()).toBe("");
    expect(apiUrl("/api/health")).toBe("/api/health");
  });

  it("targets an explicitly configured backend origin", () => {
    vi.stubEnv("VITE_API_ORIGIN", "https://ceova-api.example");
    expect(getBackendOrigin()).toBe("https://ceova-api.example");
    expect(apiUrl("/api/sessions")).toBe("https://ceova-api.example/api/sessions");
  });

  it("rejects values containing paths", () => {
    vi.stubEnv("VITE_API_ORIGIN", "https://ceova-api.example/path");
    expect(() => getBackendOrigin()).toThrowError(CeovaError);
  });
});
