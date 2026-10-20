import { useEffect, useMemo, useState, type RefObject } from "react";
import { mapDetectionToOverlay, type HumanDetection } from "../lib";

interface DetectionOverlayProps {
  detections: HumanDetection[];
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  objectFit: "contain" | "cover";
  isMirrored: boolean;
  enabled: boolean;
}

export function DetectionOverlay({
  detections,
  videoRef,
  containerRef,
  objectFit,
  isMirrored,
  enabled,
}: DetectionOverlayProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Track the actual rendered dimensions of the video element
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video) return;

    const updateDimensions = () => {
      const width = video.clientWidth || container?.clientWidth || 0;
      const height = video.clientHeight || container?.clientHeight || 0;
      if (width > 0 && height > 0) {
        setDimensions((prev) => {
          if (prev.width === width && prev.height === height) return prev;
          return { width, height };
        });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(video);
    if (container) {
      resizeObserver.observe(container);
    }
    window.addEventListener("resize", updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [videoRef, containerRef]);

  // Map intrinsic video coordinates to the rendered display box
  const mappedDetections = useMemo(() => {
    if (!enabled || !dimensions.width || !dimensions.height || detections.length === 0) {
      return [];
    }

    return detections.map((det) =>
      mapDetectionToOverlay(det, {
        elementWidth: dimensions.width,
        elementHeight: dimensions.height,
        objectFit,
        mirrored: isMirrored,
      })
    );
  }, [detections, dimensions, objectFit, isMirrored, enabled]);

  if (!enabled || mappedDetections.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-10 select-none"
      aria-hidden="true"
    >
      {mappedDetections.map((item, index) => {
        const { displayBox, confidence } = item;
        const confidencePct = Math.round(confidence * 100);

        return (
          <div
            key={`box-${index}-${displayBox.x.toFixed(0)}-${displayBox.y.toFixed(0)}`}
            style={{
              position: "absolute",
              left: `${displayBox.x}px`,
              top: `${displayBox.y}px`,
              width: `${displayBox.width}px`,
              height: `${displayBox.height}px`,
            }}
            className="border-2 border-emerald-400/90 rounded-lg shadow-[0_0_20px_rgba(52,211,153,0.35)] transition-[left,top,width,height] duration-75 ease-out"
          >
            {/* Pill label: PERSON & confidence */}
            <div className="absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-950/95 border border-emerald-400/60 text-emerald-300 text-[10px] font-mono font-semibold tracking-wider shadow-lg whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>PERSON</span>
              <span className="text-white/90">{confidencePct}%</span>
            </div>

            {/* Corner targeting marks */}
            <div className="absolute -top-[2px] -left-[2px] w-2.5 h-2.5 border-t-2 border-l-2 border-white pointer-events-none" />
            <div className="absolute -top-[2px] -right-[2px] w-2.5 h-2.5 border-t-2 border-r-2 border-white pointer-events-none" />
            <div className="absolute -bottom-[2px] -left-[2px] w-2.5 h-2.5 border-b-2 border-l-2 border-white pointer-events-none" />
            <div className="absolute -bottom-[2px] -right-[2px] w-2.5 h-2.5 border-b-2 border-r-2 border-white pointer-events-none" />
          </div>
        );
      })}
    </div>
  );
}
