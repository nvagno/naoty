// Copie les polices d'Excalidraw dans public/ : sans elles, l'éditeur de dessins
// les télécharge depuis un CDN, ce qui échoue hors ligne (application de bureau).
// Xiaolai (13 Mo, caractères chinois, japonais, coréens) n'est pas copiée.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "@excalidraw", "excalidraw", "dist", "prod", "fonts");
const dest = path.join(root, "public", "excalidraw", "fonts");

if (!fs.existsSync(src)) {
  console.warn("Polices d'Excalidraw introuvables :", path.relative(root, src));
  process.exit(0);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, filter: (p) => path.basename(p) !== "Xiaolai" });
