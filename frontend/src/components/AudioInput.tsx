"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioSourceType } from "@/types/viseme";

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface AudioInputProps {
  devices: AudioDevice[];
  activeSource: AudioSourceType | null;
  isCapturing: boolean;
  onRefreshDevices: () => void;
  onStartMicrophone: (deviceId?: string) => void;
  onStartFile: (file: File) => void;
  onStartBrowserAudio: () => void;
  onStop: () => void;
}

export default function AudioInput({
  devices,
  activeSource,
  isCapturing,
  onRefreshDevices,
  onStartMicrophone,
  onStartFile,
  onStartBrowserAudio,
  onStop,
}: AudioInputProps) {
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [sourceType, setSourceType] = useState<AudioSourceType>("file");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onRefreshDevices();
  }, [onRefreshDevices]);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].deviceId);
    }
  }, [devices, selectedDevice]);

  const handleStart = useCallback(() => {
    if (sourceType === "microphone") {
      onStartMicrophone(selectedDevice || undefined);
    } else if (sourceType === "browser") {
      onStartBrowserAudio();
    }
    // file is handled via handleFileChange
  }, [sourceType, selectedDevice, onStartMicrophone, onStartBrowserAudio]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onStartFile(file);
      }
    },
    [onStartFile]
  );

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
        Audio Source
      </h2>

      {/* Source type selector */}
      <div className="flex gap-1">
        {(["file", "microphone", "browser"] as AudioSourceType[]).map((type) => (
          <button
            key={type}
            onClick={() => setSourceType(type)}
            className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
              sourceType === type
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {type === "file" ? "MP3/WAV" : type === "microphone" ? "Mic" : "Browser"}
          </button>
        ))}
      </div>

      {/* Source-specific controls */}
      {sourceType === "microphone" && (
        <div className="space-y-2">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full bg-zinc-800 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-indigo-500 focus:outline-none"
          >
            {devices.length === 0 && (
              <option value="">No devices found</option>
            )}
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            onClick={onRefreshDevices}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Refresh devices
          </button>
        </div>
      )}

      {sourceType === "file" && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="w-full text-sm text-zinc-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
          />
          <p className="text-xs text-zinc-500">
            Upload MP3, WAV, or other audio files
          </p>
        </div>
      )}

      {sourceType === "browser" && (
        <p className="text-xs text-zinc-500">
          Captures audio from a browser tab. You&apos;ll be prompted to select which tab to capture.
        </p>
      )}

      {/* Start/Stop */}
      <div className="flex gap-2">
        {!isCapturing ? (
          <button
            onClick={sourceType === "file" ? () => fileInputRef.current?.click() : handleStart}
            disabled={sourceType === "microphone" && devices.length === 0}
            className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded transition-colors"
          >
            {sourceType === "file" ? "Load Audio File" : "Start Capture"}
          </button>
        ) : (
          <button
            onClick={onStop}
            className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Status */}
      {isCapturing && (
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-400">
            Capturing from {activeSource === "file" ? "audio file" : activeSource}
          </span>
        </div>
      )}
    </div>
  );
}
