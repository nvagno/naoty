// Extraction des métadonnées d'une page web (titre, description, auteurs…).

export type LinkMeta = {
  url: string;
  title: string;
  description: string;
  site: string;
  /** Auteurs d'un article (balises citation_author), séparés par des virgules */
  authors: string;
  /** Date de publication, telle que fournie par la page */
  date: string;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function clean(s: string | undefined, max = 400): string {
  if (!s) return "";
  const text = decodeEntities(s).replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

/** Lit les balises <meta> et <title> d'une page HTML. */
export function parseLinkMeta(html: string, url: string): LinkMeta {
  const head = html.slice(0, 500_000);
  const meta = new Map<string, string[]>();
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    if (!key || a.content === undefined) continue;
    meta.set(key, [...(meta.get(key) ?? []), a.content]);
  }
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = meta.get(k)?.find((x) => x.trim());
      if (v) return v;
    }
    return "";
  };
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const host = safeHost(url);

  const authors = [...new Set((meta.get("citation_author") ?? meta.get("dc.creator") ?? []).map((a) => clean(a, 80)).filter(Boolean))];
  const authorText =
    authors.length > 6 ? authors.slice(0, 5).join(", ") + " et al." : authors.join(", ") || clean(first("author", "article:author"), 120);

  return {
    url,
    title: clean(first("citation_title", "og:title", "twitter:title", "dc.title") || titleTag, 300) || host,
    description: clean(first("og:description", "description", "twitter:description", "citation_abstract", "dc.description"), 300),
    site: clean(first("citation_journal_title", "og:site_name", "application-name"), 120) || host,
    authors: authorText.startsWith("http") ? "" : authorText,
    date: clean(first("citation_publication_date", "citation_date", "article:published_time", "dc.date"), 40).replace(/T.*$/, ""),
  };
}

export function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Adresse web seule (sans autre texte) : http(s)://… ou www.… */
export function asStandaloneUrl(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  const candidate = /^www\./i.test(t) ? "https://" + t : t;
  try {
    const u = new URL(candidate);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
