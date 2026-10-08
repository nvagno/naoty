import { albertStatus, AlbertError, listAlbertModels, readAlbertConfig, saveAlbertConfig } from "@/lib/server/albert";
import { error, json, readJson } from "@/lib/server/http";

/** Réglages d'Albert API (sans la clé) ; `?models=1` ajoute les modèles disponibles. */
export async function GET(request: Request) {
  const status = await albertStatus();
  if (!new URL(request.url).searchParams.has("models") || !status.configured) return json(status);
  try {
    return json({ ...status, models: await listAlbertModels(await readAlbertConfig()) });
  } catch (e) {
    return json({ ...status, models: [], modelsError: e instanceof AlbertError ? e.message : "Liste des modèles indisponible." });
  }
}

export async function PUT(request: Request) {
  const body = await readJson<{ apiKey?: unknown; model?: unknown }>(request);
  if (!body) return error(400, "Requête invalide.");
  const patch: { apiKey?: string; model?: string } = {};
  if (typeof body.apiKey === "string") patch.apiKey = body.apiKey;
  if (typeof body.model === "string") patch.model = body.model;
  return json(await saveAlbertConfig(patch));
}
