import { describe, expect, it } from "vitest";
import {
  buildSearchText,
  docToText,
  excerpt,
  extractAttachmentIds,
  extractNoteLinks,
  fold,
  highlightSegments,
  normalizeTag,
  renameLinksInDoc,
  searchTerms,
  snippet,
  type JSONNode,
} from "@/lib/text";

const doc: JSONNode = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Méthodologie" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Voir " },
        { type: "noteLink", attrs: { id: "abc", title: "Ma problématique" } },
        { type: "text", text: " et " },
        { type: "noteLink", attrs: { id: null, title: "Note à créer" } },
      ],
    },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "un point" }] }] }] },
    { type: "image", attrs: { src: "/api/attachments/att1", alt: "x" } },
  ],
};

describe("fold", () => {
  it("retire accents et majuscules sans changer la longueur", () => {
    expect(fold("Élève À l'ÉCOLE")).toBe("eleve a l'ecole");
    for (const s of ["Méthodologie", "œuvre", "façade", "naïve 🙂 ok"]) expect(fold(s)).toHaveLength(s.length);
  });
});

describe("docToText / excerpt", () => {
  it("extrait le texte brut, un bloc par ligne, avec le titre des liens", () => {
    expect(docToText(doc)).toBe("Méthodologie\nVoir Ma problématique et Note à créer\nun point");
  });
  it("sépare les blocs dans l'aperçu et coupe proprement", () => {
    expect(excerpt("Titre\nLe texte")).toBe("Titre · Le texte");
    const long = "mot ".repeat(100);
    const e = excerpt(long, 50);
    expect(e.length).toBeLessThanOrEqual(51);
    expect(e.endsWith("…")).toBe(true);
  });
});

describe("liens internes", () => {
  it("liste les liens avec ou sans identifiant", () => {
    expect(extractNoteLinks(doc)).toEqual([
      { id: "abc", title: "Ma problématique" },
      { id: null, title: "Note à créer" },
    ]);
  });
  it("renomme les liens vers une note", () => {
    const next = renameLinksInDoc(doc, "abc", "Nouveau titre");
    expect(next && extractNoteLinks(next)[0].title).toBe("Nouveau titre");
    expect(renameLinksInDoc(doc, "inconnu", "x")).toBeNull();
    // Le document d'origine n'est pas modifié
    expect(extractNoteLinks(doc)[0].title).toBe("Ma problématique");
  });
  it("repère les images jointes", () => {
    expect(extractAttachmentIds(doc)).toEqual(["att1"]);
  });
});

describe("recherche", () => {
  it("découpe la requête en termes repliés", () => {
    expect(searchTerms("  Méthodologie  #Terrain ")).toEqual(["methodologie", "terrain"]);
  });
  it("indexe titre, contenu et tags", () => {
    const s = buildSearchText("Réflexion", "Le protocole", ["à-vérifier"]);
    expect(s).toContain("reflexion");
    expect(s).toContain("protocole");
    expect(s).toContain("#a-verifier");
  });
  it("produit un extrait autour du terme", () => {
    const text = "a ".repeat(200) + "la méthodologie qualitative " + "b ".repeat(200);
    const sn = snippet(text, ["methodologie"], 20)!;
    expect(sn).toContain("méthodologie");
    expect(sn.startsWith("…")).toBe(true);
    expect(snippet("rien", ["x"])).toBeNull();
  });
  it("surligne sans tenir compte des accents", () => {
    const parts = highlightSegments("Une Méthode", ["methode"]);
    expect(parts).toEqual([
      { text: "Une ", match: false },
      { text: "Méthode", match: true },
    ]);
  });
});

describe("normalizeTag", () => {
  it("nettoie les noms de tags", () => {
    expect(normalizeTag("  #Idée ")).toBe("idée");
    expect(normalizeTag("à vérifier")).toBe("à-vérifier");
    expect(normalizeTag("##")).toBe("");
  });
});
