import { asStandaloneUrl, parseLinkMeta, safeHost, type LinkMeta } from "@/lib/linkMeta";
import { error, json } from "@/lib/server/http";
import { decodeHtml, fetchWeb, readLimited } from "@/lib/server/web";

/** Métadonnées d'une page web, pour les fiches de lien. */
export async function GET(request: Request) {
  const url = asStandaloneUrl(new URL(request.url).searchParams.get("url") ?? "");
  if (!url) return error(400, "Adresse invalide.");

  const fallback: LinkMeta = { url, title: safeHost(url), description: "", site: safeHost(url), authors: "", date: "" };
  try {
    const res = await fetchWeb(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5");
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return json({ ...fallback, error: `La page a répondu ${res.status}.` });
    if (!/html|xml/i.test(type)) {
      // PDF ou autre fichier : le nom du fichier sert de titre
      const name = decodeURIComponent(new URL(res.url).pathname.split("/").pop() ?? "");
      res.body?.cancel().catch(() => {});
      return json({ ...fallback, title: name || fallback.title, description: type.split(";")[0] });
    }
    const html = decodeHtml(await readLimited(res), type);
    return json(parseLinkMeta(html, url));
  } catch {
    return json({ ...fallback, error: "Page injoignable : fiche créée sans métadonnées." });
  }
}
