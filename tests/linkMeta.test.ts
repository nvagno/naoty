import { describe, expect, it } from "vitest";
import { asStandaloneUrl, decodeEntities, parseLinkMeta } from "@/lib/linkMeta";
import { docToMarkdown } from "@/lib/markdown";
import { docToText } from "@/lib/text";

describe("parseLinkMeta", () => {
  it("lit les balises Open Graph et le titre", () => {
    const html = `<html><head><title>Titre de repli</title>
      <meta property="og:title" content="L&#39;enquête de terrain &amp; ses limites">
      <meta name="description" content="Une   réflexion
        méthodologique.">
      <meta property="og:site_name" content='Revue X'></head></html>`;
    expect(parseLinkMeta(html, "https://www.exemple.fr/a")).toEqual({
      url: "https://www.exemple.fr/a",
      title: "L'enquête de terrain & ses limites",
      description: "Une réflexion méthodologique.",
      site: "Revue X",
      authors: "",
      date: "",
    });
  });

  it("privilégie les métadonnées d'article scientifique (citation_*)", () => {
    const html = `<meta name="citation_title" content="Qualitative methods">
      <meta name="citation_author" content="Dupont, Marie">
      <meta name="citation_author" content="Martin, Paul">
      <meta name="citation_journal_title" content="Sociologie">
      <meta name="citation_publication_date" content="2024/03/01">
      <meta property="og:title" content="Autre titre">`;
    const m = parseLinkMeta(html, "https://revue.org/1");
    expect(m.title).toBe("Qualitative methods");
    expect(m.authors).toBe("Dupont, Marie, Martin, Paul");
    expect(m.site).toBe("Sociologie");
    expect(m.date).toBe("2024/03/01");
  });

  it("se rabat sur le nom de domaine", () => {
    const m = parseLinkMeta("<html></html>", "https://www.exemple.fr/x");
    expect(m.title).toBe("exemple.fr");
    expect(m.site).toBe("exemple.fr");
  });
});

describe("utilitaires", () => {
  it("reconnaît une adresse seule", () => {
    expect(asStandaloneUrl(" https://a.org/x?y=1 ")).toBe("https://a.org/x?y=1");
    expect(asStandaloneUrl("www.a.org")).toBe("https://www.a.org/");
    expect(asStandaloneUrl("voir https://a.org")).toBeNull();
    expect(asStandaloneUrl("javascript:alert(1)")).toBeNull();
  });
  it("décode les entités HTML", () => {
    expect(decodeEntities("&eacute;&#233;&#xE9;&amp;")).toBe("&eacute;éé&");
  });
});

describe("fiche de lien dans le texte et le Markdown", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "linkCard", attrs: { url: "https://revue.org/1", title: "Qualitative methods", authors: "Dupont", site: "Sociologie", date: "2024", description: "Résumé." } },
    ],
  };
  it("est indexée pour la recherche", () => {
    expect(docToText(doc)).toContain("Qualitative methods");
    expect(docToText(doc)).toContain("Résumé.");
  });
  it("s'exporte en citation Markdown", () => {
    expect(docToMarkdown(doc)).toBe("> [Qualitative methods](https://revue.org/1)  \n> Dupont · Sociologie · 2024  \n> Résumé.");
  });
});
