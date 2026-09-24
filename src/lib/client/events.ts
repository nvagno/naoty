// Événements globaux de l'application (raccourcis clavier → composants).
export const SAVE_EVENT = "carnet:save";
export const NOTES_CHANGED_EVENT = "carnet:notes-changed";

export function emit(name: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

export function modKey() {
  return isMac() ? "⌘" : "Ctrl";
}
