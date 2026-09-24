import { createTag, listTags } from "@/lib/server/notes";
import { error, json, readJson } from "@/lib/server/http";

export async function GET() {
  return json(await listTags());
}

export async function POST(request: Request) {
  const body = await readJson<{ name?: string }>(request);
  const tag = await createTag(body?.name ?? "");
  return tag ? json(tag, { status: 201 }) : error(400, "Nom de tag invalide.");
}
