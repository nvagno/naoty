import { deleteAttachment, isInlineType, readAttachment } from "@/lib/server/attachments";
import { notFound } from "@/lib/server/http";

export async function GET(request: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const { id } = await ctx.params;
  const found = await readAttachment(id);
  if (!found) return notFound("Pièce jointe");
  const { attachment: a, data } = found;
  const download = new URL(request.url).searchParams.has("download") || !isInlineType(a.mimeType);
  const type = a.mimeType.startsWith("text/") ? `${a.mimeType}; charset=utf-8` : a.mimeType;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
      // Un fichier joint ne doit jamais pouvoir exécuter de script dans l'application.
      ...(a.mimeType === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox" }),
    },
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const { id } = await ctx.params;
  return (await deleteAttachment(id)) ? new Response(null, { status: 204 }) : notFound("Pièce jointe");
}
