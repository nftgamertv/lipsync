"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AudioInput from "@/components/AudioInput";
import AssetUploader from "@/components/AssetUploader";
import CalibrationPanel from "@/components/CalibrationPanel";
import VisemeTester from "@/components/VisemeTester";
import TextInput from "@/components/TextInput";
import Canvas from "@/components/Canvas";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useRenderer } from "@/hooks/useRenderer";
import { healthCheck } from "@/lib/api";
import type { CalibrationState, SyncMode, VisemeState } from "@/types/viseme";
import { VISEME_COUNT, VISEME_LABELS } from "@/types/viseme";

export default function Home() {
  const [mode, setMode] = useState<SyncMode>("hybrid");
  const [isActive, setIsActive] = useState(false);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [activeViseme, setActiveViseme] = useState(0);
  const [calibration, setCalibration] = useState<CalibrationState>({
    mouthX: 0.5,
    mouthY: 0.7,
    mouthScale: 1.0,
    opacity: 1.0,
    displayScale: 1.0,
  });
  const textRef = useRef("");

  // Renderer
  const renderer = useRenderer({ width: 1920, height: 1080 });

  // WebSocket
  const handleViseme = useCallback(
    (state: VisemeState) => {
      setActiveViseme(state.target_viseme);
      renderer.updateViseme(
        state.target_viseme,
        state.blend_factor,
        state.current_viseme
      );
    },
    [renderer]
  );

  const ws = useWebSocket({ onViseme: handleViseme });

  // Audio capture
  const handleAudioChunk = useCallback(
    (data: Float32Array) => {
      ws.sendAudioChunk(data.buffer as ArrayBuffer);
    },
    [ws]
  );

  const audio = useAudioCapture({ onAudioChunk: handleAudioChunk });

  // Check backend health on mount
  useEffect(() => {
    healthCheck()
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  // Sync calibration to renderer
  useEffect(() => {
    renderer.updateCalibration(calibration);
  }, [calibration, renderer]);

  // Always run the render loop so canvas is live (tester, calibration, etc.)
  useEffect(() => {
    renderer.startRenderLoop();
    return () => {
      renderer.stopRenderLoop();
    };
  }, [renderer]);

  // Start/Stop controls audio + WebSocket only, NOT the render loop
  const handleToggle = useCallback(async () => {
    if (isActive) {
      // Stop
      audio.stopCapture();
      ws.sendReset();
      ws.disconnect();
      setIsActive(false);
    } else {
      // Start: connect WebSocket, send config, then start audio if not already capturing
      try {
        await ws.connect();
        ws.sendConfig(audio.sampleRate, mode, textRef.current);
        setIsActive(true);

        // Auto-start microphone if not already capturing audio
        if (!audio.isCapturing) {
          audio.startMicrophone().catch((err: unknown) => {
            console.warn("Auto-start mic failed (user can start manually):", err);
          });
        }
      } catch {
        console.error("Failed to connect WebSocket");
      }
    }
  }, [isActive, audio, ws, mode]);

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: SyncMode) => {
      setMode(newMode);
      if (isActive) {
        ws.sendMode(newMode);
      }
    },
    [isActive, ws]
  );

  // Handle text input
  const handleTextSubmit = useCallback(
    (text: string) => {
      textRef.current = text;
      if (isActive) {
        ws.sendText(text);
      }
    },
    [isActive, ws]
  );

  // Handle viseme test button
  const handleTestViseme = useCallback(
    (index: number) => {
      setActiveViseme(index);
      renderer.updateViseme(index);
    },
    [renderer]
  );

  // Handle calibration change
  const handleCalibrationChange = useCallback(
    (cal: Partial<CalibrationState>) => {
      setCalibration((prev) => ({ ...prev, ...cal }));
    },
    []
  );

  // Handle canvas click (mouth positioning)
  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      handleCalibrationChange({ mouthX: x, mouthY: y });
    },
    [handleCalibrationChange]
  );

  // Handle drag-and-drop on canvas
  const handleDrop = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;

        const match = file.name.match(/viseme(\d{1,2})\.\w+/i);
        if (match) {
          const index = parseInt(match[1], 10);
          if (index >= 0 && index < VISEME_COUNT) {
            const img = new Image();
            img.onload = () => renderer.setVisemeImage(index, img);
            img.src = URL.createObjectURL(file);
          }
        } else {
          // Treat as base image
          const img = new Image();
          img.onload = () => renderer.setBaseImage(img);
          img.src = URL.createObjectURL(file);
        }
      });
    },
    [renderer]
  );

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-200">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white">Lip Sync Avatar</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              isActive
                ? "bg-green-900/50 text-green-400"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {isActive ? "Active" : "Stopped"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              backendStatus === "online"
                ? "bg-blue-900/40 text-blue-400"
                : backendStatus === "offline"
                ? "bg-red-900/40 text-red-400"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            Server: {backendStatus}
          </span>
          {ws.connected && (
            <span className="text-xs px-2 py-0.5 rounded bg-purple-900/40 text-purple-400">
              WS Connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Mode selector */}
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value as SyncMode)}
            className="bg-zinc-800 text-zinc-200 text-sm rounded px-2 py-1 border border-zinc-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="hybrid">Hybrid (Audio + Text)</option>
            <option value="audio_only">Audio Only</option>
            <option value="text_only">Text Only</option>
          </select>

          {/* Viseme indicator */}
          <div className="text-xs text-zinc-400 font-mono w-20 text-right">
            [{activeViseme}] {VISEME_LABELS[activeViseme]}
          </div>

          {/* Start/Stop */}
          <button
            onClick={handleToggle}
            disabled={backendStatus !== "online"}
            className={`px-5 py-1.5 text-sm font-medium rounded transition-colors ${
              isActive
                ? "bg-red-600 hover:bg-red-500 text-white"
                : backendStatus === "online"
                ? "bg-green-600 hover:bg-green-500 text-white"
                : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isActive ? "Stop" : "Start"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-zinc-900 border-r border-zinc-800 overflow-y-auto p-3 space-y-4">
          <AudioInput
            devices={audio.devices}
            activeSource={audio.activeSource}
            isCapturing={audio.isCapturing}
            onRefreshDevices={audio.refreshDevices}
            onStartMicrophone={audio.startMicrophone}
            onStartFile={audio.startFile}
            onStartBrowserAudio={audio.startBrowserAudio}
            onStop={audio.stopCapture}
          />

          <hr className="border-zinc-800" />

          <AssetUploader
            onBaseImageLoad={renderer.setBaseImage}
            onVisemeImageLoad={renderer.setVisemeImage}
            loadedVisemeCount={renderer.getLoadedVisemeCount()}
            loadedVisemeSlots={renderer.getLoadedVisemeSlots()}
          />

          <hr className="border-zinc-800" />

          <CalibrationPanel
            calibration={calibration}
            onChange={handleCalibrationChange}
          />

          <hr className="border-zinc-800" />

          <VisemeTester
            activeViseme={activeViseme}
            onTestViseme={handleTestViseme}
          />

          <hr className="border-zinc-800" />

          <TextInput onTextSubmit={handleTextSubmit} />
        </aside>

        {/* Canvas */}
        <Canvas
          canvasRef={renderer.canvasRef}
          width={renderer.canvasWidth}
          height={renderer.canvasHeight}
          fps={renderer.fps}
          onCanvasClick={handleCanvasClick}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
}
