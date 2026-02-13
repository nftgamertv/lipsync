"use client";

import { useCallback, useRef, useState } from "react";
import { VISEME_LABELS, VISEME_COUNT } from "@/types/viseme";

interface AssetUploaderProps {
  onBaseImageLoad: (img: HTMLImageElement) => void;
  onVisemeImageLoad: (index: number, img: HTMLImageElement) => void;
  loadedVisemeCount: number;
  loadedVisemeSlots: boolean[];
}

export default function AssetUploader({
  onBaseImageLoad,
  onVisemeImageLoad,
  loadedVisemeCount,
  loadedVisemeSlots,
}: AssetUploaderProps) {
  const [baseLoaded, setBaseLoaded] = useState(false);
  const [baseName, setBaseName] = useState<string>("");
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
        setBaseLoaded(true);
        setBaseName(file.name);
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
        // Match filenames like viseme0.png, viseme11.webp, etc.
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
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
        Character Assets
      </h2>

      {/* Base face */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Base Face Image</label>
        <input
          ref={baseInputRef}
          type="file"
          accept="image/*"
          onChange={handleBaseUpload}
          className="w-full text-sm text-zinc-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600 file:cursor-pointer"
        />
        {baseLoaded && (
          <p className="text-xs text-green-400">Loaded: {baseName}</p>
        )}
        <p className="text-xs text-zinc-600">PNG with transparent mouth area</p>
      </div>

      {/* Viseme mouths */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Viseme Mouth Images</label>
        <input
          ref={visemeInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleVisemeUpload}
          className="w-full text-sm text-zinc-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600 file:cursor-pointer"
        />
        <p className="text-xs text-zinc-600">
          Select all 12 files (viseme0.png - viseme11.png)
        </p>
      </div>

      {/* Viseme loading status */}
      <div className="space-y-1">
        <p className="text-xs text-zinc-400">
          {loadedVisemeCount}/{VISEME_COUNT} visemes loaded
        </p>
        <div className="grid grid-cols-4 gap-1">
          {VISEME_LABELS.map((label, i) => (
            <div
              key={i}
              className={`text-[10px] px-1.5 py-0.5 rounded text-center ${
                loadedVisemeSlots[i]
                  ? "bg-green-900/50 text-green-400"
                  : "bg-zinc-800 text-zinc-600"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
