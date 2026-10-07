import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { NoteLink, type NoteLinkOptions } from "./NoteLink";
import { LinkCard } from "./LinkCard";
import { Drawing } from "./Drawing";

/** Extensions communes à l'éditeur, à l'aperçu de l'historique et à l'impression. */
export function carnetExtensions(opts: { placeholder?: string; suggestion?: NoteLinkOptions["suggestion"] } = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        // Les clics sur les liens sont gérés par l'éditeur (liens internes et externes).
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        markdownLinks: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      },
    }),
    Image.configure({ allowBase64: false }),
    TableKit.configure({ table: { resizable: false } }),
    LinkCard,
    Drawing,
    NoteLink.configure(opts.suggestion ? { suggestion: opts.suggestion } : {}),
    ...(opts.placeholder !== undefined
      ? [
          Placeholder.configure({
            placeholder: ({ editor, node }) =>
              node.type.name === "heading" ? "Titre de section" : editor.isEmpty ? (opts.placeholder ?? "") : "",
            showOnlyCurrent: true,
          }),
        ]
      : []),
  ];
}
