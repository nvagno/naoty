"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Highlighter, Star } from "lucide-react";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { listNotes } from "@/lib/client/api";
import { groupBy, monthKeyOf, monthLabel, shortDate } from "@/lib/dates";
import type { NoteSummary } from "@/lib/types";

async function fetchAll(): Promise<NoteSummary[]> {
  const all: NoteSummary[] = [];
  for (;;) {
    const r = await listNotes({ limit: 1000, offset: all.length });
    all.push(...r.notes);
    if (!r.hasMore) return all;
  }
}

export default function ChronologyPage() {
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [oldestFirst, setOldestFirst] = useState(false);

  useEffect(() => {
    fetchAll()
      .then(setNotes)
      .catch(() => setNotes([]));
  }, []);

  const months = useMemo(() => {
    if (!notes) return [];
    const sorted = oldestFirst ? [...notes].reverse() : notes;
    return groupBy(sorted, (n) => monthKeyOf(n.date)).map((m) => ({
      key: m.key,
      count: m.items.length,
      days: groupBy(m.items, (n) => n.date),
    }));
  }, [notes, oldestFirst]);

  const years = useMemo(() => groupBy(months, (m) => m.key.slice(0, 4)), [months]);

  return (
    <div className="mx-auto flex max-w-5xl gap-12 pt-4">
      <div className="min-w-0 flex-1">
        <PageHeader
          title="Chronologie"
          subtitle="L'évolution de votre réflexion, au fil des jours."
        >
          {notes && notes.length > 1 && (
            <button onClick={() => setOldestFirst((o) => !o)} className="btn-ghost text-xs">
              <ArrowDownUp size={14} />
              {oldestFirst ? "Du plus ancien au plus récent" : "Du plus récent au plus ancien"}
            </button>
          )}
        </PageHeader>

        {notes === null ? (
          <Spinner />
        ) : notes.length === 0 ? (
          <EmptyState>Votre chronologie se construira au fil de vos notes.</EmptyState>
        ) : (
          <div className="space-y-14">
            {months.map((m) => (
              <section key={m.key} id={`mois-${m.key}`} className="scroll-mt-20">
                <h2 className="mb-6 flex items-baseline gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink">
                  {monthLabel(m.key)}
                  <span className="text-xs font-normal normal-case tracking-normal text-ink-3">
                    {m.count} note{m.count > 1 ? "s" : ""}
                  </span>
                </h2>
                <ol className="relative ml-1.5 space-y-7 border-l border-line pl-7">
                  {m.days.map((d) => (
                    <li key={d.key} className="relative">
                      <span className="absolute -left-[33px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-ink-3" />
                      <div className="mb-1.5 text-sm text-ink-3">{shortDate(d.key)}</div>
                      <ul className="space-y-1.5">
                        {d.items.map((n) => (
                          <li key={n.id}>
                            <Link
                              href={`/notes/${n.id}`}
                              className={`group -mx-2 flex items-baseline gap-2 rounded-md px-2 py-1 hover:bg-paper-2 ${
                                n.important ? "bg-marker-soft/70" : ""
                              }`}
                            >
                              {n.important && <Highlighter size={12} className="shrink-0 text-marker" />}
                              <span className="font-serif text-[1.05rem] text-ink">
                                « {n.title || "Sans titre"} »
                              </span>
                              {n.favorite && <Star size={12} className="shrink-0 text-marker" fill="currentColor" />}
                              {n.tags.length > 0 && (
                                <span className="hidden truncate text-xs text-ink-3 sm:inline">
                                  {n.tags.map((t) => "#" + t).join(" ")}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>

      {years.length > 0 && (
        <nav className="sticky top-20 hidden h-fit w-40 shrink-0 lg:block" aria-label="Aller au mois">
          {years.map((y) => (
            <div key={y.key} className="mb-5">
              <div className="mb-1.5 text-xs font-semibold text-ink">{y.key}</div>
              <ul className="space-y-0.5">
                {y.items.map((m) => (
                  <li key={m.key}>
                    <a
                      href={`#mois-${m.key}`}
                      className="flex justify-between rounded px-2 py-0.5 text-xs text-ink-2 hover:bg-paper-2 hover:text-ink"
                    >
                      <span className="first-letter:uppercase">{monthLabel(m.key).split(" ")[0]}</span>
                      <span className="text-ink-3">{m.count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
