import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus, SessionError, SessionInfo } from "../lib";
import {
  CameraIcon,
  CheckIcon,
  CloseIcon,
  FlipIcon,
  RadioIcon,
  ShieldIcon,
  SmartphoneIcon,
  VideoIcon,
} from "../components/Icons";
import { ConnectionBadge } from "../components/ConnectionBadge";

// Helper for live radio icon
function PulsingRadioIcon() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
  );
}

interface SenderCameraPageProps {
  status: ConnectionStatus;
  session: SessionInfo | null;
  localStream: MediaStream | null;
  mediaReceived?: boolean;
  peerState: RTCPeerConnectionState | null;
  error: SessionError | null;
  endReason: string | null;
  onStartCamera: (constraints?: MediaTrackConstraints) => Promise<void>;
  onEndSession: () => Promise<void>;
}

export function SenderCameraPage({
  status,
  session,
  localStream,
  mediaReceived,
  peerState,
  endReason,
  onStartCamera,
  onEndSession,
}: SenderCameraPageProps) {
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [streamDuration, setStreamDuration] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Attach localStream to preview video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (localStream) {
      video.srcObject = localStream;
      video.play().catch(() => undefined);
    } else {
      video.srcObject = null;
    }
  }, [localStream]);

  // Duration timer when streaming
  useEffect(() => {
    if (!localStream) {
      setStreamDuration(0);
      return;
    }
    const timer = setInterval(() => setStreamDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [localStream]);

  const handleStartCamera = async () => {
    setIsStarting(true);
    try {
      await onStartCamera({
        facingMode: { ideal: facingMode },
      });
    } catch {
      // Error handled in hook snapshot
    } finally {
      setIsStarting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isStreaming = Boolean(localStream);
  const isLiveConfirmed = status === "connected" && Boolean(mediaReceived);
  const isRequesting = status === "requesting-camera" || isStarting;
  const isEnded = status === "ended";

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col justify-between">
      {/* Top Mobile Bar */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center">
            <CameraIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">CEOVA Camera</span>
        </div>

        <ConnectionBadge status={status} peerState={peerState} />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {isStreaming ? (
          /* ACTIVE STREAMING VIEW */
          <div className="w-full max-w-md flex flex-col gap-4">
            {/* Live Indicator Banner */}
            {isLiveConfirmed ? (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 backdrop-blur-md shadow-lg shadow-emerald-950/20">
                <div className="flex items-center gap-2.5">
                  <PulsingRadioIcon />
                  <span className="text-xs font-semibold text-emerald-300 tracking-wide uppercase">
                    Streaming Live to Laptop
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-300">
                  {formatDuration(streamDuration)}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-zinc-900/90 border border-amber-500/30 backdrop-blur-md shadow-lg shadow-amber-950/20">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                  <span className="text-xs font-semibold text-amber-300 tracking-wide uppercase">
                    Connecting to Laptop...
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  {formatDuration(streamDuration)}
                </span>
              </div>
            )}

            {/* Camera Preview Frame */}
            <div className="relative w-full aspect-[3/4] sm:aspect-[9/16] rounded-3xl overflow-hidden bg-zinc-950 border border-white/15 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === "user" ? "-scale-x-100" : ""
                }`}
              />

              {/* Watermark / status in frame */}
              <div className="absolute top-4 left-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] text-zinc-300 border border-white/10">
                <ShieldIcon className="w-3 h-3 text-emerald-400" />
                <span>Encrypted P2P</span>
              </div>

              {facingMode === "environment" && (
                <div className="absolute top-4 right-4 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] uppercase font-mono text-zinc-300 border border-white/10">
                  Rear Lens
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onEndSession}
                className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all shadow-lg shadow-rose-950/40 active:scale-98 flex items-center justify-center gap-2"
              >
                <CloseIcon className="w-4 h-4" />
                <span>End Camera Stream</span>
              </button>

              <p className="text-center text-[11px] text-zinc-400">
                Ending the session immediately closes the camera and releases device hardware.
              </p>
            </div>
          </div>
        ) : isEnded ? (
          /* SESSION ENDED VIEW */
          <div className="w-full max-w-sm p-6 rounded-3xl bg-zinc-900 border border-white/10 text-center flex flex-col items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400">
              <CheckIcon className="w-6 h-6 text-emerald-400" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Camera Disconnected</h2>
              <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
                {endReason === "ended"
                  ? "You or the viewer ended the camera session."
                  : endReason === "peer-disconnected"
                  ? "The laptop disconnected from the session."
                  : "The session has concluded. Your camera is turned off."}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950 text-xs text-zinc-400 border border-zinc-800 text-left w-full flex items-center gap-2.5">
              <ShieldIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Camera hardware has been fully released.</span>
            </div>

            <a
              href="/"
              className="mt-2 text-xs text-zinc-300 underline underline-offset-4 hover:text-white"
            >
              Return to CEOVA Home
            </a>
          </div>
        ) : (
          /* PERMISSION & START REQUEST SCREEN */
          <div className="w-full max-w-sm p-6 sm:p-8 rounded-3xl bg-zinc-900/90 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col gap-6 text-center">
            {/* Header Icon */}
            <div className="relative mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-950 p-[1px] shadow-lg">
                <div className="w-full h-full bg-zinc-900 rounded-[23px] flex items-center justify-center text-sky-400">
                  <CameraIcon className="w-8 h-8" />
                </div>
              </div>
            </div>

            {/* Title & Privacy Assurance */}
            <div className="flex flex-col gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Connect Phone Camera
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Paired with laptop. Tap below to grant browser camera access and start streaming.
              </p>
            </div>

            {/* Privacy details list */}
            <div className="flex flex-col gap-2.5 text-left bg-zinc-950/60 p-4 rounded-2xl border border-white/5">
              <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                <ShieldIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Camera streams directly P2P via encrypted WebRTC.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>No audio or video is ever recorded or uploaded.</span>
              </div>
            </div>

            {/* Lens Selector */}
            <div className="flex items-center justify-center gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
              <button
                type="button"
                onClick={() => setFacingMode("environment")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                  facingMode === "environment"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Back Camera (Default)
              </button>
              <button
                type="button"
                onClick={() => setFacingMode("user")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                  facingMode === "user"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Front Camera
              </button>
            </div>

            {/* START BUTTON */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleStartCamera}
                disabled={isRequesting}
                className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-all shadow-[0_0_24px_rgba(255,255,255,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRequesting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Requesting Camera...</span>
                  </>
                ) : (
                  <>
                    <CameraIcon className="w-5 h-5" />
                    <span>Allow & Start Camera</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onEndSession}
                className="text-xs text-zinc-400 hover:text-zinc-300 py-1 transition-colors"
              >
                Cancel and exit
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-3 text-center text-[11px] text-zinc-400 border-t border-white/5">
        CEOVA Secure Camera Link • Powered by WebRTC
      </footer>
    </div>
  );
}
