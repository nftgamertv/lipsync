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
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
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
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
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

  // Set up audio processing pipeline using AudioWorkletNode
  const setupProcessing = useCallback(
    async (ctx: AudioContext, source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode) => {
      await ctx.audioWorklet.addModule("/audio-chunk-processor.js");

      const workletNode = new AudioWorkletNode(ctx, "audio-chunk-processor", {
        processorOptions: { chunkSize },
      });

      workletNode.port.onmessage = (e: MessageEvent) => {
        const chunk = e.data.chunk as Float32Array;
        onChunkRef.current?.(chunk);
      };

      source.connect(workletNode);
      workletNode.connect(ctx.destination);

      sourceNodeRef.current = source;
      workletNodeRef.current = workletNode;
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
      await setupProcessing(ctx, source);
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
      await setupProcessing(ctx, source);
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

    // getDisplayMedia requires video; we request both then discard video
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true,
    });

    // Immediately stop video tracks — we only need audio
    stream.getVideoTracks().forEach((t) => t.stop());
    streamRef.current = stream;

    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("No audio track captured. Make sure to share a tab with audio enabled.");
    }

    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    await setupProcessing(ctx, source);
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
