export type DetectionStatus = "idle" | "loading" | "ready" | "running" | "paused" | "error" | "disposed";

export type HumanBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HumanDetection = {
  box: HumanBoundingBox;
  confidence: number;
  sourceWidth: number;
  sourceHeight: number;
  timestamp: number;
};

export type HumanPresenceAlert = {
  type: "human-entered";
  timestamp: number;
  peopleCount: number;
  detections: HumanDetection[];
};

export type DetectionError = { code: "MODEL_LOAD_FAILED" | "INFERENCE_FAILED" | "INVALID_VIDEO"; message: string };

export type HumanDetectionSnapshot = {
  status: DetectionStatus;
  enabled: boolean;
  modelLoaded: boolean;
  confidenceThreshold: number;
  peopleCount: number;
  humanPresent: boolean;
  detections: HumanDetection[];
  lastDetectionTime: number | null;
  lastAlert: HumanPresenceAlert | null;
  error: DetectionError | null;
};

export type RawModelDetection = {
  bbox: [number, number, number, number];
  class: string;
  score: number;
};

export type HumanDetectionModel = {
  detect(input: HTMLVideoElement, maxNumBoxes?: number, minScore?: number): Promise<RawModelDetection[]>;
  dispose(): void;
};

export type HumanDetectionOptions = {
  confidenceThreshold?: number;
  inferenceFps?: number;
  confirmationFrames?: number;
  absenceFrames?: number;
  alertCooldownMs?: number;
  maxDetections?: number;
  modelLoader?: () => Promise<HumanDetectionModel>;
};

export type OverlayLayout = {
  elementWidth: number;
  elementHeight: number;
  objectFit: "contain" | "cover";
  mirrored?: boolean;
};

export type MappedHumanDetection = HumanDetection & {
  displayBox: HumanBoundingBox;
};
