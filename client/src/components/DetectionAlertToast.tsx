import { useEffect, useRef, useState } from "react";
import type { HumanPresenceAlert } from "../lib";
import { CloseIcon, UserIcon, UsersIcon } from "./Icons";

interface DetectionAlertToastProps {
  alert: HumanPresenceAlert | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function DetectionAlertToast({
  alert,
  onDismiss,
  autoDismissMs = 5000,
}: DetectionAlertToastProps) {
  const [visible, setVisible] = useState(false);

  // Keep a stable ref to the latest onDismiss callback so reference changes don't restart timers
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Track the active alert timestamp to ensure timer only applies to the current alert
  const currentAlertTsRef = useRef<number | null>(null);

  // Track both the 5-second auto-dismiss timer and the 200ms fade timer for proper cleanup
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimers = () => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (fadeTimerRef.current !== null) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const handleManualDismiss = () => {
    clearAllTimers();
    setVisible(false);
    const alertTs = alert?.timestamp ?? null;
    fadeTimerRef.current = setTimeout(() => {
      fadeTimerRef.current = null;
      if (currentAlertTsRef.current === alertTs) {
        onDismissRef.current();
      }
    }, 200);
  };

  useEffect(() => {
    clearAllTimers();

    if (alert) {
      const alertTs = alert.timestamp;
      currentAlertTsRef.current = alertTs;
      setVisible(true);

      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        setVisible(false);

        fadeTimerRef.current = setTimeout(() => {
          fadeTimerRef.current = null;
          // Guard: only invoke onDismiss if no newer alert arrived
          if (currentAlertTsRef.current === alertTs) {
            onDismissRef.current();
          }
        }, 200);
      }, autoDismissMs);
    } else {
      currentAlertTsRef.current = null;
      setVisible(false);
    }

    return () => {
      clearAllTimers();
    };
  }, [alert?.timestamp, autoDismissMs]);

  if (!alert) return null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div
      className={`fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-full transition-all duration-300 pointer-events-auto ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
      }`}
    >
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-950/90 border border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.25)] backdrop-blur-xl text-white">
        {/* Glow indicator icon */}
        <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
          {alert.peopleCount > 1 ? (
            <UsersIcon className="w-5 h-5 animate-pulse" />
          ) : (
            <UserIcon className="w-5 h-5 animate-pulse" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold tracking-wide uppercase text-emerald-400 flex items-center gap-1.5">
              <span>Human Detected</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </h4>
            <span className="text-[10px] font-mono text-zinc-400">
              {formatTime(alert.timestamp)}
            </span>
          </div>

          <p className="mt-1 text-xs text-zinc-300 font-medium leading-snug">
            {alert.peopleCount === 1
              ? "1 person has entered the camera view."
              : `${alert.peopleCount} people detected in the camera view.`}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleManualDismiss}
          className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title="Dismiss notification"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
