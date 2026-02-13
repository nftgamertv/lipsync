"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWebSocketUrl } from "@/lib/api";
import type { VisemeState, SyncMode } from "@/types/viseme";

interface UseWebSocketOptions {
  onViseme?: (state: VisemeState) => void;
  autoReconnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onViseme, autoReconnect = true } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVisemeRef = useRef(onViseme);
  onVisemeRef.current = onViseme;

  const connect = useCallback((): Promise<void> => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        const url = getWebSocketUrl();
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          setError(null);
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "viseme" && onVisemeRef.current) {
              onVisemeRef.current(msg as VisemeState);
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (autoReconnect) {
            reconnectTimer.current = setTimeout(connect, 2000);
          }
        };

        ws.onerror = () => {
          setError("WebSocket connection failed");
          ws.close();
          reject(new Error("WebSocket connection failed"));
        };
      } catch (err) {
        setError("Failed to create WebSocket connection");
        reject(err);
      }
    });
  }, [autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const sendConfig = useCallback(
    (sampleRate: number, mode: SyncMode, text?: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        console.warn("[WS] sendConfig called but WebSocket is not open");
        return;
      }
      wsRef.current.send(
        JSON.stringify({
          type: "config",
          sample_rate: sampleRate,
          mode,
          text: text || "",
        })
      );
    },
    []
  );

  const sendAudioChunk = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(data);
  }, []);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] sendText called but WebSocket is not open");
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "text", text }));
  }, []);

  const sendMode = useCallback((mode: SyncMode) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] sendMode called but WebSocket is not open");
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "mode", mode }));
  }, []);

  const sendReset = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "reset" }));
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    error,
    connect,
    disconnect,
    sendConfig,
    sendAudioChunk,
    sendText,
    sendMode,
    sendReset,
  };
}
