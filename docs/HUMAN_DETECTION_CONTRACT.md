# CEOVA human detection integration contract

The detection engine runs only in the viewer's browser against the existing
remote WebRTC `<video>` element. It does not request a camera, create a peer
connection, send frames to CEOVA's backend, record media, identify people, or
play sounds. COCO-SSD model files are downloaded lazily when detection first
starts; subsequent inference is local in TensorFlow.js.

## Exports

Import these from `client/src/lib`:

```ts
import {
  useHumanDetection,
  HumanDetectionController,
  filterHumanDetections,
  mapDetectionToOverlay,
  type HumanDetection,
  type HumanDetectionOptions,
  type HumanDetectionSnapshot,
  type HumanPresenceAlert,
  type MappedHumanDetection,
} from "../lib";
```

`useCameraSession()` remains the source of the remote stream and connection
state. Detection is additive and does not replace it.

## React API

```ts
const detection = useHumanDetection({
  confidenceThreshold: 0.60,
  inferenceFps: 5,
  confirmationFrames: 2,
  absenceFrames: 3,
  alertCooldownMs: 10_000,
});
```

The returned snapshot contains:

```ts
type HumanDetectionSnapshot = {
  status: "idle" | "loading" | "ready" | "running" | "paused" | "error" | "disposed";
  enabled: boolean;
  modelLoaded: boolean;
  confidenceThreshold: number;
  peopleCount: number;
  humanPresent: boolean;
  detections: HumanDetection[];
  lastDetectionTime: number | null;
  lastAlert: HumanPresenceAlert | null;
  error: {
    code: "MODEL_LOAD_FAILED" | "INFERENCE_FAILED" | "INVALID_VIDEO";
    message: string;
  } | null;
};
```

It also returns stable actions:

- `startDetection(video: HTMLVideoElement): Promise<void>` enables detection,
  lazy-loads the model, and starts when usable remote frames are available.
- `stopDetection(): void` stops scheduling work and clears detections, counts,
  presence, errors, and temporal alert state. The loaded model stays cached for
  a fast restart.
- `setDetectionEnabled(enabled, video?): Promise<void> | void` disables by
  stopping, or enables using the supplied/current remote video element.
- `setConfidenceThreshold(value): void` clamps the threshold to 0–1 and applies
  it to subsequent inference. The default is 0.60.
- `clearDetectionError(): void` clears a load/inference error.
- `onHumanPresenceAlert(listener): () => void` subscribes to new-presence alerts
  and returns an unsubscribe function.

The hook disposes the model on unmount. `HumanDetectionController` exposes the
same actions plus `getSnapshot()`, `subscribe()`, `onAlert()`, and `dispose()` for
non-React use.

## Attach to the remote video

Use the same viewer video element that receives `remoteStream`. Do not create a
second `<video>`, request `getUserMedia`, or copy frames to a server.

```tsx
const videoRef = useRef<HTMLVideoElement | null>(null);
const camera = useCameraSession();
const detection = useHumanDetection();

useEffect(() => {
  const video = videoRef.current;
  if (!detectionEnabled || camera.status !== "connected" || !camera.mediaReceived || !video) {
    detection.stopDetection();
    return;
  }
  void detection.startDetection(video);
  return detection.stopDetection;
}, [detectionEnabled, camera.status, camera.mediaReceived]);
```

Keep the existing `srcObject`, `autoPlay`, `playsInline`, and playback handling.
Detection waits until `readyState >= HAVE_CURRENT_DATA`, `videoWidth` and
`videoHeight` are non-zero, and the video is not ended. It pauses while the page
is hidden or frames are temporarily unavailable. Calls never overlap: the next
inference is scheduled only after the previous one finishes.

Call `stopDetection()` when the session ends, the remote stream disappears, the
user disables detection, or the viewer component stops showing the stream.

## Detection and counting semantics

Each `HumanDetection` is a COCO-SSD result whose class is exactly `person` and
whose score meets the current threshold:

