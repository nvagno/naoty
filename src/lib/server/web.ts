import "server-only";

// Récupération de pages et d'API web, avec taille et durée limitées.

const MAX_BYTES = 2 * 1024 * 1024;

// Sans « Mozilla » : le carnet ne se fait pas passer pour un navigateur (certains
// pare-feu anti-robots, comme Anubis, laissent alors passer les clients déclarés).
export const USER_AGENT = "MonCarnetDeRecherche/1.0 (carnet de recherche personnel)";

export async function readLimited(res: Response, maxBytes = MAX_BYTES): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const part = c.subarray(0, out.length - offset);
    out.set(part, offset);
    offset += part.length;
    if (offset >= out.length) break;
  }
  return out;
}

export function decodeHtml(bytes: Uint8Array, contentType: string): string {
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

export function fetchWeb(url: string, accept: string, timeoutMs = 8000): Promise<Response> {
  return fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "fr,en;q=0.8" },
  });
}

/** Réponse JSON d'une API, ou null en cas d'échec. */
export async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetchWeb(url, "application/json", timeoutMs);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
