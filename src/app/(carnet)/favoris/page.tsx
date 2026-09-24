"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { NotesByDay } from "@/components/NoteList";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { listNotes } from "@/lib/client/api";
import type { NoteSummary } from "@/lib/types";

export default function FavoritesPage() {
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);

  useEffect(() => {
    listNotes({ favorite: true, limit: 1000 })
      .then((r) => setNotes(r.notes))
      .catch(() => setNotes([]));
  }, []);

  return (
    <div className="mx-auto max-w-3xl pt-4">
      <PageHeader
        title="Favoris"
        subtitle={notes ? `${notes.length} note${notes.length > 1 ? "s" : ""} à garder sous la main` : " "}
      />
      {notes === null ? (
        <Spinner />
      ) : notes.length === 0 ? (
        <EmptyState>
          Aucune note favorite pour l&apos;instant.
          <br />
          Cliquez sur l&apos;étoile <Star size={13} className="inline -translate-y-px" /> d&apos;une note pour la retrouver ici.
        </EmptyState>
      ) : (
        <NotesByDay
          notes={notes}
          onChange={(n) => !n.favorite && setNotes((list) => list?.filter((x) => x.id !== n.id) ?? null)}
        />
      )}
    </div>
  );
}
