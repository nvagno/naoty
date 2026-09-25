import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { fetchLinkMeta } from "@/lib/client/api";
import { safeHost } from "@/lib/linkMeta";

/** Insère une fiche de lien à la place de la sélection, puis la complète avec les métadonnées de la page. */
export async function insertLinkCard(view: EditorView, url: string) {
  const { state } = view;
  const { schema } = state;
  const card = schema.nodes.linkCard.create({ url, title: safeHost(url), loading: true });
  const paragraph = schema.nodes.paragraph.create();
  const { $from } = state.selection;
  const tr = state.tr;
  let start: number;
  if ($from.parent.type.name === "paragraph" && $from.parent.content.size === 0) {
    // Ligne vide : la fiche la remplace
    start = $from.before();
    tr.replaceWith(start, $from.after(), [card, paragraph]);
  } else {
    // Sinon, sous le bloc courant
    start = $from.after();
    tr.insert(start, [card, paragraph]);
  }
  // Le curseur passe dans le paragraphe sous la fiche : la saisie ne remplace pas la fiche.
  tr.setSelection(TextSelection.create(tr.doc, start + card.nodeSize + 1));
  view.dispatch(tr.scrollIntoView());
  await completeLinkCard(view, url);
}

/** Remplit les fiches encore en attente pour cette adresse. */
export async function completeLinkCard(view: EditorView, url: string) {
  const meta = await fetchLinkMeta(url).catch(() => null);
  if (view.isDestroyed) return;
  const { tr } = view.state;
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === "linkCard" && node.attrs.loading && node.attrs.url === url) {
      const { url: _u, error: _e, ...fields } = meta ?? {};
      void _u;
      void _e;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...fields, loading: false });
    }
  });
  if (tr.docChanged) view.dispatch(tr);
}

/** Fiches restées en attente (page fermée pendant le chargement) : on relance la récupération. */
export function completePendingCards(view: EditorView) {
  const urls = new Set<string>();
  view.state.doc.descendants((node) => {
    if (node.type.name === "linkCard" && node.attrs.loading) urls.add(node.attrs.url);
  });
  urls.forEach((u) => completeLinkCard(view, u));
}
