import { asStandaloneUrl, parseLinkMeta, safeHost, type LinkMeta } from "@/lib/linkMeta";
import { error, json } from "@/lib/server/http";

const MAX_BYTES = 2 * 1024 * 1024;

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const c of chunks) {
    const part = c.subarray(0, out.length - offset);
    out.set(part, offset);
    offset += part.length;
    if (offset >= out.length) break;
  }
  return out;
}

function decode(bytes: Uint8Array, contentType: string): string {
  const fromHeader = contentType.match(/charset=([\w-]+)/i)?.[1];
  const sniff = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const fromMeta = sniff.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {}
  }
  return new TextDecoder().decode(bytes);
}

/** Métadonnées d'une page web, pour les fiches de lien. */
export async function GET(request: Request) {
  const url = asStandaloneUrl(new URL(request.url).searchParams.get("url") ?? "");
  if (!url) return error(400, "Adresse invalide.");

  const fallback: LinkMeta = { url, title: safeHost(url), description: "", site: safeHost(url), authors: "", date: "" };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) MonCarnetDeRecherche/1.0",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "fr,en;q=0.8",
      },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return json({ ...fallback, error: `La page a répondu ${res.status}.` });
    if (!/html|xml/i.test(type)) {
      // PDF ou autre fichier : le nom du fichier sert de titre
      const name = decodeURIComponent(new URL(res.url).pathname.split("/").pop() ?? "");
      res.body?.cancel().catch(() => {});
      return json({ ...fallback, title: name || fallback.title, description: type.split(";")[0] });
    }
    const html = decode(await readLimited(res), type);
    return json(parseLinkMeta(html, url));
  } catch {
    return json({ ...fallback, error: "Page injoignable : fiche créée sans métadonnées." });
  }
}
