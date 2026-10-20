import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { CameraSessionController } from "./controller";
import type { ControllerOptions } from "./types";

export function useCameraSession(options?: ControllerOptions) {
  const controllerRef = useRef<CameraSessionController | null>(null);
  if (!controllerRef.current) controllerRef.current = new CameraSessionController(options);
  const controller = controllerRef.current;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const disposeTimer = useRef<number | null>(null);
  useEffect(() => {
    if (disposeTimer.current !== null) window.clearTimeout(disposeTimer.current);
    return () => { disposeTimer.current = window.setTimeout(() => controller.dispose(), 0); };
  }, [controller]);
  const actions = useMemo(() => ({
    createSession: controller.createSession.bind(controller),
    joinSession: controller.joinSession.bind(controller),
    startCamera: controller.startCamera.bind(controller),
    endSession: controller.endSession.bind(controller),
    clearError: controller.clearError.bind(controller),
  }), [controller]);
  return { ...snapshot, ...actions };
}
