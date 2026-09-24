"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { Highlight, Kbd, Modal } from "./ui";
import { listNotes } from "@/lib/client/api";
import { searchTerms } from "@/lib/text";
import { shortDate } from "@/lib/dates";
import type { NoteSummary } from "@/lib/types";

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteSummary[]>([]);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const terms = searchTerms(query);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(
      () => {
        listNotes({ q: query, limit: 8 })
          .then((r) => {
            if (!cancelled) {
              setResults(r.notes);
              setActive(0);
            }
          })
          .catch(() => {});
      },
      query ? 120 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  function close() {
    onClose();
    setQuery("");
  }

  function go(note: NoteSummary) {
    close();
    router.push(`/notes/${note.id}`);
  }

  function showAll() {
    if (!query.trim()) return;
    close();
    router.push(`/notes?q=${encodeURIComponent(query.trim())}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if ((e.metaKey || e.ctrlKey || !results.length) && query.trim()) showAll();
      else if (results[active]) go(results[active]);
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <Modal open={open} onClose={close} label="Rechercher" width="max-w-xl" position="top">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search size={17} className="shrink-0 text-ink-3" />
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Rechercher dans les titres, le contenu, les tags…"
          className="h-14 w-full bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
          aria-label="Rechercher"
        />
      </div>
      <ul ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
        {!query && results.length > 0 && (
          <li className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-ink-3">Récemment</li>
        )}
        {results.map((n, i) => (
          <li key={n.id} data-index={i}>
            <button
              onClick={() => go(n)}
              onMouseMove={() => setActive(i)}
              className={`w-full rounded-lg px-3 py-2.5 text-left ${i === active ? "bg-paper-2" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-serif text-[15px] text-ink">
                  {n.title ? <Highlight text={n.title} terms={terms} /> : <em className="text-ink-3">Sans titre</em>}
                </span>
                <span className="shrink-0 text-xs text-ink-3">{shortDate(n.date)}</span>
              </div>
              {(n.snippet || (!query && n.excerpt)) && (
                <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-2">
                  <Highlight text={n.snippet ?? n.excerpt} terms={terms} />
                </p>
              )}
              {n.tags.length > 0 && query && (
                <p className="mt-0.5 truncate text-xs text-ink-3">
                  <Highlight text={n.tags.map((t) => "#" + t).join("  ")} terms={terms} />
                </p>
              )}
            </button>
          </li>
        ))}
        {query && results.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-ink-3">Aucune note ne contient « {query} ».</li>
        )}
      </ul>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> naviguer <Kbd>
            <CornerDownLeft size={10} className="inline" />
          </Kbd>{" "}
          ouvrir <Kbd>Échap</Kbd> fermer
        </span>
        {query.trim() && (
          <button onClick={showAll} className="hover:text-ink">
            Voir tous les résultats →
          </button>
        )}
      </div>
    </Modal>
  );
}
