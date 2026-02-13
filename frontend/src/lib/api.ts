const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchVisemes() {
  const res = await fetch(`${API_BASE}/api/visemes`);
  if (!res.ok) throw new Error("Failed to fetch visemes");
  return res.json();
}

export async function processText(text: string, speed: number = 1.0) {
  const res = await fetch(`${API_BASE}/api/process-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speed }),
  });
  if (!res.ok) throw new Error("Failed to process text");
  return res.json();
}

export async function processAudioFile(
  file: Blob,
  mode: string = "audio_only",
  text?: string
) {
  const formData = new FormData();
  formData.append("file", file, "audio.wav");
  formData.append("mode", mode);
  if (text) formData.append("text", text);

  const res = await fetch(`${API_BASE}/api/process-audio`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to process audio");
  return res.json();
}

export async function healthCheck() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend not available");
  return res.json();
}

export function getWebSocketUrl(): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws/audio`;
}
