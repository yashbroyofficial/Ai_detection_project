import type { HumanDetection, MappedHumanDetection, OverlayLayout } from "./types";

export function mapDetectionToOverlay(detection: HumanDetection, layout: OverlayLayout): MappedHumanDetection {
  const { sourceWidth, sourceHeight, box } = detection;
  const { elementWidth, elementHeight, objectFit, mirrored = false } = layout;
  const scale = objectFit === "contain"
    ? Math.min(elementWidth / sourceWidth, elementHeight / sourceHeight)
    : Math.max(elementWidth / sourceWidth, elementHeight / sourceHeight);
  const offsetX = (elementWidth - sourceWidth * scale) / 2;
  const offsetY = (elementHeight - sourceHeight * scale) / 2;
  const width = box.width * scale;
  const x = offsetX + box.x * scale;
  return {
    ...detection,
    displayBox: {
      x: mirrored ? elementWidth - x - width : x,
      y: offsetY + box.y * scale,
      width,
      height: box.height * scale,
    },
  };
}
