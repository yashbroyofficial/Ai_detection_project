import type { DetectionError, DetectionStatus } from "../lib";
import { AlertTriangleIcon, RefreshCwIcon, UserIcon, UsersIcon } from "./Icons";

interface DetectionStatsWidgetProps {
  enabled: boolean;
  status: DetectionStatus;
  peopleCount: number;
  humanPresent: boolean;
  lastDetectionTime: number | null;
  error: DetectionError | null;
  onRetry?: () => void;
  confidenceThreshold?: number;
}

export function DetectionStatsWidget({
  enabled,
  status,
  peopleCount,
  humanPresent,
  lastDetectionTime,
  error,
  onRetry,
  confidenceThreshold = 0.6,
}: DetectionStatsWidgetProps) {
  // Format last detection time
  const formatTime = (ts: number | null) => {
    if (!ts) return null;
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // Derive human-readable status and theme
  let statusText = "AI OFF";
  let statusBadgeClass = "bg-zinc-800 text-zinc-400 border-zinc-700/60";
  let dotColor = "bg-zinc-500";
  let dotPulse = false;

  if (!enabled) {
    statusText = "AI OFF";
    statusBadgeClass = "bg-zinc-800/80 text-zinc-400 border-zinc-700/50";
    dotColor = "bg-zinc-500";
  } else if (status === "loading") {
    statusText = "LOADING DETECTION MODEL";
    statusBadgeClass = "bg-amber-500/10 text-amber-300 border-amber-500/30";
    dotColor = "bg-amber-400";
    dotPulse = true;
  } else if (status === "error" || error) {
    statusText = "DETECTION UNAVAILABLE";
    statusBadgeClass = "bg-rose-500/10 text-rose-300 border-rose-500/30";
    dotColor = "bg-rose-500";
  } else if (status === "paused") {
    statusText = "AI PAUSED";
    statusBadgeClass = "bg-amber-500/10 text-amber-300 border-amber-500/30";
    dotColor = "bg-amber-400";
  } else if (status === "running" || status === "ready") {
    if (peopleCount === 0) {
      statusText = "SCANNING — NO PEOPLE DETECTED";
      statusBadgeClass = "bg-sky-500/10 text-sky-300 border-sky-500/30";
      dotColor = "bg-sky-400";
      dotPulse = true;
    } else if (peopleCount === 1) {
      statusText = "1 PERSON DETECTED";
      statusBadgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      dotColor = "bg-emerald-400";
      dotPulse = true;
    } else {
      statusText = `${peopleCount} PEOPLE DETECTED`;
      statusBadgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      dotColor = "bg-emerald-400";
      dotPulse = true;
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl bg-zinc-950/80 border border-white/10 backdrop-blur-md text-xs font-mono">
      {/* Primary Status Pill */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold border ${statusBadgeClass} transition-colors`}
        >
          <span className="relative flex h-2 w-2">
            {dotPulse && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
              />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
          </span>
          <span>{statusText}</span>
        </span>

        {/* Human Presence State Pill */}
        {enabled && (status === "running" || status === "ready") && (
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              humanPresent
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-zinc-900 text-zinc-500 border-zinc-800"
            }`}
          >
            {humanPresent ? (
              <>
                <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>PRESENCE CONFIRMED</span>
              </>
            ) : (
              <span>NO PRESENCE</span>
            )}
          </span>
        )}
      </div>

      {/* Detection Metrics & Metadata */}
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        {enabled && (status === "running" || status === "ready") && (
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              {peopleCount > 1 ? (
                <UsersIcon className="w-3 h-3 text-emerald-400" />
              ) : (
                <UserIcon className="w-3 h-3 text-emerald-400" />
              )}
              <span>Count: {peopleCount}</span>
            </span>

            {lastDetectionTime && (
              <span className="hidden md:inline-block px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                Last: {formatTime(lastDetectionTime)}
              </span>
            )}

            <span className="hidden lg:inline-block px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
              Threshold: {Math.round(confidenceThreshold * 100)}%
            </span>
          </>
        )}

        {/* Error Feedback & Retry Action */}
        {error && (
          <div className="flex items-center gap-2 text-rose-300">
            <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-xs">{error.message}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-colors cursor-pointer"
              >
                <RefreshCwIcon className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
