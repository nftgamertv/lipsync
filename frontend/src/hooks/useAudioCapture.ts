"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { AudioSourceType } from "@/types/viseme";

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface UseAudioCaptureOptions {
  onAudioChunk?: (data: Float32Array) => void;
  chunkSize?: number;
}

export function useAudioCapture(options: UseAudioCaptureOptions = {}) {
  const { onAudioChunk, chunkSize = 1024 } = options;
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [activeSource, setActiveSource] = useState<AudioSourceType | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sampleRate, setSampleRate] = useState(44100);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const onChunkRef = useRef(onAudioChunk);
  onChunkRef.current = onAudioChunk;

  // Enumerate audio input devices
  const refreshDevices = useCallback(async () => {
    try {
      // Need to request permission first to get labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        }));
      setDevices(audioInputs);
    } catch {
      setDevices([]);
    }
  }, []);

  // Stop any active capture
  const stopCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = "";
      audioElementRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsCapturing(false);
    setActiveSource(null);
  }, []);

  // Set up audio processing pipeline
  const setupProcessing = useCallback(
    (ctx: AudioContext, source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode) => {
      // Use ScriptProcessorNode for broad compatibility
      // (AudioWorklet would be better but adds complexity for cross-browser)
      const processor = ctx.createScriptProcessor(chunkSize, 1, 1);
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData);
        onChunkRef.current?.(chunk);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      sourceNodeRef.current = source;
      processorRef.current = processor;
      setSampleRate(ctx.sampleRate);
      setIsCapturing(true);
    },
    [chunkSize]
  );

  // Start capturing from microphone
  const startMicrophone = useCallback(
    async (deviceId?: string) => {
      stopCapture();

      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false }
          : { echoCancellation: false, noiseSuppression: false },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      setupProcessing(ctx, source);
      setActiveSource("microphone");
    },
    [stopCapture, setupProcessing]
  );

  // Start capturing from an audio file (MP3/WAV)
  const startFile = useCallback(
    async (file: File) => {
      stopCapture();

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      // Ensure AudioContext is active (browsers suspend until user gesture)
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const audioEl = new Audio();
      audioEl.src = URL.createObjectURL(file);
      audioEl.loop = false;
      audioElementRef.current = audioEl;

      const source = ctx.createMediaElementSource(audioEl);
      setupProcessing(ctx, source);
      setActiveSource("file");

      audioEl.onended = () => {
        stopCapture();
      };

      await audioEl.play();
    },
    [stopCapture, setupProcessing]
  );

  // Start capturing browser/tab audio (requires getDisplayMedia)
  const startBrowserAudio = useCallback(async () => {
    stopCapture();

    // getDisplayMedia with audio captures tab/system audio
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: false, // We only want audio
    });
    streamRef.current = stream;

    // Check if we actually got audio tracks
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("No audio track captured. Make sure to select a tab with audio.");
    }

    // Stop video tracks if any were added
    stream.getVideoTracks().forEach((t) => t.stop());

    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    setupProcessing(ctx, source);
    setActiveSource("browser");
  }, [stopCapture, setupProcessing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    devices,
    activeSource,
    isCapturing,
    sampleRate,
    refreshDevices,
    startMicrophone,
    startFile,
    startBrowserAudio,
    stopCapture,
  };
}