```ts
type HumanDetection = {
  box: { x: number; y: number; width: number; height: number };
  confidence: number;   // 0–1; multiply by 100 for a percentage
  sourceWidth: number;  // video.videoWidth at inference time
  sourceHeight: number; // video.videoHeight at inference time
  timestamp: number;    // epoch milliseconds
};
```

Coordinates are pixels in the video's intrinsic source space. `peopleCount` is
the number of current person results after confidence filtering.
`lastDetectionTime` changes only when at least one qualified person is present.

`humanPresent` is temporally stabilized. By default it becomes true after two
consecutive positive inference results and becomes false after three consecutive
empty results. This prevents one-frame detections from becoming presence events.

## Alert events

An alert fires only on a stabilized transition from no human to human present.
After an alert, continuous presence does not emit more alerts. Alerts re-arm
after the configured number of stable no-person results. The cooldown still
blocks a new alert until its duration has elapsed.

```ts
useEffect(() => detection.onHumanPresenceAlert((alert) => {
  // Show a visual notification. Sound, if offered, must remain an explicit UI choice.
  console.info(alert.type, alert.peopleCount, new Date(alert.timestamp));
}), [detection.onHumanPresenceAlert]);
```

Do not play audio inside the detection engine. Do not persist alert frames or
credentials. `lastAlert` contains the most recent event for declarative UI.

## Bounding-box mapping

`mapDetectionToOverlay(detection, layout)` converts intrinsic video coordinates
to coordinates relative to the rendered video element:

```ts
const mapped = detection.detections.map((item) =>
  mapDetectionToOverlay(item, {
    elementWidth: video.clientWidth,
    elementHeight: video.clientHeight,
    objectFit, // "contain" or "cover", matching the video CSS
    mirrored: isMirrored,
  }),
);
```

Render `mapped.displayBox` in an absolutely positioned overlay whose origin and
size exactly match the video element. Set the overlay to `pointer-events: none`.
Recalculate on video metadata, container resize, fullscreen change, object-fit
change, mirror change, and every new detection result.

The mapping uses:

```text
contain scale = min(elementWidth/sourceWidth, elementHeight/sourceHeight)
cover scale   = max(elementWidth/sourceWidth, elementHeight/sourceHeight)
offsetX       = (elementWidth  - sourceWidth  * scale) / 2
offsetY       = (elementHeight - sourceHeight * scale) / 2
displayX      = offsetX + sourceX * scale
displayY      = offsetY + sourceY * scale
```

For a mirrored video, horizontal box position becomes
`elementWidth - displayX - displayWidth`. Do not mirror the source coordinates
before calling the helper. With `contain`, offsets represent letterboxing. With
`cover`, an offset can be negative because part of the source is cropped; keep
the overlay container clipped with the same border radius/overflow as the video.

## Status, errors, and lifecycle

- `loading`: TensorFlow.js and COCO-SSD are being downloaded/initialized.
- `ready`: model is loaded but inference is stopped or about to start.
- `running`: the current/last inference completed against usable video.
- `paused`: enabled, but the page is hidden or the video has no usable frame.
- `error`: model loading or inference failed; show `error.message` and allow the
  user to retry. Retrying `startDetection(video)` reloads after a load failure.
- `disposed`: the controller and model resources were released permanently.

`stopDetection()` is reusable. `dispose()` is final and calls the model's tensor
cleanup. Never call `startDetection()` on a disposed controller.

## Performance and privacy

The defaults target five inferences per second and use the lightweight
`lite_mobilenet_v2` COCO-SSD base. WebGL is preferred; CPU is the fallback. The
rate is capped at 30 FPS and can be lowered on slow laptops. Inference is
serialized and automatically pauses in hidden tabs.

The model package code is split by dynamic imports, so it is absent from the
initial execution path. Model weights are fetched during initialization from the
model's configured host. Camera frames are passed directly from the remote video
element to local TensorFlow.js inference and are not uploaded by this engine.

COCO-SSD detects the general `person` category. It does not recognize identity,
faces, behavior, posture, or intent. Confidence is a model score rather than a
guarantee of correctness. Validate thresholds and performance with representative
physical video before describing real-world accuracy.
