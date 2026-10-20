import { useState, type RefObject } from "react";
import { CameraIcon, FlipIcon, MaximizeIcon, MinimizeIcon } from "./Icons";

interface VideoControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isMirrored: boolean;
  onToggleMirror: () => void;
  objectFit: "contain" | "cover";
  onToggleFit: () => void;
}

export function VideoControls({
  videoRef,
  containerRef,
  isMirrored,
  onToggleMirror,
  objectFit,
  onToggleFit,
}: VideoControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotTaken, setSnapshotTaken] = useState(false);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore fullscreen rejection
    }
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `ceova-frame-${Date.now()}.png`;
      a.click();

      setSnapshotTaken(true);
      setTimeout(() => setSnapshotTaken(false), 2000);
    } catch {
      // ignore canvas error
    }
  };

  return (
    <div className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-950/70 backdrop-blur-md border border-white/10 text-white shadow-lg">
      {/* Fit Mode Toggle */}
      <button
        type="button"
        onClick={onToggleFit}
        className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-1.5"
        title={objectFit === "contain" ? "Switch to Fill/Cover" : "Switch to Fit/Contain"}
      >
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
          {objectFit}
        </span>
      </button>

      {/* Mirror Toggle */}
      <button
        type="button"
        onClick={onToggleMirror}
        className={`p-1.5 rounded-lg transition-colors ${
          isMirrored ? "bg-white/20 text-white" : "text-zinc-300 hover:bg-white/10"
        }`}
        title="Mirror horizontal"
      >
        <FlipIcon className="w-4 h-4" />
      </button>

      {/* Snapshot */}
      <button
        type="button"
        onClick={takeSnapshot}
        className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
          snapshotTaken ? "bg-emerald-500/20 text-emerald-300" : "text-zinc-300 hover:bg-white/10"
        }`}
        title="Take snapshot screenshot"
      >
        <CameraIcon className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

      {/* Fullscreen Toggle */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="p-1.5 rounded-lg text-zinc-300 hover:bg-white/10 transition-colors"
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <MinimizeIcon className="w-4 h-4" /> : <MaximizeIcon className="w-4 h-4" />}
      </button>
    </div>
  );
}
