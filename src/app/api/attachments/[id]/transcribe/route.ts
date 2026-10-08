import { AlbertError, albertTranscribe, readAlbertConfig } from "@/lib/server/albert";
import { readAttachment } from "@/lib/server/attachments";
import { error, json, notFound } from "@/lib/server/http";

/** Transcription d'une pièce jointe audio par Albert (Whisper). */
export async function POST(request: Request, ctx: RouteContext<"/api/attachments/[id]/transcribe">) {
  const { id } = await ctx.params;
  const found = await readAttachment(id);
  if (!found) return notFound("Pièce jointe");
  const { attachment: a, data } = found;
  if (!a.mimeType.startsWith("audio/")) return error(415, "Cette pièce jointe n'est pas un enregistrement audio.");
  const config = await readAlbertConfig();
  if (!config.apiKey) return error(400, "Aucune clé d'API Albert : renseignez-la dans les paramètres.");
  try {
    const text = await albertTranscribe(config, new Blob([new Uint8Array(data)], { type: a.mimeType }), a.filename, { signal: request.signal });
    return json({ text });
  } catch (e) {
    if (e instanceof AlbertError) return error(e.status, e.message);
    console.error(e);
    return error(500, "Transcription impossible.");
  }
}
