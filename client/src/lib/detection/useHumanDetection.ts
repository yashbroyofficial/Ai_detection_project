import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { HumanDetectionController } from "./controller";
import type { HumanDetectionOptions } from "./types";

export function useHumanDetection(options?: HumanDetectionOptions) {
  const controllerRef = useRef<HumanDetectionController | null>(null);
  if (!controllerRef.current) controllerRef.current = new HumanDetectionController(options);
  const controller = controllerRef.current;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const disposeTimer = useRef<number | null>(null);
  useEffect(() => {
    if (disposeTimer.current !== null) window.clearTimeout(disposeTimer.current);
    return () => { disposeTimer.current = window.setTimeout(() => controller.dispose(), 0); };
  }, [controller]);
  const actions = useMemo(() => ({
    startDetection: controller.start.bind(controller),
    stopDetection: controller.stop.bind(controller),
    setDetectionEnabled: controller.setEnabled.bind(controller),
    setConfidenceThreshold: controller.setConfidenceThreshold.bind(controller),
    clearDetectionError: controller.clearError.bind(controller),
    onHumanPresenceAlert: controller.onAlert.bind(controller),
  }), [controller]);
  return { ...snapshot, ...actions };
}
