// Produit le serveur Next autonome et le complète pour l'embarquer dans
// Electron : fichiers statiques, nettoyage, et better-sqlite3 recompilé pour
// la version de Node incluse dans Electron.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rebuild } from "@electron/rebuild";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

fs.rmSync(standalone, { recursive: true, force: true });
const build = spawnSync(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, CARNET_STANDALONE: "1" },
});
if (build.status !== 0) process.exit(build.status ?? 1);

// Next ne copie pas les fichiers statiques dans le serveur autonome.
fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

// Jamais de données personnelles ni de configuration locale dans l'application.
for (const entry of fs.readdirSync(standalone)) {
  if (entry === "data" || entry.startsWith(".env")) {
    fs.rmSync(path.join(standalone, entry), { recursive: true, force: true });
  }
}

const electronVersion = JSON.parse(
  fs.readFileSync(path.join(root, "node_modules", "electron", "package.json"), "utf8"),
).version;

// Next ne copie que le binaire de better-sqlite3 : on recompile une copie complète
// du paquet, puis on remplace chaque binaire du serveur autonome.
const adapterRequire = createRequire(createRequire(import.meta.url).resolve("@prisma/adapter-better-sqlite3"));
const sqliteSrc = path.dirname(adapterRequire.resolve("better-sqlite3/package.json"));
const sqliteVersion = JSON.parse(fs.readFileSync(path.join(sqliteSrc, "package.json"), "utf8")).version;
const nativeDir = path.join(root, ".next", "electron-native");
const sqliteCopy = path.join(nativeDir, "node_modules", "better-sqlite3");

fs.rmSync(nativeDir, { recursive: true, force: true });
fs.cpSync(sqliteSrc, sqliteCopy, { recursive: true, filter: (src) => !src.startsWith(path.join(sqliteSrc, "build")) });
fs.writeFileSync(
  path.join(nativeDir, "package.json"),
  JSON.stringify({ name: "electron-native", private: true, dependencies: { "better-sqlite3": sqliteVersion } }),
);

console.log(`Recompilation de better-sqlite3 ${sqliteVersion} pour Electron ${electronVersion}…`);
await rebuild({ buildPath: nativeDir, electronVersion, onlyModules: ["better-sqlite3"], force: true });

const built = path.join(sqliteCopy, "build", "Release", "better_sqlite3.node");
const targets = [];
(function find(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) find(p);
    else if (e.name === "better_sqlite3.node") targets.push(p);
  }
})(path.join(standalone, "node_modules"));
if (!targets.length) throw new Error("better_sqlite3.node introuvable dans le serveur autonome.");
for (const t of targets) fs.copyFileSync(built, t);

console.log("Serveur prêt pour Electron :", path.relative(root, standalone));
