import { describe, expect, it } from "vitest";
import { filterHumanDetections } from "./filter";

describe("filterHumanDetections", () => {
  it("keeps confident people, preserves intrinsic coordinates, and counts only verified results", () => {
    const detections = filterHumanDetections([
      { class: "person", score: 0.91, bbox: [10, 20, 100, 200] },
      { class: "person", score: 0.59, bbox: [50, 60, 20, 30] },
      { class: "dog", score: 0.99, bbox: [1, 2, 3, 4] },
    ], 1280, 720, 0.6, 1234);

    expect(detections).toEqual([{
      box: { x: 10, y: 20, width: 100, height: 200 },
      confidence: 0.91,
      sourceWidth: 1280,
      sourceHeight: 720,
      timestamp: 1234,
    }]);
    expect(detections).toHaveLength(1);
  });
});
