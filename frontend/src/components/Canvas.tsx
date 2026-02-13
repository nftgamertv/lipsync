"use client";

import { useCallback, useEffect, useRef } from "react";

interface CanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  fps: number;
  onCanvasClick: (normalizedX: number, normalizedY: number) => void;
  onDrop: (files: FileList) => void;
}

export default function Canvas({
  canvasRef,
  width,
  height,
  fps,
  onCanvasClick,
  onDrop,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Handle click to position mouth
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = ((e.clientX - rect.left) * scaleX) / canvas.width;
      const y = ((e.clientY - rect.top) * scaleY) / canvas.height;

      onCanvasClick(
        Math.max(0, Math.min(1, x)),
        Math.max(0, Math.min(1, y))
      );
    },
    [canvasRef, onCanvasClick]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    isDraggingRef.current = false;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = false;

      if (e.dataTransfer.files.length > 0) {
        onDrop(e.dataTransfer.files);
      }
    },
    [onDrop]
  );

  // Set canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [canvasRef, width, height]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Checkered background to show transparency */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #1a1a2e 25%, transparent 25%),
            linear-gradient(-45deg, #1a1a2e 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #1a1a2e 75%),
            linear-gradient(-45deg, transparent 75%, #1a1a2e 75%)
          `,
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
        }}
      />

      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="relative w-full h-full cursor-crosshair"
        style={{ imageRendering: "auto" }}
      />

      {/* FPS counter */}
      <div className="absolute top-2 right-2 bg-black/60 text-zinc-400 text-xs px-2 py-0.5 rounded font-mono">
        {fps} FPS
      </div>

      {/* Drop overlay */}
      {isDraggingRef.current && (
        <div className="absolute inset-0 bg-indigo-600/20 border-2 border-dashed border-indigo-400 flex items-center justify-center">
          <p className="text-indigo-300 text-lg font-medium">
            Drop images here
          </p>
        </div>
      )}
    </div>
  );
}
