import { listVersions } from "@/lib/server/notes";
import { json } from "@/lib/server/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/notes/[id]/versions">) {
  const { id } = await ctx.params;
  return json(await listVersions(id));
}
