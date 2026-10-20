import type { SessionError } from "./types";

export class CeovaError extends Error implements SessionError {
  constructor(public code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CeovaError";
  }
}

export function asCeovaError(error: unknown, fallback = "NETWORK_ERROR") {
  if (error instanceof CeovaError) return error;
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return new CeovaError("CAMERA_DENIED", "Camera permission was denied.", { cause: error });
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return new CeovaError("CAMERA_NOT_FOUND", "No suitable camera was found.", { cause: error });
    if (error.name === "NotReadableError" || error.name === "AbortError") return new CeovaError("CAMERA_BUSY", "The camera is unavailable or in use by another app.", { cause: error });
  }
  return new CeovaError(fallback, error instanceof Error ? error.message : "The operation failed.", { cause: error });
}
