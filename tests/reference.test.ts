import { describe, expect, it } from "vitest";
import {
  abstractFromInvertedIndex,
  citationText,
  findArxivId,
  findDoi,
  normalizeDate,
  parseArxivAtom,
  parseAuthorName,
  parseCrossref,
  parseReferenceHtml,
  parseReferenceInput,
  referenceToDoc,
} from "@/lib/reference";
import { docToMarkdown } from "@/lib/markdown";
import { docToText } from "@/lib/text";

describe("identifiants", () => {
  it("reconnaît un DOI, un identifiant arXiv ou une adresse", () => {
    expect(parseReferenceInput("10.1038/nature12373")).toEqual({ kind: "doi", doi: "10.1038/nature12373" });
    expect(parseReferenceInput("doi: 10.1038/nature12373")).toEqual({ kind: "doi", doi: "10.1038/nature12373" });
    expect(parseReferenceInput("https://doi.org/10.1038/nature12373")).toEqual({ kind: "doi", doi: "10.1038/nature12373" });
    expect(parseReferenceInput("arXiv:2401.01234v2")).toEqual({ kind: "arxiv", id: "2401.01234" });
    expect(parseReferenceInput("2401.01234")).toEqual({ kind: "arxiv", id: "2401.01234" });
    expect(parseReferenceInput("https://doi.org/10.48550/arXiv.1706.03762")).toEqual({ kind: "arxiv", id: "1706.03762" });
    expect(parseReferenceInput("https://arxiv.org/pdf/2401.01234v1.pdf")).toEqual({ kind: "arxiv", id: "2401.01234" });
    expect(parseReferenceInput("https://arxiv.org/abs/hep-th/9901001")).toEqual({ kind: "arxiv", id: "hep-th/9901001" });
    expect(parseReferenceInput("www.persee.fr/doc/x")).toEqual({ kind: "url", url: "https://www.persee.fr/doc/x" });
    expect(parseReferenceInput("un titre d'article")).toBeNull();
    expect(parseReferenceInput("")).toBeNull();
  });

  it("extrait le DOI d'une adresse d'éditeur", () => {
    expect(findDoi("https://onlinelibrary.wiley.com/doi/10.1111/j.1467-9566.2010.01234.x/abstract")).toBe("10.1111/j.1467-9566.2010.01234.x");
    expect(findDoi("https://link.springer.com/article/10.1007/s11192-020-03690-4?utm=x")).toBe("10.1007/s11192-020-03690-4");
    expect(findDoi("https://www.tandfonline.com/doi/full/10.1080%2F01419870.2020.1234567")).toBe("10.1080/01419870.2020.1234567");
    expect(findDoi("voir doi:10.1000/abc.")).toBe("10.1000/abc");
    expect(findDoi("https://exemple.fr/article")).toBe("");
  });

  it("ne confond pas une adresse quelconque avec arXiv", () => {
    expect(findArxivId("https://exemple.fr/2401.01234")).toBe("");
  });
});

describe("normalisation", () => {
  it("ramène les dates à AAAA-MM-JJ", () => {
    expect(normalizeDate("2024/3/1")).toBe("2024-03-01");
    expect(normalizeDate("2024-03-01T10:00:00Z")).toBe("2024-03-01");
    expect(normalizeDate("2024")).toBe("2024");
    expect(normalizeDate("01/03/2024")).toBe("2024-03-01");
    expect(normalizeDate("March 5, 2021")).toBe("2021-03-05");
    expect(normalizeDate("")).toBe("");
  });

  it("découpe les noms d'auteurs", () => {
    expect(parseAuthorName("Dupont, Marie")).toEqual({ family: "Dupont", given: "Marie" });
    expect(parseAuthorName("Jean-Pierre Martin")).toEqual({ family: "Martin", given: "Jean-Pierre" });
    expect(parseAuthorName("UNESCO")).toEqual({ family: "UNESCO", given: "" });
    expect(parseAuthorName("Isis Von Plato")).toEqual({ family: "Von Plato", given: "Isis" });
    expect(parseAuthorName("Jean de La Fontaine")).toEqual({ family: "de La Fontaine", given: "Jean" });
    expect(parseAuthorName("no author")).toBeNull();
    expect(parseAuthorName("https://www.facebook.com/x")).toBeNull();
  });
});

describe("parseReferenceHtml", () => {
  it("lit les balises citation_* d'un article", () => {
    const html = `<head><title>Revue</title>
      <meta name="citation_title" content="L&#39;enquête ethnographique">
      <meta name="citation_author" content="Dupont, Marie">
      <meta name="citation_author" content="Martin, Paul">
      <meta name="citation_journal_title" content="Sociologie du travail">
      <meta name="citation_publication_date" content="2024/03/01">
      <meta name="citation_volume" content="66"><meta name="citation_issue" content="1">
      <meta name="citation_firstpage" content="45"><meta name="citation_lastpage" content="67">
      <meta name="citation_doi" content="10.4000/sdt.1234">
      <meta name="citation_keywords" content="terrain; méthode">
      <meta name="citation_pdf_url" content="https://revue.org/pdf/1">
      <meta name="citation_abstract" content="&lt;p&gt;Premier paragraphe.&lt;/p&gt;&lt;p&gt;Second.&lt;/p&gt;">
      </head>`;
    const r = parseReferenceHtml(html, "https://revue.org/1");
    expect(r).toMatchObject({
      type: "article",
      title: "L'enquête ethnographique",
      authors: [
        { family: "Dupont", given: "Marie" },
        { family: "Martin", given: "Paul" },
      ],
      container: "Sociologie du travail",
      date: "2024-03-01",
      volume: "66",
      issue: "1",
      pages: "45–67",
      doi: "10.4000/sdt.1234",
      keywords: ["terrain", "méthode"],
      pdfUrl: "https://revue.org/pdf/1",
    });
    expect(r.abstract).toBe("Premier paragraphe.\n\nSecond.");
  });

  it("utilise les données structurées JSON-LD", () => {
    const html = `<title>x</title><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Site"},
      {"@type":"NewsArticle","headline":"Une enquête","datePublished":"2023-11-02T08:00:00+01:00",
       "author":[{"@type":"Person","name":"Claire Petit"}],"publisher":{"@type":"Organization","name":"Le Journal"},
       "description":"Chapeau de l'article."}]}</script>`;
    const r = parseReferenceHtml(html, "https://journal.fr/a");
    expect(r).toMatchObject({
      type: "news",
      title: "Une enquête",
      date: "2023-11-02",
      authors: [{ family: "Petit", given: "Claire" }],
      publisher: "Le Journal",
      abstract: "Chapeau de l'article.",
    });
  });

  it("se contente du titre et du site pour une page ordinaire", () => {
    const r = parseReferenceHtml(`<title>Accueil</title><meta property="og:site_name" content="Mon labo">`, "https://labo.fr/");
    expect(r).toMatchObject({ type: "web", title: "Accueil", site: "Mon labo", authors: [] });
  });
});

