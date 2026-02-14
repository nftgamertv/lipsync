/**
 * Persist and restore avatar images to/from localStorage.
 * Images are stored as data URLs so they survive page reloads.
 */

const KEY_BASE = "lipsync_base_image";
const KEY_VISEME_PREFIX = "lipsync_viseme_";
const KEY_CALIBRATION = "lipsync_calibration";

function imgToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  // Use PNG to preserve transparency
  return canvas.toDataURL("image/png");
}

function loadFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function saveBaseImage(img: HTMLImageElement): void {
  try {
    localStorage.setItem(KEY_BASE, imgToDataUrl(img));
  } catch {
    console.warn("Failed to save base image to localStorage (quota exceeded?)");
  }
}

export function saveVisemeImage(index: number, img: HTMLImageElement): void {
  try {
    localStorage.setItem(`${KEY_VISEME_PREFIX}${index}`, imgToDataUrl(img));
  } catch {
    console.warn(`Failed to save viseme ${index} to localStorage (quota exceeded?)`);
  }
}

export async function loadBaseImage(): Promise<HTMLImageElement | null> {
  const dataUrl = localStorage.getItem(KEY_BASE);
  if (!dataUrl) return null;
  try {
    return await loadFromDataUrl(dataUrl);
  } catch {
    return null;
  }
}

export async function loadVisemeImage(index: number): Promise<HTMLImageElement | null> {
  const dataUrl = localStorage.getItem(`${KEY_VISEME_PREFIX}${index}`);
  if (!dataUrl) return null;
  try {
    return await loadFromDataUrl(dataUrl);
  } catch {
    return null;
  }
}

export async function loadAllVisemeImages(): Promise<(HTMLImageElement | null)[]> {
  const results: (HTMLImageElement | null)[] = [];
  for (let i = 0; i < 12; i++) {
    results.push(await loadVisemeImage(i));
  }
  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveCalibration(cal: any): void {
  try {
    localStorage.setItem(KEY_CALIBRATION, JSON.stringify(cal));
  } catch {
    // ignore
  }
}

export function loadCalibration(): Record<string, number> | null {
  const raw = localStorage.getItem(KEY_CALIBRATION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
}

export function clearAllImages(): void {
  localStorage.removeItem(KEY_BASE);
  for (let i = 0; i < 12; i++) {
    localStorage.removeItem(`${KEY_VISEME_PREFIX}${i}`);
  }
}
