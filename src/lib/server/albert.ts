import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./db";

// Albert API (https://albert.api.etalab.gouv.fr), compatible avec l'API OpenAI.
// La clé est conservée dans le dossier des données, jamais renvoyée au navigateur.

export const ALBERT_DEFAULT_URL = "https://albert.api.etalab.gouv.fr/v1";
/** Mistral Small 3.2 (24B) : bon rédacteur en français, contexte de 128 000 jetons. */
export const ALBERT_DEFAULT_MODEL = "openweight-medium";

const CONFIG_FILE = path.join(DATA_DIR, "albert.json");

export type AlbertConfig = { apiKey: string; model: string; baseUrl: string };

export type AlbertStatus = {
  configured: boolean;
  /** Fin de la clé, pour la reconnaître */
  keyHint: string;
  /** La clé vient de la variable d'environnement ALBERT_API_KEY */
  fromEnv: boolean;
  model: string;
  baseUrl: string;
};

export type AlbertModel = { id: string; aliases: string[]; maxContext: number };

export class AlbertError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export async function readAlbertConfig(): Promise<AlbertConfig & { fromEnv: boolean }> {
  let stored: Partial<AlbertConfig> = {};
  try {
    stored = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  } catch {}
  const envKey = process.env.ALBERT_API_KEY?.trim() ?? "";
  const apiKey = stored.apiKey?.trim() || envKey;
  return {
    apiKey,
    fromEnv: !stored.apiKey?.trim() && Boolean(envKey),
    model: stored.model?.trim() || process.env.ALBERT_MODEL?.trim() || ALBERT_DEFAULT_MODEL,
    baseUrl: (stored.baseUrl?.trim() || process.env.ALBERT_API_URL?.trim() || ALBERT_DEFAULT_URL).replace(/\/+$/, ""),
  };
}

export async function albertStatus(): Promise<AlbertStatus> {
  const c = await readAlbertConfig();
  return { configured: Boolean(c.apiKey), keyHint: c.apiKey ? c.apiKey.slice(-4) : "", fromEnv: c.fromEnv, model: c.model, baseUrl: c.baseUrl };
}

/** Enregistre les réglages ; une clé vide efface la clé enregistrée. */
export async function saveAlbertConfig(patch: Partial<AlbertConfig>): Promise<AlbertStatus> {
  let stored: Partial<AlbertConfig> = {};
  try {
    stored = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  } catch {}
  for (const key of ["apiKey", "model", "baseUrl"] as const) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    if (value.trim()) stored[key] = value.trim();
    else delete stored[key];
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(stored, null, 2), { mode: 0o600 });
  return albertStatus();
}

async function call<T>(config: AlbertConfig, route: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (!config.apiKey) throw new AlbertError("Aucune clé d'API Albert : renseignez-la dans les paramètres.", 400);
  const signals = [AbortSignal.timeout(init.timeoutMs ?? 15_000), ...(init.signal ? [init.signal] : [])];
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${route}`, {
      ...init,
      signal: AbortSignal.any(signals),
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    });
  } catch (e) {
    if (init.signal?.aborted) throw new AlbertError("Demande annulée.", 499);
    if (e instanceof Error && e.name === "TimeoutError") throw new AlbertError("Albert n'a pas répondu à temps.", 504);
    throw new AlbertError("Albert API injoignable : vérifiez la connexion à Internet.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown; error?: { message?: string } } | null;
    const detail = typeof body?.detail === "string" ? body.detail : body?.error?.message;
    if (res.status === 401 || res.status === 403) throw new AlbertError("Clé d'API refusée par Albert.", 401);
    if (res.status === 404) throw new AlbertError(detail ? `Albert : ${detail}` : "Modèle ou service introuvable sur Albert.", 404);
    if (res.status === 429) throw new AlbertError("Limite d'utilisation d'Albert atteinte : réessayez plus tard.", 429);
    throw new AlbertError(`Albert a répondu ${res.status}${detail ? ` : ${detail}` : ""}.`);
  }
  return (await res.json()) as T;
}

type ModelEntry = { id: string; type?: string; aliases?: string[] | null; max_context_length?: number | null };

/** Modèles de génération de texte proposés par l'instance Albert. */
export async function listAlbertModels(config: AlbertConfig): Promise<AlbertModel[]> {
  const data = await call<{ data?: ModelEntry[] }>(config, "/models");
  return (data.data ?? [])
    .filter((m) => !m.type || m.type === "text-generation")
    .map((m) => ({ id: m.id, aliases: m.aliases ?? [], maxContext: m.max_context_length ?? 0 }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Taille de contexte du modèle (en jetons), ou une valeur prudente si elle est inconnue. */
export async function modelContext(config: AlbertConfig): Promise<{ id: string; maxContext: number }> {
  try {
    const m = await call<ModelEntry>(config, `/models/${encodeURIComponent(config.model)}`);
    return { id: m.id || config.model, maxContext: m.max_context_length || 32_000 };
  } catch (e) {
    if (e instanceof AlbertError && (e.status === 401 || e.status === 404)) throw e;
    return { id: config.model, maxContext: 32_000 };
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function albertChat(
  config: AlbertConfig,
  messages: ChatMessage[],
  opts: { maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const data = await call<{ choices?: { message?: { content?: string | null }; finish_reason?: string }[] }>(config, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model: config.model, messages, temperature: 0.2, max_tokens: opts.maxTokens ?? 4096 }),
    signal: opts.signal,
    timeoutMs: 5 * 60_000,
  });
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AlbertError("Albert a renvoyé une réponse vide.");
  return content;
}
