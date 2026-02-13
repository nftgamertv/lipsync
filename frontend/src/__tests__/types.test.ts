import { VISEME_LABELS, VISEME_COUNT } from "@/types/viseme";
import type {
  VisemeState,
  CalibrationState,
  SyncMode,
  AudioSourceType,
} from "@/types/viseme";

describe("Viseme types and constants", () => {
  test("VISEME_COUNT is 12", () => {
    expect(VISEME_COUNT).toBe(12);
  });

  test("VISEME_LABELS has 12 entries", () => {
    expect(VISEME_LABELS).toHaveLength(12);
  });

  test("expected label values", () => {
    expect(VISEME_LABELS[0]).toBe("Neutral");
    expect(VISEME_LABELS[1]).toBe("Aa");
    expect(VISEME_LABELS[2]).toBe("D");
    expect(VISEME_LABELS[3]).toBe("Ee");
    expect(VISEME_LABELS[4]).toBe("F");
    expect(VISEME_LABELS[5]).toBe("L");
    expect(VISEME_LABELS[6]).toBe("M");
    expect(VISEME_LABELS[7]).toBe("Oh");
    expect(VISEME_LABELS[8]).toBe("R");
    expect(VISEME_LABELS[9]).toBe("S");
    expect(VISEME_LABELS[10]).toBe("Uh");
    expect(VISEME_LABELS[11]).toBe("W-Oo");
  });

  test("VisemeState type shape", () => {
    const state: VisemeState = {
      current_viseme: 0,
      target_viseme: 3,
      blend_factor: 0.5,
      label: "Ee",
    };
    expect(state.current_viseme).toBe(0);
    expect(state.target_viseme).toBe(3);
    expect(state.blend_factor).toBe(0.5);
    expect(state.label).toBe("Ee");
  });

  test("CalibrationState defaults", () => {
    const cal: CalibrationState = {
      mouthX: 0.5,
      mouthY: 0.7,
      mouthScale: 1.0,
      opacity: 1.0,
      displayScale: 1.0,
    };
    expect(cal.mouthX).toBe(0.5);
    expect(cal.mouthY).toBe(0.7);
  });

  test("SyncMode values", () => {
    const modes: SyncMode[] = ["hybrid", "audio_only", "text_only"];
    expect(modes).toHaveLength(3);
  });

  test("AudioSourceType values", () => {
    const sources: AudioSourceType[] = ["microphone", "file", "browser"];
    expect(sources).toHaveLength(3);
  });
});
