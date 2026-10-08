// Conversion entre documents Tiptap (JSON) et Markdown.
import { drawingTexts, type JSONNode } from "./text";

export type MarkdownOptions = {
  /** Réécrit l'URL des images et des vocaux (ex. vers un dossier local dans une archive). */
  resolveImage?: (src: string) => string;
};

type Mark = NonNullable<JSONNode["marks"]>[number];

function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]])/g, "\\$1");
}

function wrapMarks(text: string, marks: Mark[] = []): string {
  if (!text) return "";
  const code = marks.some((m) => m.type === "code");
  // Les espaces en bordure doivent rester hors des marqueurs (**gras** et non ** gras**).
  const lead = text.match(/^\s*/)?.[0] ?? "";
  const trail = text.match(/\s*$/)?.[0] ?? "";
  let core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  core = code ? "`" + core.replace(/`/g, "\\`") + "`" : escapeText(core);
  for (const m of marks) {
    if (m.type === "bold") core = `**${core}**`;
    else if (m.type === "italic") core = `*${core}*`;
    else if (m.type === "strike") core = `~~${core}~~`;
    else if (m.type === "underline") core = `<u>${core}</u>`;
  }
  const link = marks.find((m) => m.type === "link");
  if (link) core = `[${core}](${String(link.attrs?.href ?? "")})`;
  return lead + core + trail;
}

function inline(nodes: JSONNode[] = [], opts: MarkdownOptions): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return wrapMarks(n.text ?? "", n.marks);
      if (n.type === "hardBreak") return "  \n";
      if (n.type === "noteLink") return `[[${String(n.attrs?.title ?? "")}]]`;
      if (n.type === "image") return image(n, opts);
      return inline(n.content, opts);
    })
    .join("");
}

function image(n: JSONNode, opts: MarkdownOptions): string {
  const src = String(n.attrs?.src ?? "");
  const alt = String(n.attrs?.alt ?? "");
  return `![${alt}](${opts.resolveImage ? opts.resolveImage(src) : src})`;
}

function indentLines(text: string, prefix: string, firstPrefix = prefix): string {
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? firstPrefix : line ? prefix : prefix.trimEnd()) + line)
    .join("\n");
}

function table(node: JSONNode, opts: MarkdownOptions): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((c) => (c.type === "paragraph" ? inline(c.content, opts) : block(c, opts)))
        .join("<br>")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " "),
    ),
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const lines = [
    `| ${pad(rows[0]).join(" | ")} |`,
    `| ${Array(width).fill("---").join(" | ")} |`,
    ...rows.slice(1).map((r) => `| ${pad(r).join(" | ")} |`),
  ];
  return lines.join("\n");
}

function block(node: JSONNode, opts: MarkdownOptions): string {
  switch (node.type) {
    case "paragraph":
      return inline(node.content, opts);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return "#".repeat(level) + " " + inline(node.content, opts);
    }
    case "blockquote":
      return indentLines(blocks(node.content, opts), "> ");
    case "codeBlock": {
      const lang = node.attrs?.language ? String(node.attrs.language) : "";
      const code = (node.content ?? []).map((n) => n.text ?? "").join("");
      return "```" + lang + "\n" + code + "\n```";
    }
    case "horizontalRule":
      return "---";
    case "bulletList":
      return (node.content ?? [])
        .map((item) => indentLines(blocks(item.content, opts, true), "  ", "- "))
        .join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, i) => {
          const marker = `${start + i}. `;
          return indentLines(blocks(item.content, opts, true), " ".repeat(marker.length), marker);
        })
        .join("\n");
    }
    case "table":
      return table(node, opts);
    case "image":
      return image(node, opts);
    case "linkCard": {
      const a = (node.attrs ?? {}) as Record<string, string>;
      const title = escapeText(a.title || a.url);
      const meta = [a.authors, a.site, a.date].filter(Boolean).map(escapeText).join(" · ");
      return [`> [${title}](${a.url})`, ...(meta ? [`> ${meta}`] : []), ...(a.description ? [`> ${escapeText(a.description)}`] : [])].join("  \n");
    }
    case "audioClip": {
      const src = String(node.attrs?.src ?? "");
      const title = escapeText(String(node.attrs?.title || "Vocal"));
      return `*[Vocal]* [${title}](${opts.resolveImage ? opts.resolveImage(src) : src})`;
    }
    case "drawing": {
      const texts = drawingTexts(node).map(escapeText);
      return "*[Dessin]*" + (texts.length ? " " + texts.join(" · ") : "");
    }
    default:
      return node.content ? blocks(node.content, opts) : "";
  }
}

function blocks(nodes: JSONNode[] = [], opts: MarkdownOptions, tight = false): string {
  return nodes.map((n) => block(n, opts)).join(tight ? "\n" : "\n\n");
}

export function docToMarkdown(doc: JSONNode, opts: MarkdownOptions = {}): string {
  return blocks(doc.content, opts)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export type MarkdownNote = {
  title: string;
  date: string;
  tags: string[];
  favorite: boolean;
  important: boolean;
  createdAt: string;
  updatedAt: string;
  content: JSONNode;
};

/** Note complète en Markdown, précédée d'un en-tête YAML (compatible Obsidian). */
export function noteToMarkdown(note: MarkdownNote, opts: MarkdownOptions = {}): string {
  const front = [
    "---",
    `title: ${yamlString(note.title || "Sans titre")}`,
    `date: ${note.date}`,
    `tags: [${note.tags.map(yamlString).join(", ")}]`,
    ...(note.favorite ? ["favorite: true"] : []),
    ...(note.important ? ["important: true"] : []),
    `created: ${note.createdAt}`,
    `updated: ${note.updatedAt}`,
    "---",
    "",
  ].join("\n");
  const body = docToMarkdown(note.content, opts);
  return `${front}\n# ${note.title || "Sans titre"}\n\n${body}\n`;
}

/** Nom de fichier sûr, à partir d'un titre. */
export function safeFilename(title: string, fallback = "Sans titre"): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

// ——— Markdown → document Tiptap ———
// Sous-ensemble courant (titres, listes, citations, tableaux, gras, italique, code, liens),
// suffisant pour le texte rédigé par un modèle de langue.

const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const FENCE_RE = /^\s*(```|~~~)\s*([\w+-]*)/;
const RULE_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s{0,3}>/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const textNode = (text: string, marks: Mark[]): JSONNode => ({ type: "text", text, ...(marks.length ? { marks } : {}) });
const paragraphOf = (content: JSONNode[]): JSONNode => ({ type: "paragraph", ...(content.length ? { content } : {}) });

function inlineNodes(src: string, marks: Mark[] = []): JSONNode[] {
  const out: JSONNode[] = [];
  let buf = "";
  // Un retour à la ligne du modèle est voulu (question puis réponse…) : il est conservé.
  const flush = () => {
    buf.split("\n").forEach((part, k) => {
      if (k) out.push({ type: "hardBreak" });
      if (part) out.push(textNode(part, marks));
    });
    buf = "";
  };
  const wrapped = (m: RegExpMatchArray, mark: Mark) => {
    flush();
    out.push(...inlineNodes(m[2], [...marks, mark]));
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if (rest[0] === "\\" && /[\\`*_[\]()#~>|!-]/.test(rest[1] ?? "")) {
      buf += rest[1];
      i += 2;
      continue;
    }
    if ((m = rest.match(/^`([^`]+)`/))) {
      flush();
      out.push(textNode(m[1], [{ type: "code" }]));
    } else if ((m = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/))) {
      flush();
      out.push(...inlineNodes(m[1], [...marks, { type: "link", attrs: { href: m[2] } }]));
    } else if ((m = rest.match(/^(\*\*|__)(?=\S)([\s\S]*?\S)\1/))) {
      wrapped(m, { type: "bold" });
    } else if ((m = rest.match(/^(~~)(?=\S)([\s\S]*?\S)~~/))) {
      wrapped(m, { type: "strike" });
    } else if ((m = rest.match(/^(\*)(?=[^\s*])([\s\S]*?[^\s*])\*(?!\*)/))) {
      wrapped(m, { type: "italic" });
    } else if (!/[\p{L}\p{N}]/u.test(src[i - 1] ?? "") && (m = rest.match(/^(_)(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}])/u))) {
      wrapped(m, { type: "italic" });
    } else {
      buf += rest[0];
      i++;
      continue;
    }
    i += m[0].length;
  }
  flush();
  return out;
}

function startsBlock(line: string): boolean {
  return HEADING_RE.test(line) || FENCE_RE.test(line) || RULE_RE.test(line) || QUOTE_RE.test(line) || LIST_RE.test(line);
}

const leadingSpaces = (line: string) => line.match(/^\s*/)![0].replace(/\t/g, "    ").length;

function parseList(lines: string[], start: number): [JSONNode, number] {
  const first = lines[start].match(LIST_RE)!;
  const indent = leadingSpaces(first[1]);
  const ordered = /\d/.test(first[2]);
  const items: JSONNode[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(LIST_RE);
    if (!m || leadingSpaces(m[1]) !== indent || /\d/.test(m[2]) !== ordered) break;
    const contentIndent = indent + m[2].length + 1;
    const body = [m[3]];
    i++;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        // Ligne vide : la liste continue si la suite est en retrait ou un autre élément.
        let j = i;
        while (j < lines.length && !lines[j].trim()) j++;
        const next = lines[j];
        const sibling = next?.match(LIST_RE);
        if (next !== undefined && leadingSpaces(next) > indent && !(sibling && leadingSpaces(sibling[1]) <= indent)) {
          body.push(...lines.slice(i, j));
          i = j;
          continue;
        }
        break;
      }
      const ws = leadingSpaces(line);
      if (ws > indent) body.push(line.replace(/^\s*/, " ".repeat(Math.max(0, ws - contentIndent))));
      else if (!startsBlock(line)) body.push(line.trim()); // suite « paresseuse » du paragraphe
      else break;
      i++;
    }
    const content = parseBlocks(body);
    if (content[0]?.type !== "paragraph") content.unshift(paragraphOf([]));
    items.push({ type: "listItem", content });
    // Une ligne vide entre deux éléments ne sépare pas la liste.
    let j = i;
    while (j < lines.length && !lines[j].trim()) j++;
    const next = lines[j]?.match(LIST_RE);
    if (next && leadingSpaces(next[1]) === indent && /\d/.test(next[2]) === ordered) i = j;
  }
  const list: JSONNode = ordered
    ? { type: "orderedList", attrs: { start: Number(first[2].slice(0, -1)) || 1 }, content: items }
    : { type: "bulletList", content: items };
  return [list, i];
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
}

function parseTable(lines: string[], start: number): [JSONNode, number] {
  const header = tableCells(lines[start]);
  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(tableCells(lines[i++]));
  const row = (cells: string[], type: string): JSONNode => ({
    type: "tableRow",
    content: header.map((_, k) => ({ type, content: [paragraphOf(inlineNodes(cells[k] ?? ""))] })),
  });
  return [{ type: "table", content: [row(header, "tableHeader"), ...rows.map((r) => row(r, "tableCell"))] }, i];
}

function parseBlocks(lines: string[]): JSONNode[] {
  const out: JSONNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m: RegExpMatchArray | null;
    if (!line.trim()) {
      i++;
    } else if ((m = line.match(FENCE_RE))) {
      const fence = m[1];
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++]);
      i++;
      const text = code.join("\n");
      out.push({ type: "codeBlock", attrs: { language: m[2] || null }, ...(text ? { content: [{ type: "text", text }] } : {}) });
    } else if ((m = line.match(HEADING_RE))) {
      out.push({ type: "heading", attrs: { level: Math.min(m[1].length, 3) }, content: inlineNodes(m[2]) });
      i++;
    } else if (RULE_RE.test(line)) {
      out.push({ type: "horizontalRule" });
      i++;
    } else if (QUOTE_RE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) quoted.push(lines[i++].replace(/^\s{0,3}>\s?/, ""));
      const content = parseBlocks(quoted);
      out.push({ type: "blockquote", content: content.length ? content : [paragraphOf([])] });
    } else if (LIST_RE.test(line)) {
      const [list, next] = parseList(lines, i);
      out.push(list);
      i = next;
    } else if (line.includes("|") && TABLE_SEP_RE.test(lines[i + 1] ?? "")) {
      const [table, next] = parseTable(lines, i);
      out.push(table);
      i = next;
    } else {
      const para = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) para.push(lines[i++].trim());
      out.push(paragraphOf(inlineNodes(para.join("\n"))));
    }
  }
  return out;
}

/** Document Tiptap à partir de texte Markdown. */
export function markdownToDoc(markdown: string): JSONNode {
  const content = parseBlocks(markdown.replace(/\r\n?/g, "\n").split("\n"));
  return { type: "doc", content: content.length ? content : [paragraphOf([])] };
}
