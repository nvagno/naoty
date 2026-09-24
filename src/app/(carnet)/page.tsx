"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Plus, Search, X } from "lucide-react";
import { useCarnet } from "@/components/AppShell";
import { NotesByDay } from "@/components/NoteList";
import { EmptyState, Kbd, Spinner, useModKey } from "@/components/ui";
import { listNotes } from "@/lib/client/api";
import { longDate, todayKey } from "@/lib/dates";
import { searchTerms } from "@/lib/text";
import type { NoteSummary } from "@/lib/types";

const RECENT = 30;

const noopSubscribe = () => () => {};

export default function HomePage() {
  const { newNote } = useCarnet();
  // Page pré-rendue : la date du jour est calculée dans le navigateur, jamais au moment du build.
  const today = useSyncExternalStore(noopSubscribe, () => longDate(todayKey()), () => "");
  const mod = useModKey();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    listNotes({ q: debounced, limit: debounced ? 100 : RECENT })
      .then((r) => {
        if (cancelled) return;
        setNotes(r.notes);
        setHasMore(r.hasMore);
      })
      .catch(() => !cancelled && setNotes([]));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const terms = searchTerms(debounced);

  return (
    <div className="mx-auto max-w-3xl pt-4 md:pt-10">
      <p className="min-h-5 text-sm text-ink-3 first-letter:uppercase">{today}</p>
      <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight text-ink md:text-[2.75rem]">
        Mon Carnet de Recherche
      </h1>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={newNote} className="btn-primary px-4 py-2.5" title={`${mod}+N ou Alt+N`}>
          <Plus size={17} />
          Nouvelle note
        </button>
        <label className="relative flex flex-1 items-center">
          <Search size={16} className="pointer-events-none absolute left-3.5 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Rechercher…"
            className="input h-11 pl-10 pr-20 text-[15px]"
            aria-label="Rechercher dans le carnet"
          />
          {query ? (
            <button onClick={() => setQuery("")} className="icon-btn absolute right-1.5" aria-label="Effacer la recherche">
              <X size={15} />
            </button>
          ) : (
            <span className="pointer-events-none absolute right-3 hidden sm:inline">
              <Kbd>{mod} K</Kbd>
            </span>
          )}
        </label>
      </div>

      <div className="mt-12">
        {notes === null ? (
          <Spinner />
        ) : notes.length === 0 ? (
          debounced ? (
            <EmptyState>Aucune note ne contient « {debounced} ».</EmptyState>
          ) : (
            <EmptyState>
              <p className="font-serif text-lg text-ink-2">Votre carnet est encore vierge.</p>
              <p className="mt-2">Une idée, une lecture, une question ? Commencez par une première note.</p>
              <button onClick={newNote} className="btn-primary mt-6">
                <Plus size={16} />
                Nouvelle note
              </button>
            </EmptyState>
          )
        ) : (
          <>
            {debounced && (
              <p className="mb-6 text-sm text-ink-3">
                {notes.length}
                {hasMore ? "+" : ""} note{notes.length > 1 ? "s" : ""} pour « {debounced} »
              </p>
            )}
            <NotesByDay notes={notes} terms={terms} />
            {!debounced && hasMore && (
              <div className="mt-10 text-center">
                <Link href="/notes" className="btn-outline">
                  Toutes les notes →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
