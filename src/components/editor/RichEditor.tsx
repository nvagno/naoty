"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import { useEffect, useRef, useState } from "react";
import { FilePlus2, FileText } from "lucide-react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { carnetExtensions } from "./extensions";
import type { NoteLinkItem } from "./NoteLink";
import { Toolbar } from "./Toolbar";
import { createNote, lookupNotes, resolveTitle, uploadAttachment } from "@/lib/client/api";
import { fold, type JSONNode } from "@/lib/text";
import { shortDate } from "@/lib/dates";
import type { AttachmentInfo } from "@/lib/types";

type SuggestState = SuggestionProps<NoteLinkItem> & { selected: number };

/** Liste flottante affichée pendant la saisie de [[… */
function LinkSuggestions({ state, onPick, onHover }: { state: SuggestState; onPick: (i: number) => void; onHover: (i: number) => void }) {
  const rect = state.clientRect?.();
  if (!rect) return null;
  const top = Math.min(rect.bottom + 6, window.innerHeight - 280);
  const left = Math.min(rect.left, window.innerWidth - 340);
  return (
    <div
      className="fade-in fixed z-50 w-80 overflow-hidden rounded-lg border border-line bg-paper shadow-soft"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="border-b border-line px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-3">
        Lier à une note
      </div>
      <ul className="max-h-64 overflow-y-auto p-1">
        {state.items.map((item, i) => (
          <li key={item.id ?? "create:" + item.title}>
            <button
              onClick={() => onPick(i)}
              onMouseMove={() => onHover(i)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${
                i === state.selected ? "bg-paper-2 text-ink" : "text-ink-2"
              }`}
            >
              {item.create ? <FilePlus2 size={14} className="shrink-0 text-ink-3" /> : <FileText size={14} className="shrink-0 text-ink-3" />}
              <span className="flex-1 truncate">
                {item.create ? (
                  <>
                    Créer « <span className="text-ink">{item.title}</span> »
                  </>
                ) : (
                  item.title
                )}
              </span>
              {item.date && <span className="shrink-0 text-xs text-ink-3">{shortDate(item.date)}</span>}
            </button>
          </li>
        ))}
        {!state.items.length && <li className="px-3 py-3 text-sm text-ink-3">Tapez le titre d&apos;une note…</li>}
      </ul>
    </div>
  );
}

function isImage(file: File) {
  return /^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(file.type);
}

export function RichEditor({
  noteId,
  content,
  onChange,
  onReady,
  onAttachment,
  onOpenNote,
  onError,
}: {
  noteId: string;
  content: JSONNode;
  onChange: (editor: Editor) => void;
  onReady?: (editor: Editor) => void;
  onAttachment: (a: AttachmentInfo) => void;
  /** Ouvrir une autre note (après enregistrement de la note courante) */
  onOpenNote: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [suggest, setSuggest] = useState<SuggestState | null>(null);
  const suggestRef = useRef<SuggestState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onChange, onAttachment, onOpenNote, onError });
  useEffect(() => {
    callbacks.current = { onChange, onAttachment, onOpenNote, onError };
  });

  const updateSuggest = (s: SuggestState | null) => {
    suggestRef.current = s;
    setSuggest(s);
  };

  async function uploadFiles(files: File[], view: EditorView, pos?: number) {
    for (const file of files) {
      try {
        const a = await uploadAttachment(noteId, file);
        callbacks.current.onAttachment(a);
        if (isImage(file)) {
          const node = view.state.schema.nodes.image.create({ src: a.url, alt: a.filename });
          const tr =
            pos === undefined
              ? view.state.tr.replaceSelectionWith(node)
              : view.state.tr.insert(Math.min(pos, view.state.doc.content.size), node);
          view.dispatch(tr);
        }
      } catch (e) {
        callbacks.current.onError(e instanceof Error ? e.message : "Envoi du fichier impossible.");
      }
    }
  }

  // Les fonctions passées à l'éditeur (suggestions, clics, collage) ne s'exécutent que sur ses événements,
  // jamais pendant le rendu : l'accès aux refs y est sûr.
  const editor = useEditor({
    immediatelyRender: false,
    // eslint-disable-next-line react-hooks/refs
    extensions: carnetExtensions({
      placeholder: "Commencez à écrire…  (tapez [[ pour lier une autre note)",
      suggestion: {
        items: async ({ query }) => {
          const q = query.replace(/\]+$/, "").trim();
          const found = await lookupNotes(q, noteId).catch(() => []);
          const items: NoteLinkItem[] = found.map((n) => ({ id: n.id, title: n.title, date: n.date }));
          if (q && !found.some((n) => fold(n.title) === fold(q))) items.push({ id: null, title: q, create: true });
          return items;
        },
        command: ({ editor, range, props }) => {
          const insert = (id: string, title: string) =>
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: "noteLink", attrs: { id, title } },
                { type: "text", text: " " },
              ])
              .run();
          if (props.id) insert(props.id, props.title);
          else
            createNote({ title: props.title })
              .then((n) => insert(n.id, n.title))
              .catch(() => callbacks.current.onError("Impossible de créer la note."));
        },
        render: () => ({
          onStart: (props) => updateSuggest({ ...props, selected: 0 }),
          onUpdate: (props) => updateSuggest({ ...props, selected: 0 }),
          onExit: () => updateSuggest(null),
          onKeyDown: ({ event }) => {
            const s = suggestRef.current;
            if (!s) return false;
            if (event.key === "Escape") {
              updateSuggest(null);
              return true;
            }
            if (!s.items.length) return false;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              const d = event.key === "ArrowDown" ? 1 : -1;
              updateSuggest({ ...s, selected: (s.selected + d + s.items.length) % s.items.length });
              return true;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              s.command(s.items[s.selected]);
              return true;
            }
            return false;
          },
        }),
      },
    }),
    content,
    editorProps: {
      attributes: {
        class: "prose-carnet min-h-[50vh] pb-32",
        spellcheck: "true",
        lang: "fr",
      },
      handleClick: (view, _pos, event) => {
        const a = (event.target as HTMLElement).closest("a");
        if (!a) return false;
        event.preventDefault();
        if (a.hasAttribute("data-note-link")) {
          const id = a.getAttribute("data-id");
          const title = a.getAttribute("data-title") ?? a.textContent ?? "";
          if (id) callbacks.current.onOpenNote(id);
          else openByTitle(view, title);
          return true;
        }
        const href = a.getAttribute("href");
        if (href) window.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        uploadFiles(files, view);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || !files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        uploadFiles(files, view, pos);
        return true;
      },
    },
    onUpdate: ({ editor }) => callbacks.current.onChange(editor),
    onCreate: ({ editor }) => onReady?.(editor),
  });

  /** Lien saisi à la main ([[Titre]]) : on retrouve ou crée la note, puis on fixe son identifiant. */
  async function openByTitle(view: EditorView, title: string) {
    try {
      const ref = await resolveTitle(title, true);
      const { tr } = view.state;
      view.state.doc.descendants((node, pos) => {
        if (node.type.name === "noteLink" && !node.attrs.id && fold(node.attrs.title) === fold(title)) {
          tr.setNodeMarkup(pos, undefined, { id: ref.id, title: ref.title });
        }
      });
      if (tr.docChanged) view.dispatch(tr);
      callbacks.current.onOpenNote(ref.id);
    } catch {
      callbacks.current.onError("Impossible d'ouvrir cette note.");
    }
  }

  if (!editor) return <div className="min-h-[50vh]" />;

  return (
    <div>
      <div className="no-print sticky top-14 z-20 -mx-2 mb-6 border-b border-line bg-paper/95 px-2 backdrop-blur">
        <Toolbar editor={editor} onAttach={() => fileInput.current?.click()} />
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) uploadFiles(files, editor.view);
        }}
      />
      <EditorContent editor={editor} />
      {suggest && (
        <LinkSuggestions
          state={suggest}
          onPick={(i) => suggest.command(suggest.items[i])}
          onHover={(i) => updateSuggest({ ...suggest, selected: i })}
        />
      )}
    </div>
  );
}
