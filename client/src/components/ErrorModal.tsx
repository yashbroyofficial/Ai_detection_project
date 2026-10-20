import type { SessionError } from "../lib";
import { AlertTriangleIcon, CloseIcon, RefreshCwIcon } from "./Icons";

interface ErrorModalProps {
  error: SessionError | null;
  onClear: () => void;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorModal({ error, onClear, onRetry, retryLabel = "Try Again" }: ErrorModalProps) {
  if (!error) return null;

  const getHelpText = (code: string) => {
    switch (code) {
      case "CAMERA_DENIED":
        return "Camera permission was blocked. Tap your browser's lock/settings icon in the address bar to allow camera access, then reload.";
      case "INSECURE_CONTEXT":
        return "Browser camera security requires a trusted HTTPS connection or localhost. Please ensure your URL begins with https://.";
      case "PUBLIC_ORIGIN_REQUIRED":
        return "The server requires a public origin configuration. Ensure PUBLIC_ORIGIN is set in the server environment.";
      case "SESSION_UNAVAILABLE":
        return "This session has expired or was ended by the other device. Create a new session to reconnect.";
      case "INVALID_TOKEN":
      case "INVALID_REQUEST":
        return "The camera connection link is incomplete or invalid. Please scan the latest QR code.";
      case "ROLE_TAKEN":
      case "ALREADY_JOINED":
        return "A device has already connected to this session. Only one camera sender is allowed per session.";
      case "CAMERA_NOT_FOUND":
        return "No camera device was detected on your system. Please plug in or enable a camera.";
      case "CAMERA_BUSY":
        return "The camera appears to be in use by another application. Please close other video apps.";
      case "NETWORK_ERROR":
      case "ACK_TIMEOUT":
        return "Network connection to the CEOVA signaling server failed. Check your Wi-Fi or LAN connection.";
      default:
        return "An unexpected error occurred during the camera session.";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-left">
        <button
          onClick={onClear}
          type="button"
          aria-label="Close error notification"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
            <AlertTriangleIcon className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Connection Alert</h3>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40">
                {error.code}
              </span>
            </div>

            <p className="mt-2 text-sm text-zinc-300 leading-relaxed font-normal">
              {error.message}
            </p>

            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              {getHelpText(error.code)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClear}
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
          >
            Dismiss
          </button>

          {onRetry && (
            <button
              onClick={() => {
                onClear();
                onRetry();
              }}
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all active:scale-95 shadow-sm"
            >
              <RefreshCwIcon className="w-3.5 h-3.5" />
              <span>{retryLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
