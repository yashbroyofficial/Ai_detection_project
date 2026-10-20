export { CameraSessionController } from "./controller";
export { CeovaError } from "./errors";
export { getBackendOrigin } from "./endpoint";
export { parseCameraLink, createQrDataUrl } from "./pairing";
export { useCameraSession } from "./useCameraSession";
export {
  HumanDetectionController, TemporalPresenceTracker, filterHumanDetections,
  mapDetectionToOverlay, useHumanDetection,
} from "./detection";
export type {
  DetectionError, DetectionStatus, HumanBoundingBox, HumanDetection,
  HumanDetectionModel, HumanDetectionOptions, HumanDetectionSnapshot,
  HumanPresenceAlert, MappedHumanDetection, OverlayLayout, RawModelDetection,
} from "./detection";
export type {
  ConnectionStatus, ControllerOptions, PairingCredentials, SessionError,
  SessionInfo, SessionRole, SessionSnapshot,
} from "./types";
