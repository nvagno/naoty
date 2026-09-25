import "server-only";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/** Dossier des données : `data/` du projet, ou celui fourni par l'application Electron. */
export const DATA_DIR = process.env.CARNET_DATA_DIR ?? path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? `file:${path.join(DATA_DIR, "carnet.db")}`,
  });
  return new PrismaClient({ adapter });
}

// Une seule instance, y compris lors des rechargements à chaud en développement.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
