import type { HumanDetectionModel } from "./types";

export async function loadCocoSsdModel(): Promise<HumanDetectionModel> {
  await Promise.all([
    import("@tensorflow/tfjs-backend-webgl"),
    import("@tensorflow/tfjs-backend-cpu"),
  ]);
  const tf = await import("@tensorflow/tfjs-core");
  try {
    if (!(await tf.setBackend("webgl"))) await tf.setBackend("cpu");
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  const cocoSsd = await import("@tensorflow-models/coco-ssd");
  return cocoSsd.load({ base: "lite_mobilenet_v2" });
}
