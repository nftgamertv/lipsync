"use client";

import { useEffect, useRef } from "react";
import { VISEME_LABELS } from "@/types/viseme";
import type { VisemeState, SyncMode, AudioSourceType } from "@/types/viseme";

export interface VisemeLogEntry {
  ts: number; // performance.now()
  state: VisemeState;
}

const VISEME_DESCRIPTIONS = [
  "Rest/silence",
  "Wide open (cat)",
  "Tongue ridge (d,t,n)",
  "Wide smile (see)",
  "Lip/teeth (f,v)",
  "Tongue up (l)",
  "Lips pressed (m,b,p)",
  "Rounded (boat)",
  "Pucker (r)",
  "Teeth narrow (s,z)",
  "Slightly open (uh)",
  "Pursed (w,oo)",
];

interface DebugPanelProps {
  lastState: VisemeState | null;
  eventLog: VisemeLogEntry[];
  inputText: string;
  sampleRate: number;
  isActive: boolean;
  wsConnected: boolean;
  mode: SyncMode;
  fps: number;
  activeSource: AudioSourceType | null;
  chunkCount?: number;
}

function Bar({ value, max = 1, color = "bg-indigo-500" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-2 flex-1 bg-zinc-800 rounded-sm overflow-hidden">
      <div className={`h-full ${color} transition-all duration-75`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatTs(ts: number, refTs: number): string {
  const delta = ts - refTs;
  if (delta < 0) return "0.000";
  const sec = delta / 1000;
  return sec.toFixed(3);
}

export default function DebugPanel({
  lastState,
  eventLog,
  inputText,
  sampleRate,
  isActive,
  wsConnected,
  mode,
  fps,
  activeSource,
  chunkCount = 0,
}: DebugPanelProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the event log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [eventLog.length]);

  const target = lastState?.target_viseme ?? 0;
  const current = lastState?.current_viseme ?? 0;
  const blend = lastState?.blend_factor ?? 0;
  const energy = lastState?.energy ?? 0;
  const onset = lastState?.is_onset ?? false;
  const bands = lastState?.bands ?? { low: 0, mid: 0, high: 0 };
  const refTs = eventLog.length > 0 ? eventLog[0].ts : 0;

  return (
    <div className="bg-zinc-900 border-t border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-hidden flex flex-col" style={{ height: 220 }}>
      <div className="flex flex-1 min-h-0">
        {/* Left: Live State + Audio Analysis */}
        <div className="w-64 border-r border-zinc-800 p-2 space-y-2 overflow-y-auto shrink-0">
          {/* System */}
          <div className="space-y-0.5">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider">System</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span className="text-zinc-500">Mode</span>
              <span>{mode}</span>
              <span className="text-zinc-500">Source</span>
              <span>{activeSource ?? "none"}</span>
              <span className="text-zinc-500">Rate</span>
              <span>{sampleRate} Hz</span>
              <span className="text-zinc-500">FPS</span>
              <span>{fps}</span>
              <span className="text-zinc-500">WS</span>
              <span className={wsConnected ? "text-green-400" : "text-red-400"}>
                {wsConnected ? "connected" : "disconnected"}
              </span>
              <span className="text-zinc-500">State</span>
              <span className={isActive ? "text-green-400" : "text-zinc-500"}>
                {isActive ? "active" : "stopped"}
              </span>
              <span className="text-zinc-500">Chunks</span>
              <span className={chunkCount > 0 ? "text-green-400" : "text-zinc-500"}>
                {chunkCount}
              </span>
            </div>
          </div>

          {/* Active Viseme */}
          <div className="space-y-0.5">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider">Active Viseme</div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[11px] font-bold">
                [{target}] {VISEME_LABELS[target]}
              </span>
              {onset && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Onset detected" />
              )}
            </div>
            <div className="text-zinc-500 text-[10px]">{VISEME_DESCRIPTIONS[target]}</div>
          </div>

          {/* Blend */}
          <div className="space-y-0.5">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider">Blend</div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 w-10">[{current}]{VISEME_LABELS[current]?.substring(0, 2)}</span>
              <Bar value={blend} color="bg-indigo-500" />
              <span className="text-zinc-500 w-10 text-right">[{target}]{VISEME_LABELS[target]?.substring(0, 2)}</span>
            </div>
            <div className="text-zinc-500 text-[10px] text-center">{blend.toFixed(3)}</div>
          </div>

          {/* Energy */}
          <div className="space-y-0.5">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider">Energy</div>
            <div className="flex items-center gap-2">
              <Bar value={energy} color={energy > 0.7 ? "bg-red-500" : energy > 0.4 ? "bg-yellow-500" : "bg-green-500"} />
              <span className="w-8 text-right">{energy.toFixed(2)}</span>
            </div>
          </div>

          {/* Frequency Bands */}
          <div className="space-y-0.5">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider">Bands</div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 w-6">Low</span>
                <Bar value={bands.low} color="bg-blue-500" />
                <span className="w-6 text-right">{bands.low.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 w-6">Mid</span>
                <Bar value={bands.mid} color="bg-cyan-500" />
                <span className="w-6 text-right">{bands.mid.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 w-6">Hi</span>
                <Bar value={bands.high} color="bg-purple-500" />
                <span className="w-6 text-right">{bands.high.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Text + Viseme Mapping */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-800">
          {/* Input text */}
          <div className="p-2 border-b border-zinc-800 shrink-0">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider mb-1">Input Text</div>
            {inputText ? (
              <div className="text-zinc-200 text-xs leading-relaxed break-words max-h-12 overflow-y-auto">
                {inputText}
              </div>
            ) : (
              <div className="text-zinc-600 text-[10px] italic">No text submitted</div>
            )}
          </div>

          {/* Viseme heatmap — shows how often each viseme has fired recently */}
          <div className="p-2 border-b border-zinc-800 shrink-0">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider mb-1">Viseme Activity</div>
            <div className="flex gap-0.5">
              {VISEME_LABELS.map((label, i) => {
                const recentCount = eventLog.slice(-100).filter((e) => e.state.target_viseme === i).length;
                const intensity = Math.min(1, recentCount / 20);
                const isActive = target === i;
                return (
                  <div
                    key={i}
                    title={`[${i}] ${label}: ${recentCount} recent hits`}
                    className={`flex-1 text-center py-0.5 rounded-sm text-[9px] transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-zinc-500"
                    }`}
                    style={
                      !isActive
                        ? { backgroundColor: `rgba(99, 102, 241, ${intensity * 0.4})` }
                        : undefined
                    }
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character-to-viseme mapping visualization */}
          <div className="p-2 flex-1 min-h-0 overflow-y-auto">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider mb-1">Text-to-Viseme Map</div>
            {inputText ? (
              <div className="flex flex-wrap gap-0.5">
                {inputText.split("").map((char, ci) => {
                  // Find events that reference this character position (if available)
                  // For now, show each character with its likely viseme mapping
                  const isSpace = char === " ";
                  return (
                    <span
                      key={ci}
                      className={`inline-block px-0.5 rounded-sm text-[10px] ${
                        isSpace
                          ? "w-1.5"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                      title={`char: "${char}"`}
                    >
                      {isSpace ? "" : char}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="text-zinc-600 text-[10px] italic">
                Enter text to see character-to-viseme mapping
              </div>
            )}
          </div>
        </div>

        {/* Right: Event Timeline */}
        <div className="w-80 flex flex-col shrink-0">
          <div className="p-2 border-b border-zinc-800 shrink-0 flex items-center justify-between">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider">Event Log</div>
            <span className="text-zinc-600 text-[9px]">{eventLog.length} events</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {eventLog.length === 0 ? (
              <div className="text-zinc-600 text-[10px] italic p-1">
                Waiting for viseme events...
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="flex gap-1 text-zinc-600 text-[9px] px-1 mb-0.5 sticky top-0 bg-zinc-900">
                  <span className="w-12">Time</span>
                  <span className="w-16">Viseme</span>
                  <span className="w-10 text-right">Energy</span>
                  <span className="w-10 text-right">Blend</span>
                  <span className="w-6 text-center">On</span>
                  <span className="flex-1">Bands</span>
                </div>
                {eventLog.map((entry, i) => {
                  const s = entry.state;
                  const b = s.bands ?? { low: 0, mid: 0, high: 0 };
                  return (
                    <div
                      key={i}
                      className={`flex gap-1 px-1 py-px rounded-sm text-[10px] ${
                        s.is_onset ? "bg-red-900/20" : i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-900/50"
                      }`}
                    >
                      <span className="w-12 text-zinc-500">{formatTs(entry.ts, refTs)}</span>
                      <span className="w-16 text-indigo-400">
                        [{s.target_viseme}] {VISEME_LABELS[s.target_viseme]}
                      </span>
                      <span className="w-10 text-right text-zinc-400">{(s.energy ?? 0).toFixed(2)}</span>
                      <span className="w-10 text-right text-zinc-400">{s.blend_factor.toFixed(2)}</span>
                      <span className="w-6 text-center">
                        {s.is_onset ? <span className="text-red-400">*</span> : <span className="text-zinc-700">-</span>}
                      </span>
                      <span className="flex-1 text-zinc-500 truncate">
                        {b.low.toFixed(1)}/{b.mid.toFixed(1)}/{b.high.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
