import { describe, expect, it } from "vitest";
import { TemporalPresenceTracker } from "./presence";

describe("TemporalPresenceTracker", () => {
  it("requires stable presence, rearms after stable absence, and enforces cooldown", () => {
    const tracker = new TemporalPresenceTracker(2, 2, 1_000);
    expect(tracker.observe(true, 0)).toEqual({ humanPresent: false, alert: false });
    expect(tracker.observe(true, 100)).toEqual({ humanPresent: true, alert: true });
    expect(tracker.observe(true, 200)).toEqual({ humanPresent: true, alert: false });
    expect(tracker.observe(false, 300)).toEqual({ humanPresent: true, alert: false });
    expect(tracker.observe(false, 400)).toEqual({ humanPresent: false, alert: false });
    expect(tracker.observe(true, 500)).toEqual({ humanPresent: false, alert: false });
    expect(tracker.observe(true, 600)).toEqual({ humanPresent: true, alert: false });
    expect(tracker.observe(false, 700)).toEqual({ humanPresent: true, alert: false });
    expect(tracker.observe(false, 800)).toEqual({ humanPresent: false, alert: false });
    expect(tracker.observe(true, 1_100)).toEqual({ humanPresent: false, alert: false });
    expect(tracker.observe(true, 1_200)).toEqual({ humanPresent: true, alert: true });
  });
});
