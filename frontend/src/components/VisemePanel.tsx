"use client";

import { useCallback, useRef } from "react";
import { VISEME_LABELS, VISEME_COUNT } from "@/types/viseme";

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

interface VisemePanelProps {
  onBaseImageLoad: (img: HTMLImageElement) => void;
  onVisemeImageLoad: (index: number, img: HTMLImageElement) => void;
  activeViseme: number;
  onTestViseme: (index: number) => void;
  loadedVisemeCount: number;
  loadedVisemeSlots: boolean[];
  hasBaseImage: boolean;
}

export default function VisemePanel({
  onBaseImageLoad,
  onVisemeImageLoad,
  activeViseme,
  onTestViseme,
  loadedVisemeCount,
  loadedVisemeSlots,
  hasBaseImage,
}: VisemePanelProps) {
  const baseInputRef = useRef<HTMLInputElement>(null);
  const visemeInputRef = useRef<HTMLInputElement>(null);

  const loadImage = useCallback((file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${file.name}`));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleBaseUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const img = await loadImage(file);
        onBaseImageLoad(img);
      } catch (err) {
        console.error("Failed to load base image:", err);
      }
    },
    [loadImage, onBaseImageLoad]
  );

  const handleVisemeUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const match = file.name.match(/viseme(\d{1,2})\.\w+/i);
        if (match) {
          const index = parseInt(match[1], 10);
          if (index >= 0 && index < VISEME_COUNT) {
            try {
              const img = await loadImage(file);
              onVisemeImageLoad(index, img);
            } catch (err) {
              console.error(`Failed to load ${file.name}:`, err);
            }
          }
        }
      }
    },
    [loadImage, onVisemeImageLoad]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Visemes
        </h2>
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            loadedVisemeCount === VISEME_COUNT
              ? "bg-green-900/50 text-green-400"
              : loadedVisemeCount > 0
              ? "bg-yellow-900/50 text-yellow-400"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {loadedVisemeCount}/{VISEME_COUNT}
        </span>
      </div>

      {/* Upload controls */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => baseInputRef.current?.click()}
            className={`flex-1 text-[11px] py-1 px-2 rounded border transition-colors ${
              hasBaseImage
                ? "border-green-700 bg-green-900/20 text-green-400 hover:bg-green-900/30"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {hasBaseImage ? "Base Face" : "Upload Base Face"}
          </button>
          <button
            onClick={() => visemeInputRef.current?.click()}
            className={`flex-1 text-[11px] py-1 px-2 rounded border transition-colors ${
              loadedVisemeCount === VISEME_COUNT
                ? "border-green-700 bg-green-900/20 text-green-400 hover:bg-green-900/30"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {loadedVisemeCount === VISEME_COUNT ? "Mouths" : "Upload Mouths"}
          </button>
        </div>
        <input
          ref={baseInputRef}
          type="file"
          accept="image/*"
          onChange={handleBaseUpload}
          className="hidden"
        />
        <input
          ref={visemeInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleVisemeUpload}
          className="hidden"
        />
      </div>

      {/* Unified viseme grid: status + tester in one */}
      <div className="grid grid-cols-4 gap-1">
        {VISEME_LABELS.map((label, i) => {
          const loaded = loadedVisemeSlots[i];
          const active = activeViseme === i;
          return (
            <button
              key={i}
              onClick={() => onTestViseme(i)}
              title={`[${i}] ${label} — ${VISEME_DESCRIPTIONS[i]}${loaded ? "" : " (not loaded)"}`}
              className={`relative py-1.5 px-1 text-xs rounded font-medium transition-all ${
                active
                  ? "bg-indigo-600 text-white ring-1 ring-indigo-400"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              {/* Loaded indicator dot */}
              <span
                className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                  loaded
                    ? "bg-green-400"
                    : "bg-zinc-600"
                }`}
              />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-zinc-600">
        Click to test. Green dot = image loaded.
      </p>
    </div>
  );
}
