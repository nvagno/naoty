"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { carnetExtensions } from "./extensions";
import type { JSONNode } from "@/lib/text";

/** Affichage d'un document sans édition (historique, impression). */
export function ReadOnlyDoc({ content, onReady }: { content: JSONNode; onReady?: () => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: carnetExtensions(),
    content,
    editorProps: { attributes: { class: "prose-carnet" } },
    onCreate: () => onReady?.(),
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  return <EditorContent editor={editor} />;
}
