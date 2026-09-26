import "server-only";
import {
  emptyReference,
  findDoi,
  findPmid,
  isChallengePage,
  mergeReferences,
  parseArxivAtom,
  parseCrossref,
  parseDataCite,
  parseOpenAlexWork,
  parseReferenceHtml,
  type Reference,
  type ReferenceInput,
} from "@/lib/reference";
import { safeHost } from "@/lib/linkMeta";
import { decodeHtml, fetchJson, fetchWeb, readLimited } from "./web";

export type ReferenceResult = Reference & {
  /** Sources consultées avec succès (page, Crossref, OpenAlex, arXiv) */
  sources: string[];
  /** Problème rencontré ; la référence est alors partielle */
  warning?: string;
};

async function fromCrossref(doi: string): Promise<Reference | null> {
  const data = await fetchJson<{ message?: Record<string, unknown> }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  return data?.message ? parseCrossref(data.message) : null;
}

async function fromDataCite(doi: string): Promise<Reference | null> {
  const data = await fetchJson<{ data?: { attributes?: Parameters<typeof parseDataCite>[0] } }>(
    `https://api.datacite.org/dois/${encodeURIComponent(doi)}`,
  );
  const attrs = data?.data?.attributes;
  return attrs?.titles?.length ? parseDataCite(attrs) : null;
}

/** Notice OpenAlex par identifiant externe : `doi:10.…` ou `pmid:123`. */
async function fromOpenAlex(id: string): Promise<Reference | null> {
  const work = await fetchJson<Parameters<typeof parseOpenAlexWork>[0]>(`https://api.openalex.org/works/${id}`);
  return work?.title ? parseOpenAlexWork(work) : null;
}

async function fromArxiv(id: string): Promise<Reference | null> {
  try {
    const res = await fetchWeb(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, "application/atom+xml");
    if (!res.ok) return null;
    return parseArxivAtom(await res.text(), id);
  } catch {
    return null;
  }
}

type PageResult = { ref: Reference | null; doi: string; warning?: string };

/** Lit la page : référence décrite par ses métadonnées, ou DOI trouvé dans un PDF. */
async function fromPage(url: string): Promise<PageResult> {
  try {
    const res = await fetchWeb(url, "text/html,application/xhtml+xml;q=0.9,application/pdf;q=0.8,*/*;q=0.5");
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return { ref: null, doi: findDoi(url), warning: `La page a répondu ${res.status}.` };
    }
    if (/pdf/i.test(type)) {
      // Les PDF d'articles portent souvent leur DOI dans les métadonnées XMP ou la première page.
      const bytes = await readLimited(res, 512 * 1024);
      const doi = findDoi(new TextDecoder("latin1").decode(bytes)) || findDoi(url);
      const ref = emptyReference(url);
      ref.title = decodeURIComponent(new URL(res.url).pathname.split("/").pop() ?? "") || safeHost(url);
      ref.pdfUrl = url;
      return { ref, doi };
    }
    if (!/html|xml/i.test(type)) {
      res.body?.cancel().catch(() => {});
      return { ref: null, doi: findDoi(url), warning: "Ce lien ne mène pas à une page web." };
    }
    const html = decodeHtml(await readLimited(res), type);
    if (isChallengePage(html)) {
      return { ref: null, doi: findDoi(url), warning: "Le site bloque la lecture automatique de la page (vérification anti-robot)." };
    }
    const ref = parseReferenceHtml(html, url);
    return { ref, doi: ref.doi || findDoi(url) };
  } catch {
    return { ref: null, doi: findDoi(url), warning: "Page injoignable." };
  }
}

function canonicalUrl(input: ReferenceInput): string {
  if (input.kind === "url") return input.url;
  if (input.kind === "doi") return `https://doi.org/${input.doi}`;
  return `https://arxiv.org/abs/${input.id}`;
}

/**
 * Référence la plus complète possible, comme le ferait Zotero : métadonnées de la page,
 * puis notices des bases ouvertes (Crossref, DataCite, OpenAlex, arXiv) dès qu'un identifiant est connu.
 */
export async function fetchReference(input: ReferenceInput): Promise<ReferenceResult> {
  const url = canonicalUrl(input);
  const sources: string[] = [];
  let warning: string | undefined;
  let ref: Reference | null = null;
  let doi = input.kind === "doi" ? input.doi : "";
  /** Ajoute une source ; une source `primary` prend le pas sur ce qui est déjà connu. */
  const add = (next: Reference | null, name: string, primary = false) => {
    if (!next) return false;
    sources.push(name);
    ref = ref ? (primary ? mergeReferences(next, ref) : mergeReferences(ref, next)) : next;
    doi ||= next.doi;
    return true;
  };
  const missing = () => {
    const r = ref as Reference | null;
    return !r || !r.abstract || !r.pdfUrl;
  };

  if (input.kind === "arxiv") {
    if (!add(await fromArxiv(input.id), "arXiv")) {
      // API indisponible : la page arXiv porte aussi des métadonnées.
      const page = await fromPage(url);
      add(page.ref, "page");
      warning = page.warning;
    }
  } else {
    // PubMed refuse les lectures automatiques : OpenAlex connaît ses notices et leur DOI.
    const pmid = input.kind === "url" ? findPmid(input.url) : "";
    if (pmid && !add(await fromOpenAlex(`pmid:${pmid}`), "OpenAlex")) warning = "Notice PubMed introuvable.";

    // Page de l'article (ou, pour un DOI, page de l'éditeur) : résumé, mots-clés, PDF.
    const pageUrl = pmid ? (doi ? `https://doi.org/${doi}` : "") : url;
    const knownDoi = doi;
    const [page, early] = await Promise.all([
      pageUrl ? fromPage(pageUrl) : Promise.resolve(null),
      knownDoi ? fromCrossref(knownDoi) : Promise.resolve(null),
    ]);
    if (page) {
      add(page.ref, "page");
      doi ||= page.doi;
      if (!pmid) warning = page.warning;
    }
    // Les bases bibliographiques priment sur la page pour les champs structurés.
    let registered = add(early, "Crossref", true);
    if (!registered && doi && doi !== knownDoi) registered = add(await fromCrossref(doi), "Crossref", true);
    if (!registered && doi) registered = add(await fromDataCite(doi), "DataCite", true);
    if (doi && !sources.includes("OpenAlex") && (!registered || missing())) {
      registered = add(await fromOpenAlex(`doi:${encodeURI(doi)}`), "OpenAlex", !registered) || registered;
    }
    if (registered) warning = undefined;
    else if (input.kind === "doi") warning = "DOI inconnu de Crossref, DataCite et OpenAlex.";
  }

  const found: Reference = ref ?? { ...emptyReference(url), title: input.kind === "doi" ? input.doi : safeHost(url) };
  if (!ref) warning ??= "Aucune information trouvée.";
  return { ...found, url, doi: found.doi || doi, sources, ...(warning ? { warning } : {}) };
}
