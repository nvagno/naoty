import { MAX_UPLOAD_BYTES } from "@/lib/server/attachments";
import { createDigestNote, digestErrorResponse } from "@/lib/server/digest";
import { error, json } from "@/lib/server/http";

/** Fiche de révision d'un document téléversé, rédigée par Albert et enregistrée comme note. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error(400, "Aucun fichier reçu.");
  if (file.size > MAX_UPLOAD_BYTES) return error(413, "Fichier trop volumineux (50 Mo maximum).");
  try {
    const result = await createDigestNote(file, { attach: form?.get("attach") !== "0", signal: request.signal });
    return json(result, { status: 201 });
  } catch (e) {
    const { status, message } = digestErrorResponse(e);
    return error(status, message);
  }
}
