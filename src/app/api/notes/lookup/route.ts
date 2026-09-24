import { lookupNotes } from "@/lib/server/notes";
import { json } from "@/lib/server/http";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  return json(await lookupNotes(p.get("q") ?? "", p.get("exclude") ?? undefined));
}
