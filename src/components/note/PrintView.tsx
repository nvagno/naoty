"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { ReadOnlyDoc } from "../editor/ReadOnlyDoc";
import { getNote } from "@/lib/client/api";
import { longDate } from "@/lib/dates";
import type { NoteDetail } from "@/lib/types";

/** Version imprimable d'une note : « Enregistrer au format PDF » depuis la boîte d'impression. */
export function PrintView({ id }: { id: string }) {
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getNote(id)
      .then((n) => {
        setNote(n);
        document.title = `${n.date} ${n.title || "Sans titre"}`;
      })
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    // On laisse aux images le temps de se charger avant d'ouvrir la boîte d'impression.
    const imgs = Array.from(document.images);
    Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r))))).then(() =>
      setTimeout(() => window.print(), 150),
    );
  }, [ready]);

  if (error) return <p className="p-10 text-center text-ink-3">Note introuvable.</p>;
  if (!note) return <p className="p-10 text-center text-ink-3">Préparation…</p>;

  return (
    <div className="mx-auto max-w-[44rem] px-6 py-12 print:p-0">
      <div className="no-print mb-10 flex items-center justify-between rounded-lg border border-line bg-paper-2 px-4 py-3 text-sm text-ink-2">
        <span>Choisissez « Enregistrer au format PDF » comme imprimante.</span>
        <button onClick={() => window.print()} className="btn-primary py-1.5">
          <Printer size={14} /> Imprimer
        </button>
      </div>
      <p className="text-sm text-ink-3 first-letter:uppercase">{longDate(note.date)}</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight text-ink">{note.title || "Sans titre"}</h1>
      {note.tags.length > 0 && <p className="mt-2 text-sm text-ink-3">{note.tags.map((t) => "#" + t).join("  ")}</p>}
      <hr className="my-8 border-line" />
      <ReadOnlyDoc content={note.content} onReady={() => setReady(true)} />
      {note.attachments.filter((a) => !a.mimeType.startsWith("image/")).length > 0 && (
        <div className="mt-10 text-sm">
          <h2 className="mb-2 font-semibold">Pièces jointes</h2>
          <ul className="list-disc pl-5">
            {note.attachments
              .filter((a) => !a.mimeType.startsWith("image/"))
              .map((a) => (
                <li key={a.id}>{a.filename}</li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
