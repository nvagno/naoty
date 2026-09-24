import { exportBackupZip, exportJson, exportMarkdownZip } from "@/lib/server/export";
import { todayKey } from "@/lib/dates";
import { error } from "@/lib/server/http";

function download(body: BodyInit, type: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const stamp = todayKey();
  switch (format) {
    case "json":
      return download(JSON.stringify(await exportJson(), null, 2), "application/json; charset=utf-8", `carnet-${stamp}.json`);
    case "markdown":
      return download(new Uint8Array(await exportMarkdownZip()), "application/zip", `carnet-markdown-${stamp}.zip`);
    case "backup":
      return download(new Uint8Array(await exportBackupZip()), "application/zip", `carnet-sauvegarde-${stamp}.zip`);
    default:
      return error(400, "Format inconnu.");
  }
}
