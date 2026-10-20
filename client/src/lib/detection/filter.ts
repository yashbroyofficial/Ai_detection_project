import type { HumanDetection, RawModelDetection } from "./types";

const finite = (value: number) => Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function filterHumanDetections(
  predictions: RawModelDetection[],
  sourceWidth: number,
  sourceHeight: number,
  confidenceThreshold = 0.6,
  timestamp = Date.now(),
): HumanDetection[] {
  if (!finite(sourceWidth) || !finite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) return [];
  const threshold = clamp(confidenceThreshold, 0, 1);
  return predictions.flatMap((prediction) => {
    if (prediction.class !== "person" || !finite(prediction.score) || prediction.score < threshold) return [];
    const [rawX, rawY, rawWidth, rawHeight] = prediction.bbox;
    if (![rawX, rawY, rawWidth, rawHeight].every(finite) || rawWidth <= 0 || rawHeight <= 0) return [];
    const x = clamp(rawX, 0, sourceWidth);
    const y = clamp(rawY, 0, sourceHeight);
    const width = clamp(rawWidth, 0, sourceWidth - x);
    const height = clamp(rawHeight, 0, sourceHeight - y);
    if (width <= 0 || height <= 0) return [];
    return [{
      box: { x, y, width, height },
      confidence: clamp(prediction.score, 0, 1),
      sourceWidth,
      sourceHeight,
      timestamp,
    }];
  }).sort((a, b) => b.confidence - a.confidence);
}
