import { CeovaError } from "./errors";

export function getBackendOrigin() {
  const configured = (import.meta.env.VITE_API_ORIGIN ?? "").trim();
  if (!configured) return "";
  try {
    const url = new URL(configured);
    if (url.pathname !== "/" || url.search || url.hash || !["http:", "https:"].includes(url.protocol)) {
      throw new Error("not an origin");
    }
    if (typeof window !== "undefined" && window.location.protocol === "https:" && url.protocol !== "https:") {
      throw new CeovaError("INSECURE_CONTEXT", "The signaling backend must use HTTPS.");
    }
    return url.origin;
  } catch (error) {
    if (error instanceof CeovaError) throw error;
    throw new CeovaError("INVALID_CONFIGURATION", "VITE_API_ORIGIN must be an HTTP(S) origin without a path.", { cause: error });
  }
}

export function apiUrl(path: `/api/${string}`) {
  return `${getBackendOrigin()}${path}`;
}
