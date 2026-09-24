import { importData } from "@/lib/server/export";
import { error, json } from "@/lib/server/http";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error(400, "Aucun fichier reçu.");
  try {
    const result = await importData(new Uint8Array(await file.arrayBuffer()), file.name);
    return json(result);
  } catch (e) {
    return error(400, e instanceof Error ? e.message : "Import impossible.");
  }
}
