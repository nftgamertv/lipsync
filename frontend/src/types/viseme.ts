export interface VisemeDefinition {
  index: number;
  label: string;
  description: string;
}

export interface VisemeState {
  current_viseme: number;
  target_viseme: number;
  blend_factor: number;
  label: string;
  energy?: number;
  is_onset?: boolean;
  bands?: {
    low: number;
    mid: number;
    high: number;
  };
}

export interface VisemeEvent {
  viseme: number;
  duration: number;
  char_source: string;
}

export interface AudioTimelineEntry {
  time_ms: number;
  viseme: number;
  label: string;
  energy: number;
}

export type SyncMode = "hybrid" | "audio_only" | "text_only";

export type AudioSourceType = "microphone" | "file" | "browser";

export interface AudioSource {
  type: AudioSourceType;
  deviceId?: string; // for mic selection
  file?: File; // for MP3/WAV upload
}

export interface CalibrationState {
  mouthX: number;
  mouthY: number;
  mouthScale: number;
  opacity: number;
  displayScale: number;
}

export const VISEME_LABELS = [
  "Neutral", "Aa", "D", "Ee", "F", "L",
  "M", "Oh", "R", "S", "Uh", "W-Oo",
] as const;

export const VISEME_COUNT = 12;
