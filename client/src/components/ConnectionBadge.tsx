import type { ConnectionStatus } from "../lib";

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  peerState?: RTCPeerConnectionState | null;
  className?: string;
}

export function ConnectionBadge({ status, peerState, className = "" }: ConnectionBadgeProps) {
  let dotColor = "bg-zinc-500";
  let ping = false;
  let text = "Ready";
  let border = "border-zinc-800 bg-zinc-900/80 text-zinc-300";

  switch (status) {
    case "idle":
      dotColor = "bg-zinc-500";
      text = "Ready";
      border = "border-zinc-800 bg-zinc-900/60 text-zinc-400";
      break;
    case "creating":
      dotColor = "bg-sky-400";
      ping = true;
      text = "Creating session...";
      border = "border-sky-500/30 bg-sky-950/40 text-sky-200";
      break;
    case "joining":
      dotColor = "bg-sky-400";
      ping = true;
      text = "Joining session...";
      border = "border-sky-500/30 bg-sky-950/40 text-sky-200";
      break;
    case "waiting":
      dotColor = "bg-amber-400";
      ping = true;
      text = "Waiting for device";
      border = "border-amber-500/30 bg-amber-950/40 text-amber-200";
      break;
    case "requesting-camera":
      dotColor = "bg-violet-400";
      ping = true;
      text = "Requesting camera...";
      border = "border-violet-500/30 bg-violet-950/40 text-violet-200";
      break;
    case "connecting":
      dotColor = "bg-blue-400";
      ping = true;
      text = peerState ? `Connecting (${peerState})` : "Connecting WebRTC...";
      border = "border-blue-500/30 bg-blue-950/40 text-blue-200";
      break;
    case "connected":
      dotColor = "bg-emerald-400";
      ping = true;
      text = "Live P2P Stream";
      border = "border-emerald-500/40 bg-emerald-950/50 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.25)]";
      break;
    case "ended":
      dotColor = "bg-zinc-500";
      text = "Session ended";
      border = "border-zinc-800 bg-zinc-900/60 text-zinc-400";
      break;
    case "error":
      dotColor = "bg-rose-500";
      text = "Connection error";
      border = "border-rose-500/30 bg-rose-950/40 text-rose-300";
      break;
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md transition-all duration-300 ${border} ${className}`}
      role="status"
      aria-label={`Connection status: ${text}`}
    >
      <span className="relative flex h-2 w-2">
        {ping && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      <span className="tracking-wide">{text}</span>
    </div>
  );
}
