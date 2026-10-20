import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus, SessionError, SessionInfo } from "../lib";
import { createQrDataUrl } from "../lib";
import { ConnectionBadge } from "../components/ConnectionBadge";
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  LaptopIcon,
  PlayIcon,
  QrCodeIcon,
  ShieldIcon,
  SmartphoneIcon,
  SparklesIcon,
  VideoIcon,
} from "../components/Icons";
import { SessionExpiryTimer } from "../components/SessionExpiryTimer";
import { VideoControls } from "../components/VideoControls";

interface ViewerDashboardProps {
  status: ConnectionStatus;
  session: SessionInfo | null;
  remoteStream: MediaStream | null;
  peerState: RTCPeerConnectionState | null;
  error: SessionError | null;
  endReason: string | null;
  onCreateSession: () => Promise<void>;
  onEndSession: () => Promise<void>;
  onClearError: () => void;
  isCreating?: boolean;
  onReturnHome?: () => void;
}

export function ViewerDashboard({
  status,
  session,
  remoteStream,
  peerState,
  endReason,
  onCreateSession,
  onEndSession,
  isCreating: isCreatingProp,
  onReturnHome,
}: ViewerDashboardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [objectFit, setObjectFit] = useState<"contain" | "cover">("contain");
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [streamResolution, setStreamResolution] = useState<{ width: number; height: number } | null>(null);
  const [liveDuration, setLiveDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  // Generate QR code whenever session.joinUrl is available
  useEffect(() => {
    let active = true;
    if (session?.joinUrl) {
      createQrDataUrl(session.joinUrl)
        .then((url) => {
          if (active) {
            setQrDataUrl(url);
            setQrError(null);
          }
        })
        .catch((err) => {
          if (active) {
            setQrError(err instanceof Error ? err.message : "Failed to generate QR code.");
            setQrDataUrl(null);
          }
        });
    } else {
      setQrDataUrl(null);
      setQrError(null);
    }
    return () => {
      active = false;
    };
  }, [session?.joinUrl]);

  // Attach remoteStream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (remoteStream) {
      video.srcObject = remoteStream;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setAutoplayBlocked(false))
          .catch(() => setAutoplayBlocked(true));
      }
    } else {
      video.srcObject = null;
      setStreamResolution(null);
      setAutoplayBlocked(false);
    }
  }, [remoteStream]);

  // Track live duration when connected
  useEffect(() => {
    if (status !== "connected") {
      setLiveDuration(0);
      return;
    }
    const timer = setInterval(() => {
      setLiveDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const handleCopyLink = async () => {
    if (!session?.joinUrl) return;
    try {
      await navigator.clipboard.writeText(session.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement("textarea");
      textarea.value = session.joinUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true));
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Determine which sub-view to show:
  const isCreating = Boolean(isCreatingProp) || status === "creating";
  const isWaiting = status === "waiting" && Boolean(session);
  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const isEnded = status === "ended";

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto w-full">
        {/* VIEW 1: CONNECTED / LIVE STREAM VIEWER */}
        {isConnected ? (
          <div className="flex flex-col gap-4">
            {/* Live Video Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-zinc-900/90 border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  LIVE STREAM
                </span>
                <span className="text-xs font-mono text-zinc-300">
                  {formatDuration(liveDuration)}
                </span>
                {streamResolution && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                    {streamResolution.width} × {streamResolution.height}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <VideoControls
                  videoRef={videoRef}
                  containerRef={videoContainerRef}
                  isMirrored={isMirrored}
                  onToggleMirror={() => setIsMirrored((m) => !m)}
                  objectFit={objectFit}
                  onToggleFit={() => setObjectFit((f) => (f === "contain" ? "cover" : "contain"))}
                />

                <button
                  type="button"
                  onClick={onEndSession}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all active:scale-95"
                >
                  End Stream
                </button>
              </div>
            </div>

            {/* Video Viewport Frame */}
            <div
              ref={videoContainerRef}
              className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl flex items-center justify-center group"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={false}
                onLoadedMetadata={(e) => {
                  const target = e.currentTarget;
                  if (target.videoWidth && target.videoHeight) {
                    setStreamResolution({ width: target.videoWidth, height: target.videoHeight });
                  }
                }}
                className={`w-full h-full transition-transform duration-200 ${
                  objectFit === "contain" ? "object-contain" : "object-cover"
                } ${isMirrored ? "-scale-x-100" : ""}`}
              />

              {/* Autoplay Blocked Overlay */}
              {autoplayBlocked && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20">
                  <p className="text-sm text-zinc-300">Browser paused live video playback.</p>
                  <button
                    type="button"
                    onClick={handleManualPlay}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-white hover:bg-zinc-200 transition-all shadow-lg active:scale-95"
                  >
                    <PlayIcon className="w-4 h-4 fill-black" />
                    Play Stream
                  </button>
                </div>
              )}

              {/* Subtle watermark overlay */}
              <div className="absolute bottom-4 left-4 pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity">
                <span className="text-xs font-bold tracking-wider uppercase text-white/70">
                  CEOVA P2P
                </span>
              </div>
            </div>
          </div>
        ) : isConnecting ? (
          /* VIEW 2: CONNECTING WEBRTC / NEGOTIATING */
          <div className="max-w-md mx-auto my-12 p-8 rounded-3xl bg-zinc-900/80 border border-white/10 shadow-2xl text-center flex flex-col items-center gap-6 backdrop-blur-xl">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <VideoIcon className="w-8 h-8 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500" />
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Connecting Camera</h2>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Establishing direct peer-to-peer WebRTC stream. Video will start automatically.
              </p>
              {peerState && (
                <div className="mt-3 inline-block text-xs font-mono px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  WebRTC State: {peerState}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onEndSession}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : isWaiting && session ? (
          /* VIEW 3: QR CODE PAIRING VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-6">
            {/* Left QR Code Presentation Card */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="relative p-6 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-2xl backdrop-blur-xl w-full max-w-sm">
                {/* Decorative scanner frame corners */}
                <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-sky-400/80 rounded-tl" />
                <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-sky-400/80 rounded-tr" />
                <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-sky-400/80 rounded-bl" />
                <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-sky-400/80 rounded-br" />

                <div className="relative w-full aspect-square bg-white rounded-2xl p-4 flex items-center justify-center shadow-inner overflow-hidden">
                  {qrDataUrl ? (
                    <>
                      <img
                        src={qrDataUrl}
                        alt="CEOVA Camera Connection QR Code"
                        className="w-full h-full object-contain"
                      />
                      {/* Scanning laser beam animation */}
                      <div className="qr-scan-line" />
                    </>
                  ) : qrError ? (
                    <div className="text-center p-4">
                      <p className="text-xs text-rose-500 font-medium">{qrError}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-zinc-400">
                      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Generating QR...</span>
                    </div>
                  )}
                </div>

                {/* Expiry Countdown */}
                <div className="mt-5">
                  <SessionExpiryTimer expiresAt={session.expiresAt} onExpire={onEndSession} />
                </div>
              </div>
            </div>

            {/* Right Instructions & Actions */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-sky-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                  </span>
                  WAITING FOR PHONE CONNECTION
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Scan QR code with your phone
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Open your phone’s camera app or QR scanner and point it at this screen.
                  You will be prompted to grant camera access and start streaming.
                </p>
              </div>

              {/* Instructions steps checklist */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5">
                  <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300 shrink-0">
                    <SmartphoneIcon className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <strong className="text-zinc-200 block font-medium">1. Scan with Phone</strong>
                    <span className="text-zinc-400">
                      Use standard iOS Camera or Android Google Lens / QR Scanner.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5">
                  <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300 shrink-0">
                    <ShieldIcon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xs">
                    <strong className="text-zinc-200 block font-medium">2. Tap "Allow & Start Camera"</strong>
                    <span className="text-zinc-400">
                      Grant camera permissions directly from the browser on your phone.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5">
                  <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300 shrink-0">
                    <LaptopIcon className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <strong className="text-zinc-200 block font-medium">3. View Live on Laptop</strong>
                    <span className="text-zinc-400">
                      This screen automatically switches to the full live video feed.
                    </span>
                  </div>
                </div>
              </div>

              {/* Copy link option */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Or share connection link directly</span>
                  {copied && <span className="text-emerald-400 text-xs font-medium">Copied!</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 text-xs font-mono text-zinc-300 truncate border border-zinc-800">
                    {session.joinUrl ?? "Generating link..."}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors shrink-0 active:scale-95"
                  >
                    {copied ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Cancel session */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onEndSession}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-colors"
                >
                  Cancel Session
                </button>
              </div>
            </div>
          </div>
        ) : isEnded ? (
          /* VIEW 4: SESSION ENDED */
          <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-2xl text-center flex flex-col items-center gap-6 backdrop-blur-xl">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-400">
              <VideoIcon className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Session Ended</h2>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                {endReason === "peer-disconnected"
                  ? "The connected device disconnected."
                  : endReason === "expired"
                  ? "The session pairing deadline expired."
                  : "The camera connection session has been ended."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={onCreateSession}
                disabled={isCreating}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-black bg-white hover:bg-zinc-200 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Creating Session...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4" />
                    <span>Create New Session</span>
                  </>
                )}
              </button>

              {onReturnHome && (
                <button
                  type="button"
                  onClick={onReturnHome}
                  disabled={isCreating}
                  className="px-5 py-3 rounded-2xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-colors disabled:opacity-50"
                >
                  Return to Home
                </button>
              )}
            </div>
          </div>
        ) : (
          /* VIEW 5: IDLE HERO DASHBOARD */
          <div className="flex flex-col items-center text-center my-8 sm:my-14">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/80 border border-white/10 text-xs text-zinc-300 shadow-sm mb-6">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span>Direct WebRTC • Peer-to-Peer • Zero Storage</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15]">
              Turn your smartphone into a wireless HD camera.
            </h1>

            {/* Subheading */}
            <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
              CEOVA bridges your phone camera directly to this laptop screen via a simple QR code.
              Zero application downloads, zero user accounts, and direct encrypted streaming.
            </p>

            {/* Main CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
              <button
                type="button"
                onClick={onCreateSession}
                disabled={isCreating}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold text-black bg-white hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Creating Session...</span>
                  </>
                ) : (
                  <>
                    <QrCodeIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span>Create Camera Session</span>
                    <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>

            {/* Feature cards grid */}
            <div className="mt-16 sm:mt-20 grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left">
              <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-md hover:border-white/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-sky-400 mb-4">
                  <QrCodeIcon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-white">Instant QR Pairing</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  No account setup, no Wi-Fi pairing codes, and no software installation required.
                  Just scan the QR with any standard smartphone camera.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-md hover:border-white/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-emerald-400 mb-4">
                  <ShieldIcon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-white">Peer-to-Peer Privacy</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Video flows directly from phone to laptop via encrypted WebRTC.
                  No video or audio frames are ever recorded, buffered, or stored on servers.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-md hover:border-white/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-amber-400 mb-4">
                  <VideoIcon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-white">High Resolution Feed</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Streams camera video at native device resolution with low latency, full-screen
                  mode, mirror flip, and instant high-res snapshot captures.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="mt-8 pt-4 border-t border-white/[0.06] text-center text-xs text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>CEOVA Camera Bridge • Direct LAN/WAN WebRTC</p>
        <p>Permissions are requested transparently on the sender device.</p>
      </footer>
    </div>
  );
}
