// Chargement d'Excalidraw (navigateur uniquement), avec ses polices servies localement.

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

/** Polices copiées par scripts/copy-excalidraw-assets.mjs. */
export const EXCALIDRAW_ASSET_PATH = "/excalidraw/";

export function loadExcalidraw() {
  window.EXCALIDRAW_ASSET_PATH = EXCALIDRAW_ASSET_PATH;
  return import("@excalidraw/excalidraw");
}

/** Éléments Excalidraw tels qu'enregistrés dans la note (sans typage fort : JSON stocké). */
export type DrawingElements = readonly Record<string, unknown>[];
