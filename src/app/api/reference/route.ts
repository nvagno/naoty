import { parseReferenceInput } from "@/lib/reference";
import { error, json } from "@/lib/server/http";
import { fetchReference } from "@/lib/server/reference";

/** Référence d'une publication à partir d'une adresse, d'un DOI ou d'un identifiant arXiv. */
export async function GET(request: Request) {
  const input = parseReferenceInput(new URL(request.url).searchParams.get("q") ?? "");
  if (!input) return error(400, "Saisissez une adresse web, un DOI ou un identifiant arXiv.");
  return json(await fetchReference(input));
}
