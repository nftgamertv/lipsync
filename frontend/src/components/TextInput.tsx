"use client";

import { useCallback, useState } from "react";

interface TextInputProps {
  onTextSubmit: (text: string) => void;
}

export default function TextInput({ onTextSubmit }: TextInputProps) {
  const [text, setText] = useState("");

  const submit = useCallback(() => {
    onTextSubmit(text);
  }, [text, onTextSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
        Text Input
      </h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Type or paste text for viseme-driven animation..."
        className="w-full bg-zinc-800 text-zinc-200 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-indigo-500 focus:outline-none resize-none placeholder:text-zinc-600"
      />
      <button
        onClick={submit}
        className="w-full py-1.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
      >
        Send Text
      </button>
      <p className="text-xs text-zinc-600">
        Press Enter or click Send to submit. Shift+Enter for new line.
      </p>
    </div>
  );
}
