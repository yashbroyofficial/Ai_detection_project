import QRCode from "qrcode";
import { CeovaError } from "./errors";
import type { PairingCredentials } from "./types";

const SESSION_ID = /^[A-Za-z0-9_-]{24}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function parseCameraLink(value?: string): PairingCredentials {
  const source = value ?? (typeof window === "undefined" ? "" : window.location.href);
  let url: URL;
  try { url = new URL(source); }
  catch { throw new CeovaError("INVALID_REQUEST", "The camera link is invalid."); }
  const params = new URLSearchParams(url.hash.slice(1));
  const sessionId = params.get("session") ?? "";
  const token = params.get("token") ?? "";
  if (!SESSION_ID.test(sessionId) || !TOKEN.test(token)) throw new CeovaError("INVALID_REQUEST", "The camera link is invalid or incomplete.");
  return { sessionId, token };
}

export function createQrDataUrl(joinUrl: string): Promise<string> {
  let parsed: URL;
  try { parsed = new URL(joinUrl); }
  catch { return Promise.reject(new CeovaError("INVALID_REQUEST", "The camera link is invalid.")); }
  if (parsed.protocol !== "https:") return Promise.reject(new CeovaError("INSECURE_CONTEXT", "Camera links must use HTTPS."));
  return QRCode.toDataURL(parsed.href, { errorCorrectionLevel: "M", margin: 2, width: 320 });
}
