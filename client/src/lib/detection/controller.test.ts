import { afterEach, describe, expect, it, vi } from "vitest";
import { HumanDetectionController } from "./controller";
import type { HumanDetectionModel } from "./types";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HumanDetectionController", () => {
  it("moves through loading and running states, emits an alert, and cleans up", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { hidden: false });
    const model: HumanDetectionModel = {
      detect: vi.fn().mockResolvedValue([{ class: "person", score: 0.9, bbox: [1, 2, 30, 40] }]),
      dispose: vi.fn(),
    };
    const controller = new HumanDetectionController({
      modelLoader: async () => model,
      confirmationFrames: 1,
      absenceFrames: 1,
      inferenceFps: 5,
    });
    const alerts = vi.fn();
    controller.onAlert(alerts);
    const video = { readyState: 4, videoWidth: 640, videoHeight: 480, ended: false } as HTMLVideoElement;

    const starting = controller.start(video);
    expect(controller.getSnapshot().status).toBe("loading");
    await starting;
    await vi.advanceTimersByTimeAsync(0);

    expect(controller.getSnapshot()).toMatchObject({
      status: "running", enabled: true, modelLoaded: true,
      peopleCount: 1, humanPresent: true,
    });
    expect(alerts).toHaveBeenCalledTimes(1);

    controller.stop();
    expect(controller.getSnapshot()).toMatchObject({
      status: "ready", enabled: false, peopleCount: 0, humanPresent: false,
    });
    const callsAfterStop = vi.mocked(model.detect).mock.calls.length;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(model.detect).toHaveBeenCalledTimes(callsAfterStop);

    controller.dispose();
    expect(model.dispose).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe("disposed");
  });

  it("reports model loading failures without starting inference", async () => {
    const controller = new HumanDetectionController({ modelLoader: async () => { throw new Error("offline"); } });
    const video = { readyState: 4, videoWidth: 640, videoHeight: 480, ended: false } as HTMLVideoElement;
    await controller.start(video);
    expect(controller.getSnapshot()).toMatchObject({
      status: "error", enabled: false,
      error: { code: "MODEL_LOAD_FAILED", message: "offline" },
    });
  });

  it("disposes a model that finishes loading after controller cleanup", async () => {
    let resolveModel!: (model: HumanDetectionModel) => void;
    const pendingModel = new Promise<HumanDetectionModel>((resolve) => { resolveModel = resolve; });
    const model: HumanDetectionModel = { detect: vi.fn(), dispose: vi.fn() };
    const controller = new HumanDetectionController({ modelLoader: () => pendingModel });
    const video = { readyState: 4, videoWidth: 640, videoHeight: 480, ended: false } as HTMLVideoElement;

    const starting = controller.start(video);
    controller.dispose();
    resolveModel(model);
    await starting;

    expect(model.dispose).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe("disposed");
  });
});
