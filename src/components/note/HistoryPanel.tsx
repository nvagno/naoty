"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Modal, ModalHeader } from "../ui";
import { ReadOnlyDoc } from "../editor/ReadOnlyDoc";
import { getVersion, listVersions, restoreVersion } from "@/lib/client/api";
import { formatDateTime } from "@/lib/dates";
import type { NoteDetail, VersionInfo } from "@/lib/types";
import type { JSONNode } from "@/lib/text";

export function HistoryPanel({
  noteId,
  open,
  onClose,
  beforeRestore,
  onRestored,
}: {
  noteId: string;
  open: boolean;
  onClose: () => void;
  /** Enregistre les modifications en cours avant de restaurer */
  beforeRestore: () => Promise<void>;
  onRestored: (note: NoteDetail) => void;
}) {
  const [versions, setVersions] = useState<VersionInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; title: string; content: JSONNode } | null>(null);
  const preview = loaded && loaded.id === selected ? loaded : null;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Les modifications en cours sont enregistrées d'abord, pour que l'historique soit à jour.
    beforeRestore()
      .then(() => listVersions(noteId))
      .then((v) => {
        if (cancelled) return;
        setVersions(v);
        setSelected(v[0]?.id ?? null);
      })
      .catch(() => !cancelled && setVersions([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noteId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    getVersion(noteId, selected)
      .then((v) => !cancelled && setLoaded({ id: v.id, title: v.title, content: v.content }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [noteId, selected]);

  async function restore() {
    if (!selected) return;
    setBusy(true);
    try {
      await beforeRestore();
      const note = await restoreVersion(noteId, selected);
      onRestored(note);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label="Historique" width="max-w-5xl">
      <ModalHeader title="Historique des versions" onClose={onClose} />
      {versions && versions.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm leading-relaxed text-ink-3">
          Aucune version antérieure pour l&apos;instant.
          <br />
          Une version est conservée automatiquement toutes les 10 minutes d&apos;écriture,
          <br />
          et à chaque enregistrement manuel (Ctrl+S).
        </p>
      ) : (
        <div className="flex h-[70vh] flex-col md:flex-row">
          <ul className="max-h-40 shrink-0 overflow-y-auto border-b border-line p-2 md:max-h-none md:w-60 md:border-b-0 md:border-r">
            {versions?.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => setSelected(v.id)}
                  className={`w-full rounded-md px-3 py-2 text-left ${selected === v.id ? "bg-paper-2" : "hover:bg-paper-2/60"}`}
                >
                  <div className="text-sm text-ink">{formatDateTime(v.createdAt)}</div>
                  <div className="truncate text-xs text-ink-3">
                    {v.words} mot{v.words > 1 ? "s" : ""} · {v.title || "Sans titre"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {!preview && selected && <p className="text-sm text-ink-3">Chargement…</p>}
              {preview && (
                <>
                  <h1 className="mb-6 font-serif text-2xl font-semibold text-ink">{preview.title || "Sans titre"}</h1>
                  <ReadOnlyDoc content={preview.content} />
                </>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <p className="text-xs text-ink-3">La version actuelle sera conservée dans l&apos;historique.</p>
              <button onClick={restore} disabled={!selected || busy} className="btn-primary">
                <RotateCcw size={14} />
                Restaurer cette version
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
