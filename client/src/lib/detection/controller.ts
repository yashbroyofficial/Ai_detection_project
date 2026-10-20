import { filterHumanDetections } from "./filter";
import { loadCocoSsdModel } from "./model";
import { TemporalPresenceTracker } from "./presence";
import type {
  HumanDetectionModel, HumanDetectionOptions, HumanDetectionSnapshot, HumanPresenceAlert,
} from "./types";

const initialSnapshot: HumanDetectionSnapshot = {
  status: "idle", enabled: false, modelLoaded: false, confidenceThreshold: 0.6, peopleCount: 0,
  humanPresent: false, detections: [], lastDetectionTime: null,
  lastAlert: null, error: null,
};

const bounded = (value: number | undefined, fallback: number, min: number, max: number) => {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

export class HumanDetectionController {
  private snapshot = initialSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly alertListeners = new Set<(alert: HumanPresenceAlert) => void>();
  private readonly threshold: { value: number };
  private readonly intervalMs: number;
  private readonly maxDetections: number;
  private readonly modelLoader: () => Promise<HumanDetectionModel>;
  private readonly presence: TemporalPresenceTracker;
  private model: HumanDetectionModel | null = null;
  private modelPromise: Promise<HumanDetectionModel> | null = null;
  private video: HTMLVideoElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private disposed = false;

  constructor(options: HumanDetectionOptions = {}) {
    this.threshold = { value: bounded(options.confidenceThreshold, 0.6, 0, 1) };
    this.snapshot = { ...initialSnapshot, confidenceThreshold: this.threshold.value };
    this.intervalMs = 1000 / bounded(options.inferenceFps, 5, 0.5, 30);
    this.maxDetections = Math.round(bounded(options.maxDetections, 20, 1, 100));
    this.modelLoader = options.modelLoader ?? loadCocoSsdModel;
    this.presence = new TemporalPresenceTracker(
      Math.round(bounded(options.confirmationFrames, 2, 1, 30)),
      Math.round(bounded(options.absenceFrames, 3, 1, 60)),
      bounded(options.alertCooldownMs, 10_000, 0, 3_600_000),
    );
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  onAlert = (listener: (alert: HumanPresenceAlert) => void) => { this.alertListeners.add(listener); return () => this.alertListeners.delete(listener); };

  async start(video: HTMLVideoElement): Promise<void> {
    this.assertUsable();
    if (!video) throw new Error("A remote video element is required.");
    const generation = ++this.generation;
    this.stopTimer();
    this.video = video;
    this.presence.reset();
    this.update({ ...initialSnapshot, confidenceThreshold: this.threshold.value, enabled: true, status: this.model ? "ready" : "loading", modelLoaded: Boolean(this.model) });
    try {
      await this.ensureModel();
      if (generation !== this.generation || this.disposed || !this.snapshot.enabled) return;
      this.update({ status: "ready", modelLoaded: true });
      this.schedule(0, generation);
    } catch (error) {
      if (generation !== this.generation || this.disposed) return;
      this.video = null;
      this.update({
        status: "error", enabled: false, modelLoaded: false,
        error: { code: "MODEL_LOAD_FAILED", message: error instanceof Error ? error.message : "Could not load the human detection model." },
      });
    }
  }

  stop(): void {
    if (this.disposed) return;
    ++this.generation;
    this.stopTimer();
    this.video = null;
    this.presence.reset();
    this.update({
      status: this.model ? "ready" : "idle", enabled: false,
      peopleCount: 0, humanPresent: false, detections: [],
      lastDetectionTime: null, lastAlert: null, error: null,
    });
  }

  setEnabled(enabled: boolean, video?: HTMLVideoElement): Promise<void> | void {
    if (!enabled) return this.stop();
    const target = video ?? this.video;
    if (!target) throw new Error("Pass the remote video element when enabling detection.");
    return this.start(target);
  }

  setConfidenceThreshold(value: number): void {
    this.assertUsable();
    this.threshold.value = bounded(value, 0.6, 0, 1);
    this.update({ confidenceThreshold: this.threshold.value });
  }

  clearError(): void {
    if (this.snapshot.status === "error") this.update({ status: this.model ? "ready" : "idle", error: null });
  }

  dispose(): void {
    if (this.disposed) return;
    ++this.generation;
    this.stopTimer();
    this.video = null;
    this.presence.reset();
    this.model?.dispose();
    this.model = null;
    this.modelPromise = null;
    this.disposed = true;
    this.update({ ...initialSnapshot, confidenceThreshold: this.threshold.value, status: "disposed" });
    this.alertListeners.clear();
    this.listeners.clear();
  }

  private async ensureModel() {
    if (this.model) return this.model;
    this.modelPromise ??= this.modelLoader();
    try {
      const loaded = await this.modelPromise;
      if (this.disposed) {
        loaded.dispose();
        this.modelPromise = null;
        throw new Error("This human detection controller has been disposed.");
      }
      this.model = loaded;
      return this.model;
    } catch (error) {
      this.modelPromise = null;
      throw error;
    }
  }

  private schedule(delay: number, generation: number) {
    this.stopTimer();
    this.timer = setTimeout(() => { void this.tick(generation); }, delay);
  }

  private async tick(generation: number) {
    this.timer = null;
    if (generation !== this.generation || this.disposed || !this.snapshot.enabled || !this.video || !this.model) return;
    if (typeof document !== "undefined" && document.hidden) {
      this.update({ status: "paused" });
      this.schedule(500, generation);
      return;
    }
    const video = this.video;
    const source = video.srcObject as { getVideoTracks?: () => MediaStreamTrack[] } | null;
    if (source?.getVideoTracks && source.getVideoTracks().every((track) => track.readyState === "ended")) {
      this.stop();
      return;
    }
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0 || video.ended) {
      this.update({ status: "paused" });
      this.schedule(250, generation);
      return;
    }
    const startedAt = performance.now();
    this.update({ status: "running", error: null });
    try {
      const predictions = await this.model.detect(video, this.maxDetections, this.threshold.value);
      if (generation !== this.generation || this.disposed || !this.snapshot.enabled) return;
      const timestamp = Date.now();
      const detections = filterHumanDetections(predictions, video.videoWidth, video.videoHeight, this.threshold.value, timestamp);
      const transition = this.presence.observe(detections.length > 0, timestamp);
      const patch: Partial<HumanDetectionSnapshot> = {
        detections,
        peopleCount: detections.length,
        humanPresent: transition.humanPresent,
        lastDetectionTime: detections.length > 0 ? timestamp : this.snapshot.lastDetectionTime,
      };
      if (transition.alert) {
        const alert: HumanPresenceAlert = { type: "human-entered", timestamp, peopleCount: detections.length, detections };
        patch.lastAlert = alert;
        this.update(patch);
        for (const listener of this.alertListeners) {
          try { listener(alert); } catch { /* UI alert handlers must not stop inference. */ }
        }
      } else this.update(patch);
      this.schedule(Math.max(0, this.intervalMs - (performance.now() - startedAt)), generation);
    } catch (error) {
      if (generation !== this.generation || this.disposed) return;
      this.video = null;
      this.update({
        status: "error", enabled: false, detections: [], peopleCount: 0, humanPresent: false,
        error: { code: "INFERENCE_FAILED", message: error instanceof Error ? error.message : "Human detection failed." },
      });
    }
  }

  private stopTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private assertUsable() {
    if (this.disposed) throw new Error("This human detection controller has been disposed.");
  }

  private update(patch: Partial<HumanDetectionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) {
      try { listener(); } catch { /* One subscriber must not break the engine. */ }
    }
  }
}
