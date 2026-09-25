import { mergeAttributes, Node } from "@tiptap/core";
import { safeHost } from "@/lib/linkMeta";

const FIELDS = ["url", "title", "description", "site", "authors", "date"] as const;

/**
 * Fiche d'un lien web : titre, description, site, auteurs, date.
 * Créée en collant une adresse seule sur une ligne vide ; les métadonnées sont récupérées par /api/link-preview.
 */
export const LinkCard = Node.create({
  name: "linkCard",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    const attrs: Record<string, { default: unknown; parseHTML: (el: HTMLElement) => unknown; renderHTML: (a: Record<string, unknown>) => Record<string, string> }> = {};
    for (const f of FIELDS) {
      attrs[f] = {
        default: "",
        parseHTML: (el) => el.getAttribute(`data-${f}`) ?? "",
        renderHTML: (a) => (a[f] ? { [`data-${f}`]: String(a[f]) } : {}),
      };
    }
    attrs.loading = {
      default: false,
      parseHTML: () => false,
      renderHTML: (a) => (a.loading ? { "data-loading": "" } : ({} as Record<string, string>)),
    };
    return attrs;
  },

  parseHTML() {
    return [{ tag: "div[data-link-card]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { url, title, description, site, authors, date, loading } = node.attrs as Record<string, string> & { loading: boolean };
    const meta = loading
      ? "Récupération des informations…"
      : [authors, site || safeHost(url), date].filter(Boolean).join(" · ");
    return [
      "div",
      mergeAttributes({ "data-link-card": "", class: "link-card" }, HTMLAttributes),
      ["a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "link-card-title" }, title || url],
      ...(description ? [["p", { class: "link-card-desc" }, description]] : []),
      ["div", { class: "link-card-meta" }, meta, ["span", { class: "link-card-url" }, url]],
    ];
  },

  renderText({ node }) {
    return [node.attrs.title, node.attrs.url].filter(Boolean).join(" — ");
  },
});
