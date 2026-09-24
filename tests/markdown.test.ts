import { describe, expect, it } from "vitest";
import { docToMarkdown, noteToMarkdown, safeFilename } from "@/lib/markdown";
import type { JSONNode } from "@/lib/text";

const t = (text: string, marks?: JSONNode["marks"]): JSONNode => ({ type: "text", text, marks });
const p = (...content: JSONNode[]): JSONNode => ({ type: "paragraph", content });

describe("docToMarkdown", () => {
  it("convertit les blocs usuels", () => {
    const doc: JSONNode = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [t("Titre")] },
        p(t("Du "), t("gras", [{ type: "bold" }]), t(" et de l'"), t("italique ", [{ type: "italic" }]), t("ici.")),
        { type: "bulletList", content: [{ type: "listItem", content: [p(t("a"))] }, { type: "listItem", content: [p(t("b"))] }] },
        { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [p(t("un"))] }, { type: "listItem", content: [p(t("deux"))] }] },
        { type: "blockquote", content: [p(t("Une citation"))] },
        { type: "horizontalRule" },
        p(t("Article", [{ type: "link", attrs: { href: "https://example.org" } }]), t(" et "), { type: "noteLink", attrs: { id: "1", title: "Autre note" } }),
      ],
    };
    expect(docToMarkdown(doc)).toBe(
      [
        "# Titre",
        "Du **gras** et de l'*italique* ici.",
        "- a\n- b",
        "1. un\n2. deux",
        "> Une citation",
        "---",
        "[Article](https://example.org) et [[Autre note]]",
      ].join("\n\n"),
    );
  });

  it("gère les listes imbriquées et les tableaux", () => {
    const doc: JSONNode = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [p(t("parent")), { type: "bulletList", content: [{ type: "listItem", content: [p(t("enfant"))] }] }],
            },
          ],
        },
        {
          type: "table",
          content: [
            { type: "tableRow", content: [{ type: "tableHeader", content: [p(t("A"))] }, { type: "tableHeader", content: [p(t("B"))] }] },
            { type: "tableRow", content: [{ type: "tableCell", content: [p(t("1|2"))] }, { type: "tableCell", content: [p()] }] },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("- parent\n  - enfant\n\n| A | B |\n| --- | --- |\n| 1\\|2 |  |");
  });

  it("échappe les caractères spéciaux et réécrit les images", () => {
    const doc: JSONNode = { type: "doc", content: [p(t("a*b_c")), { type: "image", attrs: { src: "/api/attachments/x", alt: "img" } }] };
    expect(docToMarkdown(doc, { resolveImage: () => "local.png" })).toBe("a\\*b\\_c\n\n![img](local.png)");
  });
});

describe("noteToMarkdown", () => {
  it("ajoute un en-tête YAML", () => {
    const md = noteToMarkdown({
      title: 'Note "test"',
      date: "2026-09-24",
      tags: ["idée", "lecture"],
      favorite: true,
      important: false,
      createdAt: "2026-09-24T10:00:00.000Z",
      updatedAt: "2026-09-24T11:00:00.000Z",
      content: { type: "doc", content: [p(t("Corps"))] },
    });
    expect(md).toContain('title: "Note \\"test\\""');
    expect(md).toContain('tags: ["idée", "lecture"]');
    expect(md).toContain("favorite: true");
    expect(md).not.toContain("important");
    expect(md.trim().endsWith("Corps")).toBe(true);
  });
});

describe("safeFilename", () => {
  it("retire les caractères interdits", () => {
    expect(safeFilename('Lecture : "Dupont" / 2024?')).toBe("Lecture Dupont 2024");
    expect(safeFilename("   ")).toBe("Sans titre");
  });
});

describe("tableaux avec images", () => {
  it("conserve une image placée dans une cellule", () => {
    const doc: JSONNode = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            { type: "tableRow", content: [{ type: "tableHeader", content: [p(t("A"))] }] },
            { type: "tableRow", content: [{ type: "tableCell", content: [p(t("x")), { type: "image", attrs: { src: "i.png", alt: "" } }] }] },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toContain("| x<br>![](i.png) |");
  });
});
