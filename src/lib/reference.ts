// Référence d'une publication (article, livre, page web…) extraite d'un lien,
// d'un DOI ou d'un identifiant arXiv, et note de lecture qui en découle.
import { clean, decodeEntities, metaTags, safeHost } from "./linkMeta";
import type { JSONNode } from "./text";

export type RefType =
  | "article"
  | "preprint"
  | "book"
  | "chapter"
  | "conference"
  | "thesis"
  | "report"
  | "dataset"
  | "news"
  | "web";

export const REF_TYPE_LABELS: Record<RefType, string> = {
  article: "Article de revue",
  preprint: "Prépublication",
  book: "Livre",
  chapter: "Chapitre de livre",
  conference: "Communication",
  thesis: "Thèse",
  report: "Rapport",
  dataset: "Jeu de données",
  news: "Article de presse",
  web: "Page web",
};

/** Nom d'auteur ; une organisation n'a qu'un `family`. */
export type Author = { given: string; family: string };

export type Reference = {
  url: string;
  type: RefType;
  title: string;
  authors: Author[];
  /** AAAA-MM-JJ, AAAA-MM ou AAAA quand la date est reconnue, sinon telle que fournie */
  date: string;
  /** Revue, actes, ouvrage collectif… */
  container: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
  /** Nom du site (pages web) */
  site: string;
  doi: string;
  isbn: string;
  arxiv: string;
  abstract: string;
  keywords: string[];
  pdfUrl: string;
};

export function emptyReference(url: string): Reference {
  return {
    url,
    type: "web",
    title: "",
    authors: [],
    date: "",
    container: "",
    volume: "",
    issue: "",
    pages: "",
    publisher: "",
    site: safeHost(url),
    doi: "",
    isbn: "",
    arxiv: "",
    abstract: "",
    keywords: [],
    pdfUrl: "",
  };
}

// ---------------------------------------------------------------------------
// Identifiants

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"'<>]+)/i;

/** Premier DOI trouvé dans un texte ou une adresse. */
export function findDoi(text: string): string {
  let t = text;
  try {
    t = decodeURIComponent(text);
  } catch {}
  const m = t.match(DOI_RE);
  if (!m) return "";
  return m[1]
    .replace(/[?#].*$/, "")
    .replace(/\/(abstract|full|pdf|epdf|html|fulltext|summary|references)$/i, "")
    .replace(/[.,;:)\]}]+$/, "");
}

/** Identifiant PubMed d'une adresse pubmed.ncbi.nlm.nih.gov. */
export function findPmid(url: string): string {
  return url.match(/(?:pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov\/pubmed)\/(\d+)/i)?.[1] ?? "";
}

