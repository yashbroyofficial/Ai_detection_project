import { useEffect, useState } from "react";

interface SessionExpiryTimerProps {
  expiresAt: number;
  totalDurationMs?: number; // default 5 minutes (300,000ms)
  onExpire?: () => void;
  className?: string;
}

export function SessionExpiryTimer({
  expiresAt,
  totalDurationMs = 5 * 60 * 1000,
  onExpire,
  className = "",
}: SessionExpiryTimerProps) {
  const [remainingMs, setRemainingMs] = useState<number>(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, expiresAt - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        onExpire?.();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const isUrgent = remainingMs < 60_000 && remainingMs > 0;
  const isExpired = remainingMs <= 0;
  const progressPercent = Math.min(100, Math.max(0, (remainingMs / totalDurationMs) * 100));

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">Pairing window</span>
        <span
          className={`font-mono font-medium ${
            isExpired ? "text-rose-400" : isUrgent ? "text-amber-400 animate-pulse" : "text-zinc-300"
          }`}
        >
          {isExpired ? "Expired" : `${formattedTime} remaining`}
        </span>
      </div>

      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 rounded-full ${
            isExpired
              ? "bg-rose-500 w-0"
              : isUrgent
              ? "bg-amber-400"
              : "bg-sky-400"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
