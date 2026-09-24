import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { prisma, UPLOADS_DIR } from "./db";
import { noteToMarkdown, safeFilename } from "@/lib/markdown";
import { buildSearchText, docToText, normalizeTag, parseDoc, type JSONNode } from "@/lib/text";
import { isDateKey } from "@/lib/dates";

export const EXPORT_FORMAT = "mon-carnet-de-recherche";
export const EXPORT_VERSION = 1;

type ExportedNote = {
  id: string;
  title: string;
  date: string;
  content: JSONNode;
  contentText: string;
  tags: string[];
  favorite: boolean;
  important: boolean;
  createdAt: string;
  updatedAt: string;
  links: string[];
  attachments: { id: string; filename: string; mimeType: string; size: number; storedAs: string; createdAt: string }[];
  versions: { id: string; title: string; content: JSONNode; createdAt: string }[];
};

export type CarnetExport = {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  tags: string[];
  notes: ExportedNote[];
};

async function loadAll() {
  return prisma.note.findMany({
    where: { OR: [{ title: { not: "" } }, { contentText: { not: "" } }, { attachments: { some: {} } }, { tags: { some: {} } }] },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      tags: { select: { name: true } },
      linksFrom: { select: { targetId: true } },
      attachments: true,
      versions: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function exportJson(): Promise<CarnetExport> {
  const [notes, tags] = await Promise.all([loadAll(), prisma.tag.findMany({ orderBy: { name: "asc" } })]);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tags: tags.map((t) => t.name),
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      date: n.date,
      content: parseDoc(n.content),
      contentText: n.contentText,
      tags: n.tags.map((t) => t.name),
      favorite: n.favorite,
      important: n.important,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      links: n.linksFrom.map((l) => l.targetId),
      attachments: n.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        storedAs: a.storedAs,
        createdAt: a.createdAt.toISOString(),
      })),
      versions: n.versions.map((v) => ({
        id: v.id,
        title: v.title,
        content: parseDoc(v.content),
        createdAt: v.createdAt.toISOString(),
      })),
    })),
  };
}

async function readUpload(storedAs: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await fs.readFile(path.join(UPLOADS_DIR, storedAs)));
  } catch {
    return null;
  }
}

/** Archive ZIP : une note Markdown par fichier, pièces jointes dans un dossier à part. */
export async function exportMarkdownZip(): Promise<Uint8Array> {
  const notes = await loadAll();
  const files: Zippable = {};
  const used = new Set<string>();
  const attachmentPath = new Map<string, string>();

  for (const n of notes) {
    for (const a of n.attachments) {
      const data = await readUpload(a.storedAs);
      if (!data) continue;
      const p = `pieces-jointes/${a.id.slice(-8)}-${safeFilename(a.filename, "fichier")}`;
      files[p] = data;
      attachmentPath.set(a.id, p);
    }
  }

  for (const n of notes) {
    let name = safeFilename(n.title);
    let i = 2;
    while (used.has(name.toLowerCase())) name = `${safeFilename(n.title)} (${i++})`;
    used.add(name.toLowerCase());
    const md = noteToMarkdown(
      {
        title: n.title,
        date: n.date,
        tags: n.tags.map((t) => t.name),
        favorite: n.favorite,
        important: n.important,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        content: parseDoc(n.content),
      },
      {
        resolveImage: (src) => {
          const id = src.match(/\/api\/attachments\/([\w-]+)/)?.[1];
          const p = id && attachmentPath.get(id);
          return p ? `../${encodeURI(p)}` : src;
        },
      },
    );
    let body = md;
    const others = n.attachments.filter((a) => attachmentPath.has(a.id) && !a.mimeType.startsWith("image/"));
    if (others.length) {
      body += "\n## Pièces jointes\n\n" +
        others.map((a) => `- [${a.filename}](../${encodeURI(attachmentPath.get(a.id)!)})`).join("\n") + "\n";
    }
    files[`notes/${name}.md`] = strToU8(body);
  }
  return zipSync(files, { level: 6 });
}

