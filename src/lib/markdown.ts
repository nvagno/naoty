// Conversion d'un document Tiptap (JSON) en Markdown lisible.
import { drawingTexts, type JSONNode } from "./text";

export type MarkdownOptions = {
  /** Réécrit l'URL des images (ex. vers un dossier local dans une archive). */
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
