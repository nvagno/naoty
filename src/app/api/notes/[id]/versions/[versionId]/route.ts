import { getVersion, restoreVersion } from "@/lib/server/notes";
import { json, notFound } from "@/lib/server/http";

type Ctx = RouteContext<"/api/notes/[id]/versions/[versionId]">;

export async function GET(_req: Request, ctx: Ctx) {
  const { id, versionId } = await ctx.params;
  const v = await getVersion(id, versionId);
  return v ? json(v) : notFound("Version");
}

/** Restaure cette version (l'état actuel est d'abord ajouté à l'historique). */
export async function POST(_req: Request, ctx: Ctx) {
  const { id, versionId } = await ctx.params;
  const note = await restoreVersion(id, versionId);
  return note ? json(note) : notFound("Version");
}
