import { deleteAttachment, isInlineType, readAttachment } from "@/lib/server/attachments";
import { notFound } from "@/lib/server/http";

export async function GET(request: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const { id } = await ctx.params;
  const found = await readAttachment(id);
  if (!found) return notFound("Pièce jointe");
  const { attachment: a, data } = found;
  const download = new URL(request.url).searchParams.has("download") || !isInlineType(a.mimeType);
  const type = a.mimeType.startsWith("text/") ? `${a.mimeType}; charset=utf-8` : a.mimeType;
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    // Un fichier joint ne doit jamais pouvoir exécuter de script dans l'application.
    ...(a.mimeType === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox" }),
  };
  // Lecture par plages : nécessaire pour se déplacer dans un enregistrement audio.
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const size = data.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const { id } = await ctx.params;
  return (await deleteAttachment(id)) ? new Response(null, { status: 204 }) : notFound("Pièce jointe");
}
