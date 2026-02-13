"use client";

import { useCallback } from "react";
import type { CalibrationState } from "@/types/viseme";

interface CalibrationPanelProps {
  calibration: CalibrationState;
  onChange: (cal: Partial<CalibrationState>) => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  format?: (val: number) => string;
}

function SliderRow({ label, value, min, max, step, onChange, format }: SliderRowProps) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-500 tabular-nums">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
}

export default function CalibrationPanel({
  calibration,
  onChange,
}: CalibrationPanelProps) {
  const handleReset = useCallback(() => {
    onChange({
      mouthX: 0.5,
      mouthY: 0.7,
      mouthScale: 1.0,
      opacity: 1.0,
      displayScale: 1.0,
    });
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Calibration
        </h2>
        <button
          onClick={handleReset}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="space-y-2">
        <SliderRow
          label="Mouth X"
          value={calibration.mouthX}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => onChange({ mouthX: v })}
        />
        <SliderRow
          label="Mouth Y"
          value={calibration.mouthY}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => onChange({ mouthY: v })}
        />
        <SliderRow
          label="Mouth Scale"
          value={calibration.mouthScale}
          min={0.1}
          max={3.0}
          step={0.05}
          onChange={(v) => onChange({ mouthScale: v })}
          format={(v) => `${v.toFixed(2)}x`}
        />
        <SliderRow
          label="Opacity"
          value={calibration.opacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onChange({ opacity: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="Display Scale"
          value={calibration.displayScale}
          min={0.1}
          max={3.0}
          step={0.05}
          onChange={(v) => onChange({ displayScale: v })}
          format={(v) => `${v.toFixed(2)}x`}
        />
      </div>

      <p className="text-xs text-zinc-600">
        Click on the canvas to position the mouth center
      </p>
    </div>
  );
}