/** Page de vérification anti-robot (captcha, défi JavaScript) au lieu du contenu. */
export function isChallengePage(html: string): boolean {
  const head = html.slice(0, 20_000);
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  if (/captcha|just a moment|client challenge|not a bot|verify you are human|attention required|vérification de votre navigateur|checking your browser/i.test(title)) {
    return true;
  }
  if (/id=["']?anubis_challenge/i.test(head)) return true;
  // Un captcha mentionné dans une page qui décrit bien son contenu n'est pas un blocage.
  return /g-recaptcha|hcaptcha|cf-challenge/i.test(head) && !/<meta[^>]+(og:title|citation_title)/i.test(html.slice(0, 500_000));
}

const ARXIV_RE = /^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(v\d+)?$/i;

/** Identifiant arXiv (sans version) d'une adresse arxiv.org ou d'un texte « arXiv:… ». */
export function findArxivId(text: string): string {
  const t = text.trim();
  const fromUrl = t.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#]+?)(?:\.pdf)?\/?(?:[?#]|$)/i)?.[1];
  const candidate = fromUrl ?? t.replace(/^arxiv:\s*/i, "");
  const m = candidate.match(ARXIV_RE);
  return m && (fromUrl || /^arxiv:/i.test(t) || /^\d{4}\.\d{4,5}(v\d+)?$/.test(t)) ? m[1] : "";
}

export type ReferenceInput = { kind: "doi"; doi: string } | { kind: "arxiv"; id: string } | { kind: "url"; url: string };

/** Interprète ce que l'utilisateur a saisi : adresse web, DOI ou identifiant arXiv. */
export function parseReferenceInput(text: string): ReferenceInput | null {
  const t = text.trim();
  if (!t || /\s/.test(t.replace(/^(doi|arxiv):\s+/i, ""))) return null;
  const arxiv = findArxivId(t);
  if (arxiv) return { kind: "arxiv", id: arxiv };
  // DOI attribué par arXiv : l'API arXiv est plus complète que DataCite.
  const arxivDoi = findDoi(t).match(/^10\.48550\/arxiv\.(.+)$/i)?.[1];
  if (arxivDoi && ARXIV_RE.test(arxivDoi)) return { kind: "arxiv", id: arxivDoi.replace(/v\d+$/, "") };
  if (/^(doi:\s*)?10\.\d{4,9}\//i.test(t) || /^https?:\/\/(dx\.)?doi\.org\//i.test(t)) {
    const doi = findDoi(t);
    if (doi) return { kind: "doi", doi };
  }
  const candidate = /^www\./i.test(t) ? "https://" + t : t;
  try {
    const u = new URL(candidate);
    if (u.protocol === "http:" || u.protocol === "https:") return { kind: "url", url: u.toString() };
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// Petits utilitaires

/** Date reconnue ramenée à AAAA-MM-JJ, AAAA-MM ou AAAA. */
export function normalizeDate(raw: string): string {
  const s = clean(raw, 60);
  if (!s) return "";
  const iso = s.match(/^(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?(?:$|[T\s])/);
  if (iso) return [iso[1], iso[2], iso[3]].filter(Boolean).map((p, i) => (i ? p.padStart(2, "0") : p)).join("-");
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(s)) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return s;
}

export function yearOf(date: string): string {
  return date.match(/\d{4}/)?.[0] ?? "";
}

const PARTICLES = new Set(["de", "du", "des", "d'", "la", "le", "von", "van", "der", "den", "da", "di", "del", "della", "dos", "ter", "ten"]);

/** « Dupont, Marie », « Marie Dupont » ou un nom d'organisation. */
export function parseAuthorName(raw: string): Author | null {
  const s = clean(raw, 120).replace(/\s*\d+$/, "");
  if (!s || /^https?:/i.test(s) || /^(no author|unknown|anonymous|anonyme|admin|n\/a)$/i.test(s)) return null;
  if (s.includes(",")) {
    const [family, ...rest] = s.split(",");
    return { family: family.trim(), given: rest.join(",").trim() };
  }
  const parts = s.split(" ");
  if (parts.length === 1) return { family: s, given: "" };
  // Particules : « Jean de La Fontaine », « Isis von Plato », « Ludwig van Beethoven »
  const particle = parts.findIndex((p, i) => i > 0 && i < parts.length - 1 && PARTICLES.has(p.toLowerCase()));
  const split = particle > 0 ? particle : parts.length - 1;
  return { family: parts.slice(split).join(" "), given: parts.slice(0, split).join(" ") };
}

export function authorName(a: Author): string {
  return [a.given, a.family].filter(Boolean).join(" ");
}

/** Auteurs pour une ligne courte : « A, B et C » ou « A et al. ». */
export function shortAuthors(authors: Author[], max = 3): string {
  const names = authors.map(authorName);
  if (names.length > max) return `${names[0]} et al.`;
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

function uniqueAuthors(list: (Author | null)[]): Author[] {
  const seen = new Set<string>();
  const out: Author[] = [];
  for (const a of list) {
    if (!a) continue;
    const key = authorName(a).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/** Texte brut d'un fragment HTML ou JATS, paragraphes séparés par une ligne vide. */
export function markupToText(raw: string): string {
  // Balises <meta> : le HTML du résumé y est lui-même encodé (&lt;p&gt;…).
  const markup = !raw.includes("<") && /&lt;\/?[a-z]/i.test(raw) ? decodeEntities(raw) : raw;
  return decodeEntities(
    markup
      .replace(/<(jats:)?title[^>]*>\s*(abstract|résumé|summary)\s*<\/(jats:)?title>/gi, "")
      .replace(/<\/(jats:)?p>|<br\s*\/?>|<\/(jats:)?sec>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function splitKeywords(values: string[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    for (const k of v.split(/[;,]/)) {
      const t = clean(k, 80);
      if (t) out.add(t);
    }
  }
  return [...out].slice(0, 20);
}

function pagesOf(first: string, last: string): string {
  const f = clean(first, 20);
  const l = clean(last, 20);
  return f && l && f !== l ? `${f}–${l}` : f;
}

/** Complète `primary` avec les champs vides de `secondary`. */
export function mergeReferences(primary: Reference, secondary: Reference): Reference {
  const out = { ...primary };
  for (const key of Object.keys(secondary) as (keyof Reference)[]) {
    const v = out[key];
    const empty = Array.isArray(v) ? v.length === 0 : !v;
    if (empty) (out as Record<string, unknown>)[key] = secondary[key];
  }
  // Une page web « générique » ne doit pas remplacer un type plus précis
  if (primary.type === "web" && secondary.type !== "web") out.type = secondary.type;
  return out;
}

// ---------------------------------------------------------------------------
// Pages HTML : balises citation_* (Highwire, Google Scholar), Dublin Core, PRISM,
// Open Graph et données structurées JSON-LD (schema.org).

type JsonLd = Record<string, unknown>;

function jsonLdNodes(html: string): JsonLd[] {
  const out: JsonLd[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const o = v as JsonLd;
      out.push(o);
      if (o["@graph"]) visit(o["@graph"]);
    }
  };
  for (const m of html.matchAll(/<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {}
  }
  return out;
}

const LD_TYPES: Record<string, RefType> = {
  scholarlyarticle: "article",
  medicalscholarlyarticle: "article",
  article: "web",
  newsarticle: "news",
  reportagenewsarticle: "news",
  blogposting: "web",
  book: "book",
  chapter: "chapter",
  thesis: "thesis",
  report: "report",
  dataset: "dataset",
};

function ldType(node: JsonLd): RefType | null {
  const types = ([] as unknown[]).concat(node["@type"] ?? []).map((t) => String(t).toLowerCase());
  for (const t of types) if (t in LD_TYPES) return LD_TYPES[t];
  return null;
}

function ldText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return ldText(v[0]);
  if (v && typeof v === "object") {
    const o = v as JsonLd;
    return ldText(o.name ?? o["@value"] ?? o.headline ?? "");
  }
  return "";
}

function ldAuthors(v: unknown): Author[] {
  return uniqueAuthors(
    ([] as unknown[]).concat(v ?? []).map((a) => {
      if (typeof a === "string") return parseAuthorName(a);
      if (a && typeof a === "object") {
        const o = a as JsonLd;
        if (String(o["@type"] ?? "").toLowerCase() === "organization") return { family: clean(ldText(o.name), 160), given: "" };
        if (o.familyName) return { family: clean(ldText(o.familyName), 80), given: clean(ldText(o.givenName), 80) };
        return parseAuthorName(ldText(o.name));
      }
      return null;
    }),
  );
}

function fromJsonLd(html: string, url: string): Reference | null {
  const node = jsonLdNodes(html).find((n) => ldType(n));
  if (!node) return null;
  const ref = emptyReference(url);
  ref.type = ldType(node)!;
  ref.title = clean(ldText(node.headline ?? node.name), 400);
  ref.authors = ldAuthors(node.author ?? node.creator);
  ref.date = normalizeDate(ldText(node.datePublished ?? node.dateCreated));
  ref.abstract = markupToText(ldText(node.abstract ?? node.description));
  ref.publisher = clean(ldText(node.publisher), 160);
  ref.container = clean(ldText((node.isPartOf as JsonLd | undefined)?.name ?? node.isPartOf), 200);
  const kw = node.keywords;
  ref.keywords = splitKeywords(Array.isArray(kw) ? kw.map(ldText) : kw ? [ldText(kw)] : []);
  ref.doi = findDoi(ldText(node.identifier) + " " + ldText(node.sameAs));
  ref.isbn = clean(ldText(node.isbn), 40);
  return ref;
}

const META_TYPES: [RegExp, RefType][] = [
  [/^citation_conference_title$/, "conference"],
  [/^citation_dissertation_institution$/, "thesis"],
  [/^citation_technical_report_institution$/, "report"],
  [/^citation_inbook_title$/, "chapter"],
  [/^citation_arxiv_id$/, "preprint"],
  [/^citation_journal_title$/, "article"],
  [/^citation_isbn$/, "book"],
];

/** Référence décrite par une page HTML. */
export function parseReferenceHtml(html: string, url: string): Reference {
  const head = html.slice(0, 1_000_000);
  const meta = metaTags(head);
  const all = (...keys: string[]) => keys.flatMap((k) => meta.get(k) ?? []).filter((v) => v.trim());
  const first = (...keys: string[]) => all(...keys)[0] ?? "";

  const ref = emptyReference(url);
  for (const [re, type] of META_TYPES) {
    if ([...meta.keys()].some((k) => re.test(k))) {
      ref.type = type;
      break;
    }
  }
  if (ref.type === "web") {
    const og = first("og:type").toLowerCase();
    if (og === "article" && all("article:published_time").length) ref.type = "news";
    if (og === "book" || og === "books.book") ref.type = "book";
  }

  ref.title = clean(first("citation_title", "dc.title", "dcterms.title", "og:title", "twitter:title"), 400);

  const authorValues = all("citation_author");
  const separated = first("citation_authors");
  ref.authors = uniqueAuthors(
    (authorValues.length ? authorValues : separated ? separated.split(";") : all("dc.creator", "dcterms.creator", "author", "article:author")).map(
      parseAuthorName,
    ),
  );

  ref.date = normalizeDate(
    first(
      "citation_publication_date",
      "citation_date",
      "citation_online_date",
      "prism.publicationdate",
      "dc.date",
      "dcterms.issued",
      "dcterms.date",
      "article:published_time",
    ),
  );
  ref.container = clean(
    first("citation_journal_title", "citation_conference_title", "citation_inbook_title", "citation_book_title", "prism.publicationname"),
    200,
  );
  ref.volume = clean(first("citation_volume", "prism.volume"), 20);
  ref.issue = clean(first("citation_issue", "prism.number"), 20);
  ref.pages = pagesOf(first("citation_firstpage", "prism.startingpage"), first("citation_lastpage", "prism.endingpage"));
  ref.publisher = clean(
    first("citation_publisher", "citation_dissertation_institution", "citation_technical_report_institution", "dc.publisher", "dcterms.publisher"),
    160,
  );
  ref.site = clean(first("og:site_name", "application-name"), 120) || safeHost(url);
  ref.doi = findDoi(first("citation_doi", "prism.doi", "dc.identifier", "dcterms.identifier", "bepress_citation_doi"));
  ref.isbn = clean(first("citation_isbn"), 40);
  ref.arxiv = clean(first("citation_arxiv_id"), 40);
  ref.abstract = markupToText(first("citation_abstract", "dc.description", "dcterms.abstract", "og:description", "description"));
  ref.keywords = splitKeywords(all("citation_keywords", "keywords", "dc.subject", "article:tag"));
  ref.pdfUrl = clean(first("citation_pdf_url"), 500);

  const ld = fromJsonLd(head, url);
  const merged = ld ? mergeReferences(ref, ld) : ref;
  // Les balises citation_* priment ; JSON-LD précise le type d'une simple page.
  if (ld && ref.type === "web") merged.type = ld.type;
  if (!merged.title) merged.title = clean(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 400) || safeHost(url);
  return merged;
}

// ---------------------------------------------------------------------------
// Crossref (https://api.crossref.org/works/<DOI>)

const CROSSREF_TYPES: Record<string, RefType> = {
  "journal-article": "article",
  "proceedings-article": "conference",
  "book-chapter": "chapter",
  "book-section": "chapter",
  "book-part": "chapter",
  book: "book",
  monograph: "book",
  "edited-book": "book",
  "reference-book": "book",
  "posted-content": "preprint",
  dissertation: "thesis",
  report: "report",
  dataset: "dataset",
};

type CrossrefDate = { "date-parts"?: (number | null)[][] };

function crossrefDate(...dates: (CrossrefDate | undefined)[]): string {
  for (const d of dates) {
    const parts = d?.["date-parts"]?.[0]?.filter((p): p is number => typeof p === "number");
    if (parts?.length) return parts.map((p, i) => (i ? String(p).padStart(2, "0") : String(p))).join("-");
  }
  return "";
}

/** Référence à partir de la réponse de l'API Crossref (`message`). */
export function parseCrossref(message: Record<string, unknown>): Reference {
  const m = message as {
    DOI?: string;
    URL?: string;
    type?: string;
    title?: string[];
    subtitle?: string[];
    author?: { given?: string; family?: string; name?: string }[];
    editor?: { given?: string; family?: string; name?: string }[];
    issued?: CrossrefDate;
    "published-print"?: CrossrefDate;
    "published-online"?: CrossrefDate;
    created?: CrossrefDate;
    "container-title"?: string[];
    volume?: string;
    issue?: string;
    page?: string;
    publisher?: string;
    ISBN?: string[];
    abstract?: string;
    subject?: string[];
    institution?: { name?: string }[];
  };
  const doi = m.DOI ?? "";
  const ref = emptyReference(doi ? `https://doi.org/${doi}` : m.URL ?? "");
  ref.type = CROSSREF_TYPES[m.type ?? ""] ?? "article";
  // Crossref garde parfois le balisage des titres (<i>, <sub>…).
  const title = clean(markupToText(m.title?.[0] ?? ""), 400);
  const subtitle = clean(markupToText(m.subtitle?.[0] ?? ""), 300);
  ref.title = subtitle && !title.includes(subtitle) ? `${title} : ${subtitle}` : title;
  ref.authors = uniqueAuthors(
    (m.author?.length ? m.author : m.editor ?? []).map((a) =>
      a.family ? { family: clean(a.family, 80), given: clean(a.given, 80) } : a.name ? { family: clean(a.name, 160), given: "" } : null,
    ),
  );
  ref.date = crossrefDate(m["published-print"], m["published-online"], m.issued, m.created);
  ref.container = clean(markupToText(m["container-title"]?.[0] ?? ""), 200);
  ref.volume = clean(m.volume, 20);
  ref.issue = clean(m.issue, 20);
  ref.pages = clean(m.page, 30).replace(/-/g, "–");
  ref.publisher = clean(m.publisher || m.institution?.[0]?.name, 160);
  ref.site = "";
  ref.doi = doi;
  ref.isbn = clean(m.ISBN?.[0], 40);
  ref.abstract = m.abstract ? markupToText(m.abstract) : "";
  ref.keywords = splitKeywords(m.subject ?? []);
  return ref;
}

// ---------------------------------------------------------------------------
// OpenAlex : résumé stocké sous forme d'index inversé { mot: [positions] }

const OPENALEX_TYPES: Record<string, RefType> = {
  article: "article",
  review: "article",
  letter: "article",
  editorial: "article",
  preprint: "preprint",
  book: "book",
  "book-chapter": "chapter",
  dissertation: "thesis",
  report: "report",
  dataset: "dataset",
};

type OpenAlexWork = {
  doi?: string | null;
  title?: string | null;
  type?: string | null;
  publication_date?: string | null;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string; host_organization_name?: string } | null } | null;
  best_oa_location?: { pdf_url?: string | null } | null;
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null };
  abstract_inverted_index?: Record<string, number[]> | null;
  keywords?: { display_name?: string }[];
};

/** Référence à partir d'une notice OpenAlex (https://api.openalex.org/works/…). */
export function parseOpenAlexWork(work: OpenAlexWork): Reference {
  const doi = findDoi(work.doi ?? "");
  const ref = emptyReference(doi ? `https://doi.org/${doi}` : work.primary_location?.landing_page_url ?? "");
  ref.type = OPENALEX_TYPES[work.type ?? ""] ?? "article";
  ref.title = clean(work.title ?? "", 400);
  ref.authors = uniqueAuthors((work.authorships ?? []).map((a) => parseAuthorName(a.author?.display_name ?? "")));
  ref.date = normalizeDate(work.publication_date ?? "");
  const source = work.primary_location?.source;
  ref.container = clean(source?.display_name, 200);
  ref.publisher = clean(source?.host_organization_name, 160);
  ref.site = "";
  ref.volume = clean(work.biblio?.volume ?? "", 20);
  ref.issue = clean(work.biblio?.issue ?? "", 20);
  ref.pages = pagesOf(work.biblio?.first_page ?? "", work.biblio?.last_page ?? "");
  ref.doi = doi;
  ref.abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
  ref.keywords = splitKeywords((work.keywords ?? []).map((k) => k.display_name ?? ""));
  ref.pdfUrl = work.best_oa_location?.pdf_url ?? "";
  return ref;
}

// ---------------------------------------------------------------------------
// DataCite (https://api.datacite.org/dois/<DOI>) : Zenodo, arXiv, jeux de données…

const DATACITE_TYPES: Record<string, RefType> = {
  journalarticle: "article",
  preprint: "preprint",
  book: "book",
  bookchapter: "chapter",
  conferencepaper: "conference",
  dissertation: "thesis",
  report: "report",
  dataset: "dataset",
};

type DataCiteAttributes = {
  doi?: string;
  url?: string;
  titles?: { title?: string }[];
  creators?: { name?: string; givenName?: string; familyName?: string; nameType?: string }[];
  publicationYear?: number | string;
  dates?: { date?: string; dateType?: string }[];
  publisher?: string | { name?: string };
  container?: { title?: string; volume?: string; issue?: string; firstPage?: string; lastPage?: string };
  descriptions?: { description?: string; descriptionType?: string }[];
  subjects?: { subject?: string }[];
  types?: { resourceTypeGeneral?: string; resourceType?: string };
};

export function parseDataCite(a: DataCiteAttributes): Reference {
  const doi = a.doi ?? "";
  const ref = emptyReference(doi ? `https://doi.org/${doi}` : a.url ?? "");
  const general = (a.types?.resourceTypeGeneral ?? "").toLowerCase().replace(/[^a-z]/g, "");
  ref.type = DATACITE_TYPES[general] ?? (general === "text" ? "article" : "report");
  ref.title = clean(a.titles?.[0]?.title, 400);
  ref.authors = uniqueAuthors(
    (a.creators ?? []).map((c) =>
      c.familyName
        ? { family: clean(c.familyName, 80), given: clean(c.givenName, 80) }
        : c.nameType === "Organizational"
          ? { family: clean(c.name, 160), given: "" }
          : parseAuthorName(c.name ?? ""),
    ),
  );
  const issued = a.dates?.find((d) => d.dateType === "Issued")?.date;
  ref.date = normalizeDate(issued ?? String(a.publicationYear ?? ""));
  ref.publisher = clean(typeof a.publisher === "string" ? a.publisher : a.publisher?.name, 160);
  ref.container = clean(a.container?.title, 200);
  ref.volume = clean(a.container?.volume, 20);
  ref.issue = clean(a.container?.issue, 20);
  ref.pages = pagesOf(a.container?.firstPage ?? "", a.container?.lastPage ?? "");
  ref.site = "";
  ref.doi = doi;
  ref.abstract = markupToText(a.descriptions?.find((d) => d.descriptionType === "Abstract")?.description ?? "");
  ref.keywords = splitKeywords((a.subjects ?? []).map((x) => x.subject ?? ""));
  ref.arxiv = /^10\.48550\/arxiv\./i.test(doi) ? doi.replace(/^10\.48550\/arxiv\./i, "") : "";
  return ref;
}

export function abstractFromInvertedIndex(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter((w) => w !== undefined).join(" ").trim();
}

// ---------------------------------------------------------------------------
// arXiv (https://export.arxiv.org/api/query?id_list=<id>, flux Atom)

export function parseArxivAtom(xml: string, id: string): Reference | null {
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  if (!entry) return null;
  const tag = (name: string) => decodeEntities(entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "").trim();
  const title = clean(tag("title"), 400);
  if (!title || /^error$/i.test(title)) return null;
  const ref = emptyReference(`https://arxiv.org/abs/${id}`);
  ref.type = "preprint";
  ref.title = title;
  ref.authors = uniqueAuthors([...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => parseAuthorName(m[1])));
  ref.date = normalizeDate(tag("published"));
  ref.abstract = clean(tag("summary"), 10_000);
  ref.container = clean(tag("arxiv:journal_ref"), 200);
  ref.doi = findDoi(tag("arxiv:doi"));
  ref.publisher = "arXiv";
  ref.site = "arXiv";
  ref.arxiv = id;
  ref.keywords = [...entry.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => m[1]).slice(0, 10);
  ref.pdfUrl = `https://arxiv.org/pdf/${id}`;
  return ref;
}

// ---------------------------------------------------------------------------
// Citation (style auteur-date, proche d'APA) et note de lecture

export type Segment = { text: string; italic?: boolean };

function initials(given: string): string {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .map((p) => (p.endsWith(".") && p.length <= 3 ? p : p[0].toUpperCase() + "."))
        .join("-"),
    )
    .join(" ");
}

function citationAuthors(authors: Author[]): string {
  const names = authors.map((a) => (a.given ? `${a.family}, ${initials(a.given)}` : a.family));
  if (names.length > 20) return `${names.slice(0, 19).join(", ")}, … ${names[names.length - 1]}`;
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

const endWithDot = (s: string) => (/[.?!…]$/.test(s) ? s : s + ".");

/** Citation mise en forme, en segments (italique pour les titres d'ouvrage et de revue). */
export function formatCitation(ref: Reference): Segment[] {
  const out: Segment[] = [];
  const year = yearOf(ref.date) || "s. d.";
  const authors = citationAuthors(ref.authors);
  const standalone = ref.type === "book" || ref.type === "thesis" || ref.type === "report" || ref.type === "dataset" || !ref.container;

  if (authors) out.push({ text: `${endWithDot(authors)} (${year}). ` });
  if (standalone) out.push({ text: endWithDot(ref.title), italic: true });
  else out.push({ text: endWithDot(ref.title) });
  if (!authors) out.push({ text: ` (${year}).` });

  if (!standalone) {
    if (ref.type === "chapter" || ref.type === "conference") {
      out.push({ text: " In " }, { text: ref.container, italic: true });
      out.push({ text: ref.pages ? ` (p. ${ref.pages}).` : "." });
    } else {
      out.push({ text: " " }, { text: ref.container, italic: true });
      if (ref.volume) out.push({ text: ", " }, { text: ref.volume, italic: true });
      if (ref.issue) out.push({ text: `(${ref.issue})` });
      if (ref.pages) out.push({ text: `, ${ref.pages}` });
      out.push({ text: "." });
    }
  }
  const publisher = ref.publisher && ref.publisher !== ref.container ? ref.publisher : ref.type === "web" ? ref.site : "";
  if (publisher && (standalone || ref.type === "chapter" || ref.type === "conference")) out.push({ text: ` ${endWithDot(publisher)}` });
  out.push({ text: ` ${ref.doi ? `https://doi.org/${ref.doi}` : ref.url}` });
  return out;
}

export function citationText(ref: Reference): string {
  return formatCitation(ref)
    .map((s) => s.text)
    .join("");
}

/** Détails de la publication : « Revue, vol. 12, n° 3, p. 45–67 ». */
export function publicationLine(ref: Reference): string {
  return [
    ref.container,
    ref.volume && `vol. ${ref.volume}`,
    ref.issue && `n° ${ref.issue}`,
    ref.pages && `p. ${ref.pages}`,
  ]
    .filter(Boolean)
    .join(", ");
}

const text = (t: string, marks?: JSONNode["marks"]): JSONNode => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const link = (href: string, label = href): JSONNode => text(label, [{ type: "link", attrs: { href } }]);
const paragraph = (...content: JSONNode[]): JSONNode => ({ type: "paragraph", ...(content.length ? { content } : {}) });
const heading = (t: string): JSONNode => ({ type: "heading", attrs: { level: 2 }, content: [text(t)] });

function field(label: string, ...value: JSONNode[]): JSONNode {
  return { type: "listItem", content: [paragraph(text(`${label} : `, [{ type: "bold" }]), ...value)] };
}

/** Contenu de la note de lecture créée à partir d'une référence. */
export function referenceToDoc(ref: Reference): JSONNode {
  const site = ref.container || ref.site || safeHost(ref.url);
  const card: JSONNode = {
    type: "linkCard",
    attrs: {
      url: ref.url,
      title: ref.title,
      description: "",
      site,
      authors: shortAuthors(ref.authors),
      date: ref.date,
    },
  };

  const items: JSONNode[] = [field("Type", text(REF_TYPE_LABELS[ref.type]))];
  if (ref.authors.length) items.push(field(ref.authors.length > 1 ? "Auteurs" : "Auteur", text(ref.authors.map(authorName).join(", "))));
  if (ref.date) items.push(field("Date", text(ref.date)));
  const publication = publicationLine(ref);
  if (publication) items.push(field("Publication", text(publication)));
  if (ref.publisher && ref.publisher !== ref.container) items.push(field("Éditeur", text(ref.publisher)));
  if (ref.doi) items.push(field("DOI", link(`https://doi.org/${ref.doi}`, ref.doi)));
  if (ref.arxiv) items.push(field("arXiv", link(`https://arxiv.org/abs/${ref.arxiv}`, ref.arxiv)));
  if (ref.isbn) items.push(field("ISBN", text(ref.isbn)));
  if (ref.pdfUrl) items.push(field("PDF", link(ref.pdfUrl)));
  if (ref.keywords.length) items.push(field("Mots-clés", text(ref.keywords.join(", "))));

  const citation = formatCitation(ref)
    .filter((s) => s.text)
    .map((s) => text(s.text, s.italic ? [{ type: "italic" }] : undefined));

  const content: JSONNode[] = [
    card,
    heading("Référence"),
    { type: "bulletList", content: items },
    { type: "blockquote", content: [paragraph(...citation)] },
  ];
  if (ref.abstract) {
    content.push(heading("Résumé"), ...ref.abstract.split(/\n\s*\n/).map((p) => paragraph(text(p))));
  }
  content.push(heading("Notes de lecture"), paragraph());
  return { type: "doc", content };
}