/** Sauvegarde complète : données JSON + fichiers joints, réimportable. */
export async function exportBackupZip(): Promise<Uint8Array> {
  const data = await exportJson();
  const files: Zippable = { "carnet.json": strToU8(JSON.stringify(data, null, 2)) };
  for (const n of data.notes) {
    for (const a of n.attachments) {
      const bytes = await readUpload(a.storedAs);
      if (bytes) files[`uploads/${a.storedAs}`] = [bytes, { level: 0 }];
    }
  }
  return zipSync(files, { level: 6 });
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function isoDate(v: unknown): Date | undefined {
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Importe un export JSON ou une sauvegarde ZIP.
 * Les notes déjà présentes (même identifiant) sont conservées telles quelles.
 */
export async function importData(bytes: Uint8Array, filename: string) {
  let payload: CarnetExport;
  let uploads: Record<string, Uint8Array> = {};
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) {
    const entries = unzipSync(bytes);
    if (!entries["carnet.json"]) throw new Error("Archive invalide : carnet.json introuvable.");
    payload = JSON.parse(new TextDecoder().decode(entries["carnet.json"]));
    uploads = Object.fromEntries(
      Object.entries(entries)
        .filter(([k]) => k.startsWith("uploads/"))
        .map(([k, v]) => [k.slice("uploads/".length), v]),
    );
  } else {
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error(`Le fichier ${filename} n'est pas un export JSON valide.`);
    }
  }
  if (payload?.format !== EXPORT_FORMAT || !Array.isArray(payload.notes)) {
    throw new Error("Ce fichier ne provient pas d'un export de Mon Carnet de Recherche.");
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  let created = 0;
  let skipped = 0;
  const importedIds = new Set<string>();

  for (const tag of payload.tags ?? []) {
    const name = normalizeTag(str(tag));
    if (name) await prisma.tag.upsert({ where: { name }, create: { name }, update: {} });
  }

  for (const n of payload.notes) {
    const id = str(n.id);
    if (!id) continue;
    if (await prisma.note.findUnique({ where: { id }, select: { id: true } })) {
      skipped++;
      continue;
    }
    const doc = parseDoc(n.content as JSONNode);
    const title = str(n.title);
    const text = docToText(doc);
    const tags = (Array.isArray(n.tags) ? n.tags : []).map((t) => normalizeTag(str(t))).filter(Boolean);
    await prisma.note.create({
      data: {
        id,
        title,
        date: isDateKey(n.date) ? n.date : new Date().toISOString().slice(0, 10),
        content: JSON.stringify(doc),
        contentText: text,
        searchText: buildSearchText(title, text, tags),
        favorite: n.favorite === true,
        important: n.important === true,
        createdAt: isoDate(n.createdAt),
        updatedAt: isoDate(n.updatedAt),
        tags: { connectOrCreate: tags.map((name) => ({ where: { name }, create: { name } })) },
        versions: {
          create: (Array.isArray(n.versions) ? n.versions : []).map((v) => ({
            title: str(v.title),
            content: JSON.stringify(parseDoc(v.content as JSONNode)),
            createdAt: isoDate(v.createdAt),
          })),
        },
      },
    });
    for (const a of Array.isArray(n.attachments) ? n.attachments : []) {
      const storedAs = path.basename(str(a.storedAs));
      const file = uploads[storedAs];
      if (!storedAs || !file) continue;
      await fs.writeFile(path.join(UPLOADS_DIR, storedAs), file);
      const exists = await prisma.attachment.findUnique({ where: { id: str(a.id) } });
      await prisma.attachment.create({
        data: {
          ...(exists ? {} : { id: str(a.id) || undefined }),
          noteId: id,
          filename: str(a.filename, "fichier"),
          mimeType: str(a.mimeType, "application/octet-stream"),
          size: file.length,
          storedAs,
          createdAt: isoDate(a.createdAt),
        },
      });
    }
    importedIds.add(id);
    created++;
  }

  // Les liens sont recréés une fois toutes les notes présentes.
  for (const n of payload.notes) {
    if (!importedIds.has(n.id) || !Array.isArray(n.links)) continue;
    const targets = await prisma.note.findMany({
      where: { id: { in: n.links.filter((l): l is string => typeof l === "string" && l !== n.id) } },
      select: { id: true },
    });
    if (targets.length) {
      await prisma.noteLink.createMany({ data: targets.map((t) => ({ sourceId: n.id, targetId: t.id })) });
    }
  }

  return { created, skipped };
}