describe("sources bibliographiques", () => {
  it("lit une notice Crossref", () => {
    const r = parseCrossref({
      DOI: "10.1000/xyz",
      type: "journal-article",
      title: ["Qualitative methods"],
      subtitle: ["A review"],
      author: [{ given: "Marie", family: "Dupont" }, { name: "Groupe ABC" }],
      "published-print": { "date-parts": [[2021, 6]] },
      "container-title": ["Revue X"],
      volume: "12",
      issue: "3",
      page: "45-67",
      publisher: "Éditions Y",
      abstract: "<jats:title>Abstract</jats:title><jats:p>Texte du résumé.</jats:p>",
      subject: ["Sociology"],
    });
    expect(r).toMatchObject({
      url: "https://doi.org/10.1000/xyz",
      type: "article",
      title: "Qualitative methods : A review",
      authors: [
        { family: "Dupont", given: "Marie" },
        { family: "Groupe ABC", given: "" },
      ],
      date: "2021-06",
      container: "Revue X",
      pages: "45–67",
      abstract: "Texte du résumé.",
      keywords: ["Sociology"],
    });
  });

  it("reconstruit un résumé OpenAlex", () => {
    expect(abstractFromInvertedIndex({ monde: [2], Le: [0], vaste: [1] })).toBe("Le vaste monde");
    expect(abstractFromInvertedIndex(null)).toBe("");
  });

  it("lit une entrée arXiv", () => {
    const xml = `<feed><entry><id>http://arxiv.org/abs/2401.01234v1</id>
      <published>2024-01-02T18:00:00Z</published>
      <title>Attention is
        all you need</title>
      <summary>  Un résumé &amp; plus. </summary>
      <author><name>Ashish Vaswani</name></author><author><name>Noam Shazeer</name></author>
      <arxiv:doi>10.1000/pub</arxiv:doi>
      <category term="cs.CL" scheme="x"/></entry></feed>`;
    expect(parseArxivAtom(xml, "2401.01234")).toMatchObject({
      type: "preprint",
      title: "Attention is all you need",
      date: "2024-01-02",
      abstract: "Un résumé & plus.",
      authors: [
        { family: "Vaswani", given: "Ashish" },
        { family: "Shazeer", given: "Noam" },
      ],
      doi: "10.1000/pub",
      arxiv: "2401.01234",
      keywords: ["cs.CL"],
      pdfUrl: "https://arxiv.org/pdf/2401.01234",
    });
    expect(parseArxivAtom("<feed></feed>", "x")).toBeNull();
  });
});

describe("note de lecture", () => {
  const ref = parseCrossref({
    DOI: "10.1000/xyz",
    type: "journal-article",
    title: ["Qualitative methods"],
    author: [
      { given: "Marie-Claire", family: "Dupont" },
      { given: "Paul", family: "Martin" },
    ],
    issued: { "date-parts": [[2021]] },
    "container-title": ["Revue X"],
    volume: "12",
    issue: "3",
    page: "45-67",
    abstract: "<p>Premier.</p><p>Second.</p>",
  });

  it("met en forme la citation", () => {
    expect(citationText(ref)).toBe("Dupont, M.-C. & Martin, P. (2021). Qualitative methods. Revue X, 12(3), 45–67. https://doi.org/10.1000/xyz");
  });

  it("produit une note avec fiche, référence, résumé et section de notes", () => {
    const doc = referenceToDoc(ref);
    const md = docToMarkdown(doc);
    expect(md).toContain("> [Qualitative methods](https://doi.org/10.1000/xyz)");
    expect(md).toContain("## Référence");
    expect(md).toContain("- **Auteurs :** Marie-Claire Dupont, Paul Martin");
    expect(md).toContain("- **Publication :** Revue X, vol. 12, n° 3, p. 45–67");
    expect(md).toContain("## Résumé\n\nPremier.\n\nSecond.");
    expect(md).toContain("## Notes de lecture");
    expect(docToText(doc)).toContain("10.1000/xyz");
    // Aucun nœud texte vide (refusé par l'éditeur)
    const walk = (n: { text?: string; type?: string; content?: unknown[] }): boolean =>
      (n.type !== "text" || !!n.text) && (n.content ?? []).every((c) => walk(c as typeof n));
    expect(walk(doc)).toBe(true);
  });
});
