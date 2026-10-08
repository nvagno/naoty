import { describe, expect, it } from "vitest";
import { cleanExtractedText, digestToDoc, splitDigest, splitText, titleFromFilename } from "@/lib/digest";
import { docToMarkdown, markdownToDoc } from "@/lib/markdown";
import { docToText } from "@/lib/text";

describe("markdownToDoc", () => {
  it("convertit les blocs usuels d'une fiche", () => {
    const md = [
      "## Les idées essentielles",
      "",
      "1. **Première idée.** Elle s'explique",
      "   en deux lignes.",
      "2. **Deuxième idée** avec *italique*, `code` et [un lien](https://example.org).",
      "",
      "## Les notions clés",
      "- **Entropie** : mesure du désordre.",
      "  - sous-point",
      "- **Énergie** : capacité à produire un travail.",
      "",
      "> Une citation",
      "",
      "---",
      "",
      "Un paragraphe",
      "sur deux lignes.",
    ].join("\n");
    expect(docToMarkdown(markdownToDoc(md))).toBe(
      [
        "## Les idées essentielles",
        "1. **Première idée.** Elle s'explique  \n   en deux lignes.\n2. **Deuxième idée** avec *italique*, `code` et [un lien](https://example.org).",
        "## Les notions clés",
        "- **Entropie** : mesure du désordre.\n  - sous-point\n- **Énergie** : capacité à produire un travail.",
        "> Une citation",
        "---",
        "Un paragraphe  \nsur deux lignes.",
      ].join("\n\n"),
    );
  });

  it("garde une liste numérotée interrompue par des lignes vides et sa réponse en retrait", () => {
    const doc = markdownToDoc("1. Question ?\n   *Réponse : oui.*\n\n2. Autre ?\n\n   *Réponse : non.*");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0].type).toBe("orderedList");
    expect(doc.content![0].content).toHaveLength(2);
    expect(docToText(doc)).toContain("Réponse : non.");
  });

  it("ramène les titres au niveau 3 et convertit les tableaux", () => {
    const doc = markdownToDoc("#### Petit titre\n\n| Terme | Définition |\n|---|---|\n| a | b \\| c |");
    expect(doc.content![0]).toMatchObject({ type: "heading", attrs: { level: 3 } });
    const table = doc.content![1];
    expect(table.type).toBe("table");
    expect(table.content![0].content![0].type).toBe("tableHeader");
    expect(docToText(doc)).toContain("b | c");
  });

  it("ne prend pas un astérisque isolé pour de l'italique", () => {
    const doc = markdownToDoc("2 * 3 * 4 = 24, snake_case_name");
    expect(doc.content![0].content).toEqual([{ type: "text", text: "2 * 3 * 4 = 24, snake_case_name" }]);
  });

  it("renvoie un document valide pour un texte vide", () => {
    expect(markdownToDoc("  \n")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});

describe("fiche de révision", () => {
  it("sépare le titre du corps, même dans un bloc ```markdown", () => {
    expect(splitDigest("```markdown\n# La **photosynthèse**\n\n## En bref\nTexte\n```")).toEqual({
      title: "La photosynthèse",
      body: "## En bref\nTexte",
    });
    expect(splitDigest("## En bref\nTexte")).toEqual({ title: "", body: "## En bref\nTexte" });
  });

  it("découpe les longs textes entre deux paragraphes", () => {
    const text = ["a".repeat(60), "b".repeat(60), "c".repeat(60)].join("\n\n");
    const parts = splitText(text, 130);
    expect(parts).toEqual(["a".repeat(60) + "\n\n" + "b".repeat(60), "c".repeat(60)]);
    expect(splitText("x".repeat(250), 100).every((p) => p.length <= 100)).toBe(true);
  });

  it("nettoie le texte extrait", () => {
    expect(cleanExtractedText("trans-\nformation  du texte\n\n\n\nsuite ")).toBe("transformation du texte\n\nsuite");
  });

  it("indique l'origine de la fiche et laisse une place pour les notes", () => {
    const doc = digestToDoc("## En bref\nTexte", { filename: "cours.pdf", model: "mistral-small", parts: 2 });
    const text = docToText(doc);
    expect(text).toContain("Albert (mistral-small)");
    expect(text).toContain("« cours.pdf », lu en 2 parties");
    expect(doc.content!.at(-2)).toMatchObject({ type: "heading", content: [{ text: "Mes notes" }] });
    expect(titleFromFilename("Cours_de_physique.v2.pdf")).toBe("Cours de physique.v2");
  });
});
