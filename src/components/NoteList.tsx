"use client";

import Link from "next/link";
import { useState } from "react";
import { Highlighter, Star } from "lucide-react";
import { dayLabel, groupBy } from "@/lib/dates";
import type { NoteSummary } from "@/lib/types";
import { Highlight, TagChip } from "./ui";
import { updateNote } from "@/lib/client/api";

export function NoteCard({
  note,
  terms = [],
  onChange,
}: {
  note: NoteSummary;
  terms?: string[];
  onChange?: (n: NoteSummary) => void;
}) {
  const [favorite, setFavorite] = useState(note.favorite);
  const text = note.snippet ?? note.excerpt;

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    try {
      await updateNote(note.id, { favorite: next });
      onChange?.({ ...note, favorite: next });
    } catch {
      setFavorite(!next);
    }
  }

  return (
    <div
      className={`group relative rounded-lg py-3.5 pr-10 transition-colors hover:bg-paper-2 ${
        note.important ? "border-l-[3px] border-marker bg-marker-soft/60 pl-4" : "pl-[19px]"
      }`}
    >
      <div className="flex items-baseline gap-2">
        {note.important && <Highlighter size={13} className="shrink-0 translate-y-0.5 text-marker" aria-label="Importante" />}
        <h3 className="font-serif text-[1.07rem] font-medium leading-snug text-ink">
          {/* Le lien du titre couvre toute la carte ; tags et étoile restent cliquables au-dessus. */}
          <Link href={`/notes/${note.id}`} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none">
            {note.title ? <Highlight text={note.title} terms={terms} /> : <span className="italic text-ink-3">Sans titre</span>}
          </Link>
        </h3>
      </div>
      {text && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-2">
          <Highlight text={text} terms={terms} />
        </p>
      )}
      {note.tags.length > 0 && (
        <div className="relative z-10 mt-2 flex w-fit flex-wrap gap-1.5">
          {note.tags.map((t) => (
            <TagChip key={t} name={t} />
          ))}
        </div>
      )}
      <button
        onClick={toggleFavorite}
        className={`absolute right-2 top-3 z-10 rounded-md p-1.5 transition ${
          favorite ? "text-marker" : "text-ink-3 opacity-0 hover:text-ink group-hover:opacity-100 focus:opacity-100"
        }`}
        aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        title={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <Star size={15} fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/** Notes regroupées par jour : « Aujourd'hui », « Hier », « 12 septembre »… */
export function NotesByDay({
  notes,
  terms,
  onChange,
}: {
  notes: NoteSummary[];
  terms?: string[];
  onChange?: (n: NoteSummary) => void;
}) {
  // Les notes sont chargées dans le navigateur : les libellés relatifs utilisent l'heure locale.
  const now = new Date();
  const groups = groupBy(notes, (n) => n.date);
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key} className="fade-in">
          <h2 className="mb-1 border-b border-line pb-2 text-xs font-medium uppercase tracking-[0.08em] text-ink-3">
            <time dateTime={g.key}>
              {dayLabel(g.key, now)}
            </time>
          </h2>
          <div className="-mx-1 divide-y divide-line/60">
            {g.items.map((n) => (
              <NoteCard key={n.id} note={n} terms={terms} onChange={onChange} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
