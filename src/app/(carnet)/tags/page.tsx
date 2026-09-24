"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { createTag, deleteTag, listTags, renameTag } from "@/lib/client/api";
import type { TagInfo } from "@/lib/types";

function TagRow({ tag, onRenamed, onDelete }: { tag: TagInfo; onRenamed: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);

  async function save() {
    if (name.trim() && name.trim() !== tag.name) {
      await renameTag(tag.id, name).catch(() => {});
      onRenamed();
    }
    setEditing(false);
  }

  return (
    <li className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-paper-2">
      {editing ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <span className="text-ink-3">#</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setName(tag.name);
                setEditing(false);
              }
            }}
            className="input py-1"
            aria-label="Nouveau nom du tag"
          />
          <button type="submit" className="icon-btn" aria-label="Valider">
            <Check size={15} />
          </button>
          <button type="button" onClick={() => setEditing(false)} className="icon-btn" aria-label="Annuler">
            <X size={15} />
          </button>
        </form>
      ) : (
        <>
          <Link href={`/notes?tag=${encodeURIComponent(tag.name)}`} className="flex flex-1 items-baseline gap-3">
            <span className="text-[15px] text-ink">#{tag.name}</span>
            <span className="text-xs text-ink-3">
              {tag.count} note{tag.count > 1 ? "s" : ""}
            </span>
          </Link>
          <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button onClick={() => setEditing(true)} className="icon-btn" aria-label={`Renommer #${tag.name}`} title="Renommer">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="icon-btn hover:text-danger" aria-label={`Supprimer #${tag.name}`} title="Supprimer">
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </li>
  );
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagInfo[] | null>(null);
  const [newTag, setNewTag] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TagInfo | null>(null);

  const load = () =>
    listTags()
      .then(setTags)
      .catch(() => setTags([]));

  useEffect(() => {
    load();
  }, []);

  const max = Math.max(1, ...(tags ?? []).map((t) => t.count));

  return (
    <div className="mx-auto max-w-3xl pt-4">
      <PageHeader title="Tags" subtitle={tags ? `${tags.length} tag${tags.length > 1 ? "s" : ""}` : " "} />

      <form
        className="mb-10 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newTag.trim()) return;
          await createTag(newTag).catch(() => {});
          setNewTag("");
          load();
        }}
      >
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Nouveau tag (ex. terrain, à-vérifier)"
          className="input"
          aria-label="Nouveau tag"
        />
        <button className="btn-outline shrink-0" type="submit">
          <Plus size={15} /> Créer
        </button>
      </form>

      {tags === null ? (
        <Spinner />
      ) : tags.length === 0 ? (
        <EmptyState>Aucun tag. Ajoutez-en depuis une note ou créez-en un ci-dessus.</EmptyState>
      ) : (
        <>
          <div className="mb-10 flex flex-wrap gap-x-4 gap-y-2 leading-relaxed">
            {tags
              .filter((t) => t.count > 0)
              .map((t) => (
                <Link
                  key={t.id}
                  href={`/notes?tag=${encodeURIComponent(t.name)}`}
                  className="text-ink-2 transition-colors hover:text-ink"
                  style={{ fontSize: `${0.9 + (t.count / max) * 0.6}rem` }}
                >
                  #{t.name}
                </Link>
              ))}
          </div>
          <ul className="divide-y divide-line/60">
            {tags.map((t) => (
              <TagRow key={t.id + t.name} tag={t} onRenamed={load} onDelete={() => setPendingDelete(t)} />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Supprimer #${pendingDelete?.name} ?`}
        message={
          pendingDelete?.count
            ? `Le tag sera retiré de ${pendingDelete.count} note${pendingDelete.count > 1 ? "s" : ""}. Les notes elles-mêmes ne sont pas supprimées.`
            : "Ce tag n'est utilisé par aucune note."
        }
        confirmLabel="Supprimer le tag"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteTag(pendingDelete.id).catch(() => {});
          load();
        }}
      />
    </div>
  );
}
