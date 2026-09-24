import { getNote } from "@/lib/server/notes";
import { noteToMarkdown, safeFilename } from "@/lib/markdown";
import { notFound } from "@/lib/server/http";

export async function GET(request: Request, ctx: RouteContext<"/api/notes/[id]/markdown">) {
  const { id } = await ctx.params;
  const note = await getNote(id);
  if (!note) return notFound();
  const origin = new URL(request.url).origin;
  const md = noteToMarkdown(note, {
    resolveImage: (src) => (src.startsWith("/") ? origin + src : src),
  });
  const name = `${note.date} ${safeFilename(note.title)}.md`;
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
