"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { CalibrationState } from "@/types/viseme";
import { VISEME_COUNT } from "@/types/viseme";

interface UseRendererOptions {
  width?: number;
  height?: number;
}

export function useRenderer(options: UseRendererOptions = {}) {
  const { width = 1920, height = 1080 } = options;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const [fps, setFps] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Image state
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const visemeImagesRef = useRef<(HTMLImageElement | null)[]>(
    new Array(VISEME_COUNT).fill(null)
  );

  // Viseme state
  const currentVisemeRef = useRef(0);
  const targetVisemeRef = useRef(0);
  const blendFactorRef = useRef(1.0);

  // Calibration
  const calibrationRef = useRef<CalibrationState>({
    mouthX: 0.5,
    mouthY: 0.7,
    mouthScale: 1.0,
    opacity: 1.0,
    displayScale: 1.0,
  });

  // FPS tracking
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);

  const setBaseImage = useCallback((img: HTMLImageElement) => {
    baseImageRef.current = img;
  }, []);

  const setVisemeImage = useCallback((index: number, img: HTMLImageElement) => {
    if (index >= 0 && index < VISEME_COUNT) {
      visemeImagesRef.current[index] = img;
    }
  }, []);

  const getLoadedVisemeCount = useCallback(() => {
    return visemeImagesRef.current.filter((img) => img !== null).length;
  }, []);

  const updateViseme = useCallback(
    (target: number, blend: number = 1.0, current?: number) => {
      targetVisemeRef.current = Math.max(0, Math.min(VISEME_COUNT - 1, target));
      blendFactorRef.current = blend;
      if (current !== undefined) {
        currentVisemeRef.current = Math.max(0, Math.min(VISEME_COUNT - 1, current));
      }
    },
    []
  );

  const updateCalibration = useCallback((cal: Partial<CalibrationState>) => {
    calibrationRef.current = { ...calibrationRef.current, ...cal };
  }, []);

  // Core render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cal = calibrationRef.current;

    // Clear with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Apply display scale
    const scale = cal.displayScale;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // Apply opacity
    ctx.globalAlpha = cal.opacity;

    // Draw base face
    if (baseImageRef.current) {
      const base = baseImageRef.current;
      // Scale base to fill canvas while maintaining aspect ratio
      const baseScale = Math.min(
        canvas.width / base.width,
        canvas.height / base.height
      );
      const bw = base.width * baseScale;
      const bh = base.height * baseScale;
      const bx = (canvas.width - bw) / 2;
      const by = (canvas.height - bh) / 2;
      ctx.drawImage(base, bx, by, bw, bh);
    }

    // Draw mouth overlay (blended visemes)
    const targetIdx = targetVisemeRef.current;
    const currentIdx = currentVisemeRef.current;
    const blend = blendFactorRef.current;

    const targetImg = visemeImagesRef.current[targetIdx];
    const currentImg = visemeImagesRef.current[currentIdx];

    if (targetImg || currentImg) {
      const mouthCx = canvas.width * cal.mouthX;
      const mouthCy = canvas.height * cal.mouthY;

      // Draw current (fading out) if blending
      if (currentImg && blend < 1.0) {
        ctx.globalAlpha = cal.opacity * (1.0 - blend);
        drawMouthImage(ctx, currentImg, mouthCx, mouthCy, cal.mouthScale);
      }

      // Draw target
      if (targetImg) {
        ctx.globalAlpha = cal.opacity * (blend < 1.0 ? blend : 1.0);
        drawMouthImage(ctx, targetImg, mouthCx, mouthCy, cal.mouthScale);
      }
    }

    ctx.restore();

    // FPS counter
    frameCountRef.current++;
    const now = performance.now();
    if (now - lastFpsUpdateRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }
  }, []);

  const startRenderLoop = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    lastFpsUpdateRef.current = performance.now();
    frameCountRef.current = 0;

    const loop = () => {
      render();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, [isRunning, render]);

  const stopRenderLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    setIsRunning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return {
    canvasRef,
    fps,
    isRunning,
    canvasWidth: width,
    canvasHeight: height,
    setBaseImage,
    setVisemeImage,
    getLoadedVisemeCount,
    updateViseme,
    updateCalibration,
    startRenderLoop,
    stopRenderLoop,
  };
}

function drawMouthImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  scale: number
) {
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}
