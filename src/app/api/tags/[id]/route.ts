import { deleteTag, renameTag } from "@/lib/server/notes";
import { error, json, notFound, readJson } from "@/lib/server/http";

export async function PATCH(request: Request, ctx: RouteContext<"/api/tags/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson<{ name?: string }>(request);
  if (!body?.name) return error(400, "Nom manquant.");
  const tag = await renameTag(id, body.name);
  return tag ? json(tag) : notFound("Tag");
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tags/[id]">) {
  const { id } = await ctx.params;
  return (await deleteTag(id)) ? new Response(null, { status: 204 }) : notFound("Tag");
}
