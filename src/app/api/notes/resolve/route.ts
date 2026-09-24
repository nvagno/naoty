import { resolveTitle } from "@/lib/server/notes";
import { error, json, readJson } from "@/lib/server/http";

/** Trouve une note par son titre (ou la crée si `create` est vrai). */
export async function POST(request: Request) {
  const body = await readJson<{ title?: string; create?: boolean }>(request);
  if (!body?.title?.trim()) return error(400, "Titre manquant.");
  const ref = await resolveTitle(body.title, body.create === true);
  return ref ? json(ref) : error(404, "Aucune note ne porte ce titre.");
}
