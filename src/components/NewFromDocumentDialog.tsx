"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Modal, ModalHeader } from "./ui";
import { createDigest, getAlbertSettings, type AlbertSettings } from "@/lib/client/api";
import { DIGEST_EXTENSIONS } from "@/lib/digest";

/** Nouvelle fiche de révision : on téléverse un document, Albert en extrait l'essentiel, expliqué pour un étudiant de L1. */
export function NewFromDocumentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Fiche de révision depuis un document" width="max-w-xl" position="top">
      {/* Remonté à chaque ouverture : la fenêtre repart vide, et la fermeture annule la génération. */}
      {open && <DialogBody onClose={onClose} />}
    </Modal>
  );
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

const isSupported = (name: string) => DIGEST_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

function DialogBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [settings, setSettings] = useState<AlbertSettings | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [attach, setAttach] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    getAlbertSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const busy = startedAt !== null;

  function choose(f: File | undefined) {
    if (!f || busy) return;
    setError(isSupported(f.name) ? "" : "Format non pris en charge : PDF, Word (.docx), texte, Markdown ou HTML.");
    setFile(f);
  }

  async function generate() {
    if (!file || !isSupported(file.name) || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setElapsed(0);
    setStartedAt(Date.now());
    try {
      const { id } = await createDigest(file, attach, controller.signal);
      onClose();
      router.push(`/notes/${id}`);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Création de la fiche impossible.");
      setStartedAt(null);
    }
  }

  return (
    <>
      <ModalHeader title="Fiche de révision depuis un document" onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
        className="max-h-[calc(80vh-3rem)] space-y-4 overflow-y-auto p-5"
      >
        <p className="text-sm leading-relaxed text-ink-2">
          Albert lit le document et en tire une fiche : idées essentielles, notions clés, raisonnement, exemple, pièges et questions
          de vérification, expliqués simplement, comme pour un étudiant de L1.
        </p>

        {settings && !settings.configured && (
          <p className="rounded-lg border border-line bg-paper-2 px-4 py-3 text-sm text-ink-2">
            Renseignez d&apos;abord votre clé d&apos;API Albert dans les{" "}
            <Link href="/parametres" onClick={onClose} className="font-medium text-ink underline underline-offset-2">
              paramètres
            </Link>
            .
          </p>
        )}

        <input
          ref={input}
          type="file"
          accept={DIGEST_EXTENSIONS.join(",")}
          hidden
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          data-autofocus
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files[0]);
          }}
          className={`flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-center transition-colors disabled:opacity-60 ${
            dragging ? "border-accent bg-accent-soft" : "border-line hover:bg-paper-2"
          }`}
        >
          <FileUp size={20} className="text-ink-3" />
          {file ? (
            <>
              <span className="break-all text-sm font-medium text-ink">{file.name}</span>
              <span className="text-xs text-ink-3">{formatSize(file.size)} · cliquer pour changer</span>
            </>
          ) : (
            <>
              <span className="text-sm text-ink">Choisir un document ou le déposer ici</span>
              <span className="text-xs text-ink-3">PDF, Word (.docx), texte, Markdown ou HTML</span>
            </>
          )}
        </button>

        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} disabled={busy} />
          Joindre le document à la note
        </label>

        {busy && (
          <p className="text-sm text-ink-3" role="status">
            {elapsed < 4 ? "Lecture du document…" : "Albert rédige la fiche…"} {elapsed > 0 && <span className="tabular-nums">({elapsed} s)</span>}
            <span className="mt-1 block text-xs">Comptez une à deux minutes, davantage pour un long document.</span>
          </p>
        )}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !file || !isSupported(file.name) || settings?.configured === false}>
            {busy ? "Génération…" : "Créer la fiche"}
          </button>
        </div>
      </form>
    </>
  );
}
