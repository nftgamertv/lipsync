"use client";

import { VISEME_LABELS } from "@/types/viseme";

interface VisemeTesterProps {
  activeViseme: number;
  onTestViseme: (index: number) => void;
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

export default function VisemeTester({
  activeViseme,
  onTestViseme,
}: VisemeTesterProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
        Viseme Tester
      </h2>
      <div className="grid grid-cols-4 gap-1.5">
        {VISEME_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => onTestViseme(i)}
            title={VISEME_DESCRIPTIONS[i]}
            className={`py-1.5 px-1 text-xs rounded font-medium transition-all ${
              activeViseme === i
                ? "bg-indigo-600 text-white ring-1 ring-indigo-400"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
