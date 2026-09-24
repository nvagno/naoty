"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Download, FileDown, Highlighter, History, MoreHorizontal, Printer, Star, Trash2 } from "lucide-react";
import { RichEditor } from "../editor/RichEditor";
import { TagInput } from "./TagInput";
import { Attachments } from "./Attachments";
import { HistoryPanel } from "./HistoryPanel";
import { ConfirmDialog, Spinner, useModKey } from "../ui";
import { deleteNote, getNote, updateNote } from "@/lib/client/api";
import { SAVE_EVENT } from "@/lib/client/events";
import { longDate, shortDate } from "@/lib/dates";
import type { AttachmentInfo, NoteDetail, NotePatch } from "@/lib/types";

type Status = "saved" | "pending" | "saving" | "error";

/** Délai après la dernière frappe avant l'enregistrement automatique. */
const AUTOSAVE_DELAY = 800;

function countWords(editor: Editor) {
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, " ", " ").split(/\s+/).filter(Boolean).length;
}

function SaveStatus({ status }: { status: Status }) {
  const label =
    status === "saved" ? "Enregistré" : status === "error" ? "Non enregistré — nouvel essai…" : "Enregistrement…";
  return (
    <span
      className={`text-xs transition-colors ${status === "error" ? "text-danger" : "text-ink-3"}`}
      role="status"
      aria-live="polite"
    >
      {status !== "saved" && status !== "error" && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3 align-middle" />}
      {label}
    </span>
  );
}

function Menu({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="icon-btn" aria-label="Plus d'actions" aria-expanded={open}>
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div className="fade-in absolute right-0 top-full z-30 mt-1 w-60 rounded-lg border border-line bg-paper p-1 shadow-soft">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-paper-2 ${
                it.danger ? "text-danger" : "text-ink-2 hover:text-ink"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NoteEditor({ id, isNew }: { id: string; isNew: boolean }) {
  const router = useRouter();
  const mod = useModKey();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [important, setImportant] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [status, setStatus] = useState<Status>("saved");
  const [words, setWords] = useState(0);
  const [editorKey, setEditorKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const pending = useRef<NotePatch>({});
  const contentDirty = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deleted = useRef(false);

  const flushRef = useRef<(opts?: { snapshot?: boolean; keepalive?: boolean }) => Promise<void>>(async () => {});

  const hasPending = () => contentDirty.current || Object.keys(pending.current).length > 0;

  function applyNote(n: NoteDetail) {
    setNote(n);
    setTitle(n.title);
    setDate(n.date);
    setTags(n.tags);
    setFavorite(n.favorite);
    setImportant(n.important);
    setAttachments(n.attachments);
  }

  useEffect(() => {
    let cancelled = false;
    getNote(id)
      .then((n) => !cancelled && applyNote(n))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    setStatus((s) => (s === "saving" ? s : "pending"));
    timer.current = setTimeout(() => {
      timer.current = undefined;
      flushRef.current();
    }, AUTOSAVE_DELAY);
  }, []);

  const flush = useCallback(
    async (opts: { snapshot?: boolean; keepalive?: boolean } = {}): Promise<void> => {
      clearTimeout(timer.current);
      timer.current = undefined;
      while (inFlight.current) await inFlight.current;
      if (deleted.current) return;
      const patch: NotePatch = { ...pending.current };
      if (contentDirty.current && editorRef.current) {
        try {
          patch.content = editorRef.current.state.doc.toJSON();
        } catch {}
      }
      if (opts.snapshot) patch.snapshot = true;
      if (!Object.keys(patch).length) {
        setStatus((s) => (s === "error" ? s : "saved"));
        return;
      }
      pending.current = {};
      contentDirty.current = false;
      setStatus("saving");

      const request = updateNote(id, patch, opts.keepalive)
        .then((updated) => {
          setNote((prev) => (prev ? { ...prev, backlinks: updated.backlinks, updatedAt: updated.updatedAt } : updated));
          setStatus(hasPending() ? "pending" : "saved");
        })
        .catch(() => {
          // Les modifications non envoyées sont remises dans la file ; les plus récentes l'emportent.
          const { content, snapshot, ...fields } = patch;
          void snapshot;
          pending.current = { ...fields, ...pending.current };
          if (content) contentDirty.current = true;
          setStatus("error");
          timer.current = setTimeout(() => {
            timer.current = undefined;
            flushRef.current();
          }, 4000);
        });
      inFlight.current = request;
      await request;
      inFlight.current = null;
      if (hasPending() && !timer.current) schedule();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const queue = useCallback(
    (fields: NotePatch, immediate = false) => {
      Object.assign(pending.current, fields);
      if (immediate) flush();
      else schedule();
    },
    [flush, schedule],
  );

  // Ctrl/Cmd+S : enregistrement immédiat et point dans l'historique
  useEffect(() => {
    const onSave = async () => {
      await flush({ snapshot: true });
      setToast("Enregistré");
      setTimeout(() => setToast(null), 1500);
    };
    window.addEventListener(SAVE_EVENT, onSave);
    return () => window.removeEventListener(SAVE_EVENT, onSave);
  }, [flush]);

  // Fermeture de l'onglet : dernier envoi, et avertissement si des modifications restent en attente.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasPending() && !inFlight.current) return;
      flush({ keepalive: true });
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Changement de page dans l'application : on enregistre ce qui reste.
      if (hasPending()) flush();
    };
  }, [flush]);

  useEffect(() => {
    if (note) document.title = `${title || "Sans titre"} · Mon Carnet de Recherche`;
  }, [title, note]);

  // Titre : hauteur automatique, focus sur une nouvelle note
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [title, note]);

  useEffect(() => {
    if (note && isNew) {
      titleRef.current?.focus();
      router.replace(`/notes/${id}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  const onEditorChange = useCallback(
    (editor: Editor) => {
      contentDirty.current = true;
      schedule();
      setWords(countWords(editor));
    },
    [schedule],
  );

  const openNote = useCallback(
    async (target: string) => {
      await flush();
      router.push(`/notes/${target}`);
    },
    [flush, router],
  );

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl py-24 text-center">
        <p className="font-serif text-xl text-ink">Cette note n&apos;existe pas ou a été supprimée.</p>
        <Link href="/" className="btn-outline mt-6">
          Retour au carnet
        </Link>
      </div>
    );
  }
  if (!note) return <Spinner />;

  return (
    <article className="mx-auto max-w-[46rem]">
      {/* Barre d'informations discrète */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <button
          onClick={() => {
            const el = dateInput.current;
            if (!el) return;
            try {
              el.showPicker();
            } catch {
              el.focus();
            }
          }}
          className="relative rounded-md px-1.5 py-0.5 -ml-1.5 text-ink-2 first-letter:uppercase hover:bg-paper-2 hover:text-ink"
          title="Modifier la date de la note"
        >
          {date ? longDate(date) : ""}
          <input
            ref={dateInput}
            type="date"
            value={date}
            onChange={(e) => {
              if (!e.target.value) return;
              setDate(e.target.value);
              queue({ date: e.target.value }, true);
            }}
            className="pointer-events-none absolute inset-0 opacity-0"
            tabIndex={-1}
            aria-label="Date de la note"
          />
        </button>
        <span className="text-ink-3">·</span>
        <SaveStatus status={status} />
        <span className="hidden text-xs text-ink-3 sm:inline">
          · {words} mot{words > 1 ? "s" : ""}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => {
              setFavorite(!favorite);
              queue({ favorite: !favorite }, true);
            }}
            className={`icon-btn ${favorite ? "text-marker hover:text-marker" : ""}`}
            aria-pressed={favorite}
            aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            title={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Star size={16} fill={favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => {
              setImportant(!important);
              queue({ important: !important }, true);
            }}
            className={`icon-btn ${important ? "bg-marker-soft text-marker hover:text-marker" : ""}`}
            aria-pressed={important}
            aria-label={important ? "Ne plus mettre en évidence" : "Mettre en évidence"}
            title={important ? "Ne plus mettre en évidence" : "Mettre en évidence (note importante)"}
          >
            <Highlighter size={16} />
          </button>
          <button onClick={() => setHistoryOpen(true)} className="icon-btn" aria-label="Historique" title="Historique des versions">
            <History size={16} />
          </button>
          <Menu
            items={[
              {
                label: "Exporter en Markdown",
                icon: <FileDown size={15} />,
                onClick: async () => {
                  await flush();
                  const a = document.createElement("a");
                  a.href = `/api/notes/${id}/markdown`;
                  a.download = "";
                  a.click();
                },
              },
              {
                label: "Exporter en PDF",
                icon: <Printer size={15} />,
                onClick: async () => {
                  await flush();
                  window.open(`/imprimer/${id}`, "_blank");
                },
              },
              {
                label: "Enregistrer une version",
                icon: <Download size={15} />,
                onClick: async () => {
                  await flush({ snapshot: true });
                  showToast("Version ajoutée à l'historique");
                },
              },
              {
                label: "Supprimer la note",
                icon: <Trash2 size={15} />,
                danger: true,
                onClick: () => setConfirmDelete(true),
              },
            ]}
          />
        </div>
      </div>

      <textarea
        ref={titleRef}
        value={title}
        rows={1}
        onChange={(e) => {
          const v = e.target.value.replace(/\n/g, " ");
          setTitle(v);
          queue({ title: v });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || (e.key === "ArrowDown" && e.currentTarget.selectionStart === title.length)) {
            e.preventDefault();
            editorRef.current?.commands.focus("start");
          }
        }}
        placeholder="Titre de la note"
        className="w-full resize-none overflow-hidden bg-transparent font-serif text-[2.1rem] font-semibold leading-tight tracking-tight text-ink placeholder:text-ink-3/60 focus:outline-none"
        aria-label="Titre de la note"
      />

      <div className="no-print mb-2 mt-3">
        <TagInput
          tags={tags}
          onChange={(t) => {
            setTags(t);
            queue({ tags: t });
          }}
        />
      </div>

      <RichEditor
        key={editorKey}
        noteId={id}
        content={note.content}
        onChange={onEditorChange}
        onReady={(editor) => {
          editorRef.current = editor;
          setWords(countWords(editor));
        }}
        onAttachment={(a) => setAttachments((list) => [...list, a])}
        onOpenNote={openNote}
        onError={showToast}
      />

      <Attachments items={attachments} onRemoved={(aid) => setAttachments((list) => list.filter((a) => a.id !== aid))} />

      {note.backlinks.length > 0 && (
        <section className="no-print mt-12">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-ink-3">Mentionnée dans</h2>
          <ul className="space-y-1">
            {note.backlinks.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => openNote(b.id)}
                  className="group flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 -mx-2 text-left hover:bg-paper-2"
                >
                  <ArrowUpRight size={13} className="shrink-0 translate-y-0.5 text-ink-3" />
                  <span className="font-serif text-ink">{b.title || "Sans titre"}</span>
                  <span className="text-xs text-ink-3">{shortDate(b.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="no-print mt-16 text-center text-xs text-ink-3">
        Enregistrement automatique · {mod}+S pour créer un point dans l&apos;historique
      </p>

      <HistoryPanel
        noteId={id}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        beforeRestore={() => flush()}
        onRestored={(n) => {
          applyNote(n);
          setEditorKey((k) => k + 1);
          showToast("Version restaurée");
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette note ?"
        message="La note, son historique et ses pièces jointes seront définitivement supprimés."
        confirmLabel="Supprimer"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          clearTimeout(timer.current);
          deleted.current = true;
          pending.current = {};
          contentDirty.current = false;
          await deleteNote(id).catch(() => {});
          router.push("/");
        }}
      />

      {toast && (
        <div className="no-print fade-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-paper shadow-soft">
          {toast}
        </div>
      )}
    </article>
  );
}
