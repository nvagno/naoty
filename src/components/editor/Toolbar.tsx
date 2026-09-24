"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useState, type ReactNode } from "react";
import {
  Bold,
  Brackets,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Paperclip,
  Pilcrow,
  Quote,
  Rows3,
  Strikethrough,
  Table,
  Trash2,
} from "lucide-react";
import { Modal, ModalHeader, useModKey } from "../ui";

function Btn({
  onClick,
  active,
  label,
  children,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active ? "bg-paper-3 text-ink" : "text-ink-3 hover:bg-paper-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-4 w-px shrink-0 bg-line" />;

export function LinkDialog({ editor, open, onClose }: { editor: Editor; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [initialised, setInitialised] = useState(false);

  if (open && !initialised) {
    setUrl(editor.getAttributes("link").href ?? "");
    setText("");
    setInitialised(true);
  }
  if (!open && initialised) setInitialised(false);

  const hasSelection = !editor.state.selection.empty || editor.isActive("link");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    let href = url.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    if (!/^[a-z][\w+.-]*:/i.test(href)) href = "https://" + href;
    if (hasSelection) {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else {
      const label = text.trim() || href;
      editor
        .chain()
        .focus()
        .insertContent([
          { type: "text", text: label, marks: [{ type: "link", attrs: { href } }] },
          { type: "text", text: " " },
        ])
        .run();
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} label="Lien web" width="max-w-md">
      <ModalHeader title={editor.isActive("link") ? "Modifier le lien" : "Ajouter un lien web"} onClose={onClose} />
      <form onSubmit={apply} className="space-y-3 p-5">
        {!hasSelection && (
          <label className="block">
            <span className="mb-1 block text-xs text-ink-3">Texte affiché (facultatif)</span>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Article intéressant sur la méthodologie" />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs text-ink-3">Adresse</span>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            data-autofocus
            inputMode="url"
          />
        </label>
        <div className="flex justify-between pt-2">
          {editor.isActive("link") ? (
            <button
              type="button"
              className="btn-ghost text-danger"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                onClose();
              }}
            >
              Retirer le lien
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn-primary">
            Valider
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Toolbar({ editor, onAttach }: { editor: Editor; onAttach: () => void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const mod = useModKey();
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive("paragraph"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
    }),
  });
  const c = () => editor.chain().focus();

  return (
    <>
      <div className="flex items-center gap-0.5 overflow-x-auto py-1.5 [scrollbar-width:none]" role="toolbar" aria-label="Mise en forme">
        <Btn label="Texte normal" active={s.paragraph && !s.bullet && !s.ordered && !s.quote} onClick={() => c().setParagraph().run()}>
          <Pilcrow size={15} />
        </Btn>
        <Btn label="Titre" active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={16} />
        </Btn>
        <Btn label="Sous-titre" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </Btn>
        <Btn label="Intertitre" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={16} />
        </Btn>
        <Sep />
        <Btn label={`Gras (${mod}+B)`} active={s.bold} onClick={() => c().toggleBold().run()}>
          <Bold size={15} />
        </Btn>
        <Btn label={`Italique (${mod}+I)`} active={s.italic} onClick={() => c().toggleItalic().run()}>
          <Italic size={15} />
        </Btn>
        <Btn label="Barré" active={s.strike} onClick={() => c().toggleStrike().run()}>
          <Strikethrough size={15} />
        </Btn>
        <Sep />
        <Btn label="Liste à puces" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
          <List size={16} />
        </Btn>
        <Btn label="Liste numérotée" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </Btn>
        <Btn label="Citation" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
          <Quote size={15} />
        </Btn>
        <Btn label="Séparateur" onClick={() => c().setHorizontalRule().run()}>
          <Minus size={16} />
        </Btn>
        <Sep />
        <Btn label="Lien web" active={s.link} onClick={() => setLinkOpen(true)}>
          <Link2 size={16} />
        </Btn>
        <Btn label="Lien vers une note ([[)" onClick={() => c().insertContent("[[").run()}>
          <Brackets size={15} />
        </Btn>
        <Btn label="Tableau" active={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <Table size={15} />
        </Btn>
        <Btn label="Joindre un fichier ou une image" onClick={onAttach}>
          <Paperclip size={15} />
        </Btn>
        {s.table && (
          <>
            <Sep />
            <Btn label="Ajouter une ligne" onClick={() => c().addRowAfter().run()}>
              <Rows3 size={15} />
            </Btn>
            <Btn label="Ajouter une colonne" onClick={() => c().addColumnAfter().run()}>
              <Columns3 size={15} />
            </Btn>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => c().deleteRow().run()}
              className="h-8 shrink-0 rounded-md px-2 text-xs text-ink-3 hover:bg-paper-2 hover:text-ink"
            >
              −&nbsp;ligne
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => c().deleteColumn().run()}
              className="h-8 shrink-0 rounded-md px-2 text-xs text-ink-3 hover:bg-paper-2 hover:text-ink"
            >
              −&nbsp;col.
            </button>
            <Btn label="Supprimer le tableau" onClick={() => c().deleteTable().run()}>
              <Trash2 size={14} />
            </Btn>
          </>
        )}
      </div>
      <LinkDialog editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} />
    </>
  );
}
