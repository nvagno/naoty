"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Check, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../ui";
import { EXCALIDRAW_ASSET_PATH, type DrawingElements } from "./excalidraw";

// Polices locales : à définir avant qu'Excalidraw ne les charge.
window.EXCALIDRAW_ASSET_PATH = EXCALIDRAW_ASSET_PATH;

/** Délai avant de reporter les modifications du dessin dans la note (sauvegarde automatique). */
const SAVE_DELAY = 800;

/** Éditeur Excalidraw en plein écran, au-dessus de la note. */
export default function DrawingCanvas({
  elements,
  dark,
  onSave,
  onDelete,
  onClose,
}: {
  elements: DrawingElements;
  dark: boolean;
  onSave: (elements: DrawingElements) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [initialData] = useState(() => ({ elements: elements as never, scrollToContent: true }));
  const saved = useRef(JSON.stringify(elements.filter((e) => !e.isDeleted)));
  const latest = useRef<DrawingElements | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  function flush() {
    clearTimeout(timer.current);
    if (!latest.current) return;
    const next = latest.current.filter((e) => !e.isDeleted);
    latest.current = null;
    const json = JSON.stringify(next);
    if (json === saved.current) return;
    saved.current = json;
    onSaveRef.current(next);
  }

  // Fermeture de la note pendant le dessin : rien ne doit être perdu.
  useEffect(() => () => flush(), []);

  function close() {
    flush();
    onClose();
  }

  return createPortal(
    <div className="fade-in fixed inset-0 z-40 flex flex-col bg-paper" role="dialog" aria-label="Dessin">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2">
        <span className="text-sm text-ink-3">Dessin · enregistré automatiquement dans la note</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Supprimer
          </button>
          <button type="button" className="btn-primary py-1.5" onClick={close}>
            <Check size={14} /> Terminer
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Excalidraw
            initialData={initialData}
            theme={dark ? "dark" : "light"}
            langCode="fr-FR"
            autoFocus
            UIOptions={{
              // Les images restent des pièces jointes de la note.
              tools: { image: false },
              canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: null },
            }}
            onChange={(els) => {
              latest.current = els as unknown as DrawingElements;
              clearTimeout(timer.current);
              timer.current = setTimeout(flush, SAVE_DELAY);
            }}
          />
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer le dessin ?"
        message="Le dessin sera retiré de la note. L'historique de la note en garde une trace."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => {
          clearTimeout(timer.current);
          latest.current = null;
          onDelete();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>,
    document.body,
  );
}
