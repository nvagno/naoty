import { prisma } from "@/lib/server/db";
import { MAX_UPLOAD_BYTES, saveAttachment } from "@/lib/server/attachments";
import { error, json, notFound } from "@/lib/server/http";

export async function POST(request: Request, ctx: RouteContext<"/api/notes/[id]/attachments">) {
  const { id } = await ctx.params;
  if (!(await prisma.note.findUnique({ where: { id }, select: { id: true } }))) return notFound();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error(400, "Aucun fichier reçu.");
  if (file.size > MAX_UPLOAD_BYTES) return error(413, "Fichier trop volumineux (50 Mo maximum).");
  return json(await saveAttachment(id, file), { status: 201 });
}
