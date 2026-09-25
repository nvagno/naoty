import { DATA_DIR } from "@/lib/server/db";
import { json } from "@/lib/server/http";

// Lu à chaque requête : le dossier dépend de l'environnement d'exécution (projet ou application Electron).
export const dynamic = "force-dynamic";

export function GET() {
  return json({ dir: DATA_DIR });
}
