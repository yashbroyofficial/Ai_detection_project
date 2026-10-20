import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePublicOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    if (url.protocol !== "https:" || loopback || url.pathname !== "/") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

const publicOrigin = parsePublicOrigin(process.env.PUBLIC_ORIGIN);
const production = process.env.NODE_ENV === "production";
export function resolveAllowedOrigins(
  origin: string | undefined,
  extraOrigins: string | undefined,
  production: boolean,
) {
  const extras = (extraOrigins ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const developmentOrigins = production ? [] : ["https://localhost:5173", "https://127.0.0.1:5173"];
  return [...new Set([origin, ...extras, ...developmentOrigins].filter((item): item is string => Boolean(item)))];
}

const allowedOrigins = resolveAllowedOrigins(
  publicOrigin,
  process.env.ALLOWED_ORIGINS,
  production,
);
const stunUrls = (process.env.STUN_URLS ?? "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
  .split(",").map((item) => item.trim()).filter((item) => item.startsWith("stun:"));

export const runtimeConfig = {
  host: process.env.HOST ?? (production ? "0.0.0.0" : "127.0.0.1"),
  port: parseNumber(process.env.PORT, 3001),
  publicOrigin,
  allowedOrigins,
  trustProxy: production,
  allowMissingSocketOrigin: !production,
  maxSessions: parseNumber(process.env.MAX_SESSIONS, 500),
  iceServers: [{ urls: stunUrls }],
};
