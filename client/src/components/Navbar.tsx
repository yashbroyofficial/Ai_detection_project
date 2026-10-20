import type { ConnectionStatus } from "../lib";
import { ConnectionBadge } from "./ConnectionBadge";
import { ShieldIcon, VideoIcon } from "./Icons";

interface NavbarProps {
  status: ConnectionStatus;
  peerState?: RTCPeerConnectionState | null;
  onEndSession?: () => void;
  showEndButton?: boolean;
}

export function Navbar({ status, peerState, onEndSession, showEndButton }: NavbarProps) {
  const isSessionActive = status === "waiting" || status === "connecting" || status === "connected" || status === "requesting-camera";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#09090b]/80 backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-400 p-[1px] shadow-sm flex items-center justify-center">
            <div className="h-full w-full bg-zinc-950 rounded-[11px] flex items-center justify-center">
              <VideoIcon className="w-4 h-4 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-lg">CEOVA</span>
              <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                P2P
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block -mt-0.5">
              Instant WebRTC Camera Bridge
            </p>
          </div>
        </div>

        {/* Center: Security Assurance (Desktop only) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/60 border border-white/5 text-[11px] text-zinc-400">
          <ShieldIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Encrypted Direct Stream • Zero Cloud Storage</span>
        </div>

        {/* Right Status & Actions */}
        <div className="flex items-center gap-3">
          <ConnectionBadge status={status} peerState={peerState} />

          {showEndButton && isSessionActive && onEndSession && (
            <button
              onClick={onEndSession}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all hover:border-rose-500/50 active:scale-95"
            >
              <span>End Session</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
