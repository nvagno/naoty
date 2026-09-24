import { createNote, listNotes } from "@/lib/server/notes";
import { json } from "@/lib/server/http";
import type { JSONNode } from "@/lib/text";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const result = await listNotes({
    q: p.get("q") ?? undefined,
    tag: p.get("tag") ?? undefined,
    favorite: p.get("favorite") === "1",
    important: p.get("important") === "1",
    limit: p.has("limit") ? Number(p.get("limit")) : undefined,
    offset: p.has("offset") ? Number(p.get("offset")) : undefined,
  });
  return json(result);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    date?: string;
    tags?: string[];
    content?: JSONNode;
  };
  const note = await createNote(body ?? {});
  return json(note, { status: 201 });
}
