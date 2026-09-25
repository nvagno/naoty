// Processus utilitaire lancé par electron/main.mjs : applique les migrations
// Prisma à la base du carnet, puis démarre le serveur Next autonome.
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const serverDir = process.env.CARNET_SERVER_DIR;
const migrationsDir = process.env.CARNET_MIGRATIONS_DIR;
const dbPath = process.env.DATABASE_URL.replace(/^file:/, "");

/** better-sqlite3 tel que copié par Next dans le serveur autonome (recompilé pour Electron). */
function loadSqlite() {
  const candidates = [
    path.join(serverDir, "node_modules", "@prisma", "adapter-better-sqlite3", "package.json"),
    path.join(serverDir, "server.js"),
  ];
  for (const from of candidates) {
    try {
      return createRequire(from)("better-sqlite3");
    } catch {
      // essai suivant
    }
  }
  throw new Error("better-sqlite3 introuvable dans " + serverDir);
}

/**
 * Équivalent de `prisma migrate deploy` : même table `_prisma_migrations`,
 * pour que la base reste utilisable avec la CLI Prisma.
 */
function migrate() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const Database = loadSqlite();
  const db = new Database(dbPath);
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
    )`);
    const applied = new Set(
      db
        .prepare(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)
        .all()
        .map((r) => r.migration_name),
    );
    const names = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const name of names) {
      if (applied.has(name)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      db.transaction(() => {
        db.exec(sql);
        db.prepare(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
           VALUES (?, ?, ?, ?, ?, 1)`,
        ).run(crypto.randomUUID(), checksum, Date.now(), name, Date.now());
      })();
    }
  } finally {
    db.close();
  }
}

try {
  migrate();
  await import(pathToFileURL(path.join(serverDir, "server.js")).href);
} catch (err) {
  process.parentPort?.postMessage({ type: "error", message: String(err?.stack ?? err) });
  process.exit(1);
}
