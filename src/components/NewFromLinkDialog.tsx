"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal, ModalHeader } from "./ui";
import { createNote, fetchReference, listNotes } from "@/lib/client/api";
import { authorName, parseReferenceInput, publicationLine, referenceToDoc, REF_TYPE_LABELS, type Reference } from "@/lib/reference";
import type { NoteSummary } from "@/lib/types";

type Result = Reference & { sources: string[]; warning?: string };

/** Nouvelle note de lecture : on saisit un lien, un DOI ou un identifiant arXiv, le carnet remplit la référence. */
export function NewFromLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Nouvelle note depuis un lien" width="max-w-xl" position="top">
      {/* Remonté à chaque ouverture : la fenêtre repart vide. */}
      {open && <DialogBody onClose={onClose} />}
    </Modal>
  );
}

function DialogBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [fetchedFor, setFetchedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState<Result | null>(null);
  const [title, setTitle] = useState("");
  const [existing, setExisting] = useState<NoteSummary | null>(null);

  const ready = ref !== null && fetchedFor === input.trim();

  async function lookup() {
    const q = input.trim();
    if (!parseReferenceInput(q)) {
      setError("Saisissez une adresse web (https://…), un DOI (10.…) ou un identifiant arXiv.");
      return;
    }
    setLoading(true);
    setError("");
    setRef(null);
    setExisting(null);
    try {
      const r = await fetchReference(q);
      setRef(r);
      setTitle(r.title);
      setFetchedFor(q);
      // Une note contient déjà ce DOI ou cette adresse ?
      const key = r.doi || r.url;
      const found = await listNotes({ q: key, limit: 1 }).catch(() => null);
      setExisting(found?.notes[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Récupération impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!ref || creating) return;
    setCreating(true);
    try {
      const finalRef = { ...ref, title: title.trim() || ref.title };
      const note = await createNote({ title: finalRef.title, content: referenceToDoc(finalRef) });
      onClose();
      router.push(`/notes/${note.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
      setCreating(false);
    }
  }

  const publication = ref ? [publicationLine(ref) || (ref.type === "web" ? ref.site : ""), ref.date].filter(Boolean).join(" · ") : "";

  return (
    <>
      <ModalHeader title="Nouvelle note depuis un lien" onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) create();
          else lookup();
        }}
        className="max-h-[calc(80vh-3rem)] space-y-4 overflow-y-auto p-5"
      >
        <label className="block">
          <span className="mb-1 block text-xs text-ink-3">Adresse, DOI ou identifiant arXiv</span>
          <div className="flex gap-2">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://… · 10.1000/xyz · arXiv:2401.01234"
              data-autofocus
              inputMode="url"
              spellCheck={false}
            />
            <button type="button" onClick={lookup} className="btn-outline shrink-0" disabled={loading || !input.trim()}>
              {loading ? "Recherche…" : "Récupérer"}
            </button>
          </div>
        </label>

        {loading && <p className="text-sm text-ink-3">Récupération des informations de la publication…</p>}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {ref && !loading && (
          <div className="space-y-3 rounded-lg border border-line p-4">
            <p className="text-xs text-ink-3">
              {REF_TYPE_LABELS[ref.type]}
              {ref.sources.length > 0 && <> · d&apos;après {ref.sources.map((x) => (x === "page" ? "la page web" : x)).join(", ")}</>}
            </p>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-3">Titre de la note</span>
              <input className="input font-serif" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {ref.authors.length > 0 && (
              <p className="text-sm text-ink-2">
                {ref.authors.slice(0, 8).map(authorName).join(", ")}
                {ref.authors.length > 8 && ` et ${ref.authors.length - 8} autres`}
              </p>
            )}
            {publication && <p className="text-xs text-ink-3">{publication}</p>}
            {(ref.doi || ref.arxiv) && (
              <p className="break-all text-xs text-ink-3">
                {ref.doi && <>DOI {ref.doi}</>}
                {ref.doi && ref.arxiv && " · "}
                {ref.arxiv && <>arXiv {ref.arxiv}</>}
              </p>
            )}
            {ref.abstract ? (
              <p className="line-clamp-5 text-sm leading-relaxed text-ink-2">{ref.abstract}</p>
            ) : (
              <p className="text-xs text-ink-3">Pas de résumé disponible.</p>
            )}
            {ref.keywords.length > 0 && <p className="text-xs text-ink-3">Mots-clés : {ref.keywords.join(", ")}</p>}
          </div>
        )}

        {ref?.warning && !loading && <p className="text-xs text-ink-3">{ref.warning} La note sera créée avec les informations disponibles.</p>}
        {existing && !loading && (
          <p className="text-sm text-ink-2">
            Déjà dans le carnet :{" "}
            <Link href={`/notes/${existing.id}`} onClick={onClose} className="font-medium text-ink underline underline-offset-2">
              {existing.title || "Sans titre"}
            </Link>
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={loading || creating || !input.trim()}>
            {ready ? (creating ? "Création…" : "Créer la note") : "Récupérer"}
          </button>
        </div>
      </form>
    </>
  );
}
