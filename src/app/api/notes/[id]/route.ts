import { deleteNote, getNote, updateNote } from "@/lib/server/notes";
import { error, json, notFound, readJson } from "@/lib/server/http";
import type { NotePatch } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/notes/[id]">) {
  const { id } = await ctx.params;
  const note = await getNote(id);
  return note ? json(note) : notFound();
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/notes/[id]">) {
  const { id } = await ctx.params;
  const patch = await readJson<NotePatch>(request);
  if (!patch || typeof patch !== "object") return error(400, "Requête invalide.");
  if (patch.content && (typeof patch.content !== "object" || patch.content.type !== "doc")) {
    return error(400, "Contenu invalide.");
  }
  const note = await updateNote(id, patch);
  return note ? json(note) : notFound();
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/notes/[id]">) {
  const { id } = await ctx.params;
  return (await deleteNote(id)) ? new Response(null, { status: 204 }) : notFound();
}
