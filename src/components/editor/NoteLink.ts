import { InputRule, mergeAttributes, Node } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export type NoteLinkItem = { id: string | null; title: string; date?: string; create?: boolean };

export const noteLinkSuggestionKey = new PluginKey("noteLinkSuggestion");

export type NoteLinkOptions = {
  suggestion: Omit<SuggestionOptions<NoteLinkItem>, "editor">;
};

/**
 * Lien interne vers une autre note, saisi avec [[ … ]].
 * Stocké sous forme de nœud atomique { id, title } ; le titre est mis à jour côté serveur
 * lorsque la note cible est renommée.
 */
export const NoteLink = Node.create<NoteLinkOptions>({
  name: "noteLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { suggestion: { char: "[[" } };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
      },
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") ?? el.textContent ?? "",
        renderHTML: (attrs) => ({ "data-title": attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-note-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(
        {
          "data-note-link": "",
          class: "note-link",
          href: node.attrs.id ? `/notes/${node.attrs.id}` : "#",
          title: node.attrs.id ? `Ouvrir « ${node.attrs.title} »` : `Créer la note « ${node.attrs.title} »`,
        },
        HTMLAttributes,
      ),
      node.attrs.title || "Note",
    ];
  },

  renderText({ node }) {
    return `[[${node.attrs.title}]]`;
  },

  addInputRules() {
    // [[Titre]] saisi en entier : lien résolu par le titre (au clic et à l'enregistrement).
    return [
      new InputRule({
        find: /\[\[([^[\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const title = match[1].trim();
          if (!title) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create({ id: null, title }));
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Supprimer un lien d'un coup de Retour arrière le retransforme en texte éditable « [[Titre »
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          const { selection } = state;
          if (!selection.empty) return false;
          const before = selection.$anchor.nodeBefore;
          if (before?.type.name !== this.name) return false;
          const pos = selection.anchor - before.nodeSize;
          tr.insertText(`[[${before.attrs.title}`, pos, selection.anchor);
          return true;
        }),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<NoteLinkItem>({
        editor: this.editor,
        pluginKey: noteLinkSuggestionKey,
        allowSpaces: true,
        allowedPrefixes: null,
        ...this.options.suggestion,
        char: "[[",
      }),
    ];
  },
});
