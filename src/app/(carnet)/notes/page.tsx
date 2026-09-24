"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Highlighter, Search, X } from "lucide-react";
import { NotesByDay } from "@/components/NoteList";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { listNotes } from "@/lib/client/api";
import { searchTerms } from "@/lib/text";
import type { NoteSummary } from "@/lib/types";

const PAGE = 100;

function AllNotes() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? "";
  const important = params.get("important") === "1";

  const [input, setInput] = useState(q);
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const s = next.toString();
    router.replace(s ? `/notes?${s}` : "/notes", { scroll: false });
  }

  // URL → champ (ex. « Voir tous les résultats » depuis la recherche rapide)
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    if (q !== input.trim()) setInput(q);
  }

  // Champ de recherche → URL (après une courte pause)
  useEffect(() => {
    if (input.trim() === q) return;
    const t = setTimeout(() => setParam("q", input.trim() || null), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    listNotes({ q, tag, important, limit: PAGE })
      .then((r) => {
        if (cancelled) return;
        setNotes(r.notes);
        setHasMore(r.hasMore);
      })
      .catch(() => !cancelled && setNotes([]));
    return () => {
      cancelled = true;
    };
  }, [q, tag, important]);

  async function loadMore() {
    if (!notes) return;
    setLoadingMore(true);
    try {
      const r = await listNotes({ q, tag, important, limit: PAGE, offset: notes.length });
      setNotes([...notes, ...r.notes]);
      setHasMore(r.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = q || tag || important;

  return (
    <div className="mx-auto max-w-3xl pt-4">
      <PageHeader
        title={tag ? `#${tag}` : q ? "Recherche" : "Toutes les notes"}
        subtitle={
          notes
            ? `${notes.length}${hasMore ? "+" : ""} note${notes.length > 1 ? "s" : ""}${q ? ` contenant « ${q} »` : ""}`
            : " "
        }
      />

      <div className="mb-10 flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-56 flex-1 items-center">
          <Search size={15} className="pointer-events-none absolute left-3 text-ink-3" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Filtrer par mot ou expression…"
            className="input pl-9"
            aria-label="Rechercher"
          />
        </label>
        {tag && (
          <button onClick={() => setParam("tag", null)} className="btn-outline py-1.5 text-xs">
            #{tag} <X size={12} />
          </button>
        )}
        <button
          onClick={() => setParam("important", important ? null : "1")}
          aria-pressed={important}
          className={`btn-outline py-1.5 text-xs ${important ? "border-marker/40 bg-marker-soft text-marker hover:bg-marker-soft hover:text-marker" : ""}`}
        >
          <Highlighter size={13} /> Importantes
        </button>
      </div>

      {notes === null ? (
        <Spinner />
      ) : notes.length === 0 ? (
        <EmptyState>{filtered ? "Aucune note ne correspond à ces critères." : "Aucune note pour le moment."}</EmptyState>
      ) : (
        <>
          <NotesByDay notes={notes} terms={searchTerms(q)} />
          {hasMore && (
            <div className="mt-10 text-center">
              <button onClick={loadMore} disabled={loadingMore} className="btn-outline">
                {loadingMore ? "Chargement…" : "Afficher plus de notes"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AllNotes />
    </Suspense>
  );
}
