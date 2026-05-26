import { DEFAULT_MAP_URL } from '../config';
import type { AppState } from '../core/app-state';
import type { Viewport } from '../core/viewport';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export async function loadDefaultBackground(
  state: AppState,
  viewport: Viewport,
  canvasW: number,
  canvasH: number,
): Promise<void> {
  state.backgroundImage = await loadImage(DEFAULT_MAP_URL);
  state.usingCustomBackground = false;
  viewport.fitImage(
    state.backgroundImage.width,
    state.backgroundImage.height,
    canvasW,
    canvasH,
    state.settings.mapFit,
  );
}

export async function loadCustomBackground(
  state: AppState,
  viewport: Viewport,
  file: File,
  canvasW: number,
  canvasH: number,
): Promise<string> {
  const url = await blobToDataUrl(file);
  state.backgroundImage = await loadImage(url);
  state.usingCustomBackground = true;
  viewport.fitImage(
    state.backgroundImage.width,
    state.backgroundImage.height,
    canvasW,
    canvasH,
    state.settings.mapFit,
  );
  return url;
}

function blobToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
