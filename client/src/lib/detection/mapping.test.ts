import { describe, expect, it } from "vitest";
import { mapDetectionToOverlay } from "./mapping";

const detection = {
  box: { x: 100, y: 50, width: 200, height: 100 },
  confidence: 0.9,
  sourceWidth: 1_000,
  sourceHeight: 500,
  timestamp: 1,
};

describe("mapDetectionToOverlay", () => {
  it("maps contain offsets and horizontal mirroring", () => {
    const normal = mapDetectionToOverlay(detection, { elementWidth: 500, elementHeight: 500, objectFit: "contain" });
    expect(normal.displayBox).toEqual({ x: 50, y: 150, width: 100, height: 50 });
    const mirrored = mapDetectionToOverlay(detection, { elementWidth: 500, elementHeight: 500, objectFit: "contain", mirrored: true });
    expect(mirrored.displayBox.x).toBe(350);
  });

  it("maps cover cropping in element-relative coordinates", () => {
    const mapped = mapDetectionToOverlay(detection, { elementWidth: 500, elementHeight: 500, objectFit: "cover" });
    expect(mapped.displayBox).toEqual({ x: -150, y: 50, width: 200, height: 100 });
  });
});
