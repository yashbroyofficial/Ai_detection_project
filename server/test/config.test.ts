import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAllowedOrigins } from "../src/config.js";

test("development signaling permits loopback and the public LAN origin", () => {
  assert.deepEqual(
    resolveAllowedOrigins("https://10.12.45.234:5173", undefined, false),
    [
      "https://10.12.45.234:5173",
      "https://localhost:5173",
      "https://127.0.0.1:5173",
    ],
  );
});

test("production signaling remains restricted to configured origins", () => {
  assert.deepEqual(
    resolveAllowedOrigins("https://ceova.example", "https://admin.example", true),
    ["https://ceova.example", "https://admin.example"],
  );
});
