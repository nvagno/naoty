// Utilitaires purs sur le contenu des notes (partagés client / serveur).

export type JSONNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export const EMPTY_DOC: JSONNode = { type: "doc", content: [{ type: "paragraph" }] };

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Minuscules et suppression des accents, caractère par caractère :
 * la chaîne obtenue a exactement la même longueur que l'originale,
 * ce qui permet de reporter une position trouvée dans le texte replié.
 */
export function fold(input: string): string {
  let out = "";
  for (const ch of input) {
    const folded = ch.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
    // Un caractère hors plan de base (emoji…) occupe deux unités UTF-16 : on le garde tel quel.
    out += folded.length === ch.length ? folded : ch;
  }
  return out;
}

export function parseDoc(content: string | JSONNode | null | undefined): JSONNode {
  if (!content) return EMPTY_DOC;
  if (typeof content !== "string") return content;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : EMPTY_DOC;
  } catch {
    return EMPTY_DOC;
  }
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "tableRow",
  "horizontalRule",
]);

/** Texte brut d'un document Tiptap, un bloc par ligne. */
export function docToText(doc: JSONNode): string {
  const parts: string[] = [];
  const walk = (node: JSONNode) => {
    if (node.type === "text") {
      parts.push(node.text ?? "");
      return;
    }
    if (node.type === "noteLink") {
      parts.push(String(node.attrs?.title ?? ""));
      return;
    }
    if (node.type === "hardBreak") {
      parts.push("\n");
      return;
    }
    if (node.type === "tableCell" || node.type === "tableHeader") {
      node.content?.forEach(walk);
      parts.push(" ");
      return;
    }
    node.content?.forEach(walk);
    if (node.type && BLOCK_TYPES.has(node.type)) parts.push("\n");
  };
  walk(doc);
  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type LinkRef = { id: string | null; title: string };

/** Liens internes [[...]] présents dans un document. */
export function extractNoteLinks(doc: JSONNode): LinkRef[] {
  const found: LinkRef[] = [];
  const walk = (node: JSONNode) => {
    if (node.type === "noteLink") {
      const id = typeof node.attrs?.id === "string" && node.attrs.id ? node.attrs.id : null;
      const title = String(node.attrs?.title ?? "").trim();
      if (id || title) found.push({ id, title });
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return found;
}

/** Met à jour le titre affiché des liens pointant vers `targetId`. Renvoie null si rien n'a changé. */
export function renameLinksInDoc(doc: JSONNode, targetId: string, title: string): JSONNode | null {
  let changed = false;
  const walk = (node: JSONNode): JSONNode => {
    if (node.type === "noteLink" && node.attrs?.id === targetId && node.attrs.title !== title) {
      changed = true;
      return { ...node, attrs: { ...node.attrs, title } };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  };
  const next = walk(doc);
  return changed ? next : null;
}

/** Identifiants des pièces jointes affichées dans le document (images). */
export function extractAttachmentIds(doc: JSONNode): string[] {
  const ids: string[] = [];
  const walk = (node: JSONNode) => {
    const src = node.attrs?.src;
    if (node.type === "image" && typeof src === "string") {
      const m = src.match(/\/api\/attachments\/([\w-]+)/);
      if (m) ids.push(m[1]);
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return ids;
}

export function excerpt(text: string, max = 180): string {
  // Un bloc par ligne dans le texte brut : on les sépare d'un point médian dans l'aperçu.
  const flat = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ");
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
}

/** Découpe une requête en termes repliés (sans accents, minuscules). */
export function searchTerms(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .map((t) => t.replace(/^#/, ""))
    .filter(Boolean);
}

/** Extrait autour de la première occurrence d'un des termes. */
export function snippet(text: string, terms: string[], radius = 90): string | null {
  if (!terms.length) return null;
  const flat = text.replace(/\s+/g, " ");
  const folded = fold(flat);
  let pos = -1;
  for (const t of terms) {
    const p = folded.indexOf(t);
    if (p !== -1 && (pos === -1 || p < pos)) pos = p;
  }
  if (pos === -1) return null;
  const start = Math.max(0, pos - radius);
  const end = Math.min(flat.length, pos + radius);
  return (start > 0 ? "…" : "") + flat.slice(start, end).trim() + (end < flat.length ? "…" : "");
}

/** Normalise un nom de tag : sans #, minuscules, espaces remplacés par des tirets. */
export function normalizeTag(name: string): string {
  return name
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[,]+/g, "")
    .slice(0, 60);
}

export function buildSearchText(title: string, text: string, tags: string[]): string {
  return fold([title, text, tags.map((t) => "#" + t).join(" ")].join("\n"));
}

/** Découpe un texte en segments, en marquant ceux qui correspondent aux termes recherchés. */
export function highlightSegments(text: string, terms: string[]): { text: string; match: boolean }[] {
  if (!terms.length || !text) return [{ text, match: false }];
  const folded = fold(text);
  const ranges: [number, number][] = [];
  for (const t of terms) {
    let from = 0;
    while (t && (from = folded.indexOf(t, from)) !== -1) {
      ranges.push([from, from + t.length]);
      from += t.length;
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const out: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const [a, b] of merged) {
    if (a > cursor) out.push({ text: text.slice(cursor, a), match: false });
    out.push({ text: text.slice(a, b), match: true });
    cursor = b;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), match: false });
  return out;
}
