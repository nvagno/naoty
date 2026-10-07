import { mergeAttributes, Node, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DrawingView } from "./DrawingView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    drawing: {
      /** Insère un dessin vide et l'ouvre aussitôt en plein écran. */
      insertDrawing: () => ReturnType;
    };
  }
}

/** Éditeurs dont le prochain dessin monté doit s'ouvrir directement (dessin qui vient d'être inséré). */
const openNext = new WeakSet<Editor>();

export function takeOpenRequest(editor: Editor): boolean {
  return openNext.delete(editor);
}

/**
 * Dessin à main levée (Excalidraw) : formes, flèches, texte.
 * Les éléments sont stockés dans le nœud ; leurs textes sont indexés pour la recherche (`drawingTexts`).
 */
export const Drawing = Node.create({
  name: "drawing",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      elements: {
        default: [],
        parseHTML: (el) => {
          try {
            const v = JSON.parse(el.getAttribute("data-elements") ?? "[]");
            return Array.isArray(v) ? v : [];
          } catch {
            return [];
          }
        },
        renderHTML: (a) => ({ "data-elements": JSON.stringify(a.elements ?? []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-drawing]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-drawing": "", class: "drawing" }, HTMLAttributes)];
  },

  renderText() {
    return "[Dessin]";
  },

  addCommands() {
    return {
      insertDrawing:
        () =>
        ({ editor, commands }) => {
          openNext.add(editor);
          if (commands.insertContent({ type: this.name })) return true;
          openNext.delete(editor);
          return false;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingView);
  },
});
