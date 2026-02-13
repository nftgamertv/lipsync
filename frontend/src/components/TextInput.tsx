"use client";

import { useCallback, useState } from "react";

interface TextInputProps {
  onTextSubmit: (text: string) => void;
}

export default function TextInput({ onTextSubmit }: TextInputProps) {
  const [text, setText] = useState("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);
      onTextSubmit(newText);
    },
    [onTextSubmit]
  );

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
        Text Input
      </h2>
      <textarea
        value={text}
        onChange={handleChange}
        rows={3}
        placeholder="Type or paste text for viseme-driven animation..."
        className="w-full bg-zinc-800 text-zinc-200 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-indigo-500 focus:outline-none resize-none placeholder:text-zinc-600"
      />
      <p className="text-xs text-zinc-600">
        Text is converted to viseme sequences and synced with audio
      </p>
    </div>
  );
}
