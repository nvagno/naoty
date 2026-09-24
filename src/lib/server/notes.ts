import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, UPLOADS_DIR } from "./db";
import { isDateKey, todayKey } from "@/lib/dates";
import {
  buildSearchText,
  docToText,
  EMPTY_DOC,
  excerpt,
  extractNoteLinks,
  fold,
  normalizeTag,
  parseDoc,
  renameLinksInDoc,
  searchTerms,
  snippet,
  type JSONNode,
} from "@/lib/text";
import type {
  AttachmentInfo,
  NoteDetail,
  NotePatch,
  NoteRef,
  NoteSummary,
  TagInfo,
  VersionInfo,
} from "@/lib/types";

/** Intervalle minimal entre deux instantanés automatiques de l'historique. */
const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;
/** Nombre maximal de versions conservées par note. */
const MAX_VERSIONS = 200;
/** Une note restée vide plus longtemps que ce délai est supprimée. */
const BLANK_NOTE_TTL_MS = 60 * 60 * 1000;

const summarySelect = {
  id: true,
  title: true,
  date: true,
  contentText: true,
  favorite: true,
  important: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: { name: true } },
} satisfies Prisma.NoteSelect;

type SummaryRow = Prisma.NoteGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: SummaryRow, terms: string[] = []): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    excerpt: excerpt(row.contentText),
    snippet: terms.length ? snippet(row.contentText, terms) : undefined,
    tags: row.tags.map((t) => t.name).sort((a, b) => a.localeCompare(b, "fr")),
    favorite: row.favorite,
    important: row.important,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function attachmentInfo(a: {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}): AttachmentInfo {
  return {
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt.toISOString(),
    url: `/api/attachments/${a.id}`,
  };
}

/** Une note « vide » (créée puis abandonnée) n'apparaît dans aucune liste. */
const NOT_BLANK: Prisma.NoteWhereInput = {
  OR: [
    { title: { not: "" } },
    { contentText: { not: "" } },
    { favorite: true },
    { important: true },
    { tags: { some: {} } },
    { attachments: { some: {} } },
  ],
};

async function purgeBlankNotes() {
  await prisma.note.deleteMany({
    where: {
      title: "",
      contentText: "",
      favorite: false,
      important: false,
      tags: { none: {} },
      attachments: { none: {} },
      updatedAt: { lt: new Date(Date.now() - BLANK_NOTE_TTL_MS) },
    },
  });
}

export type ListOptions = {
  q?: string;
  tag?: string;
  favorite?: boolean;
  important?: boolean;
  limit?: number;
  offset?: number;
};

export async function listNotes(opts: ListOptions = {}): Promise<{ notes: NoteSummary[]; hasMore: boolean }> {
  await purgeBlankNotes();
  const terms = searchTerms(opts.q ?? "");
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 1000);
  const offset = Math.max(opts.offset ?? 0, 0);

  const where: Prisma.NoteWhereInput = {
    AND: [
      NOT_BLANK,
      ...terms.map((t) => ({ searchText: { contains: t } })),
      ...(opts.tag ? [{ tags: { some: { name: opts.tag } } }] : []),
      ...(opts.favorite ? [{ favorite: true }] : []),
      ...(opts.important ? [{ important: true }] : []),
    ],
  };
  const orderBy: Prisma.NoteOrderByWithRelationInput[] = [{ date: "desc" }, { updatedAt: "desc" }];

  if (!terms.length) {
    const rows = await prisma.note.findMany({ where, orderBy, select: summarySelect, skip: offset, take: limit + 1 });
    return { notes: rows.slice(0, limit).map((r) => toSummary(r)), hasMore: rows.length > limit };
  }

  // Recherche : les correspondances dans le titre puis dans les tags passent en premier.
  const rows = await prisma.note.findMany({ where, orderBy, select: summarySelect, take: 2000 });
  const score = (r: SummaryRow) => {
    const title = fold(r.title);
    const tags = r.tags.map((t) => fold(t.name));
    let s = 0;
    for (const t of terms) {
      if (title.includes(t)) s += 4;
      if (tags.some((tag) => tag.includes(t))) s += 2;
    }
    return s;
  };
  const ranked = rows
    .map((r, i) => ({ r, i, s: score(r) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r);
  const page = ranked.slice(offset, offset + limit);
  return { notes: page.map((r) => toSummary(r, terms)), hasMore: ranked.length > offset + limit };
}

export async function getNote(id: string): Promise<NoteDetail | null> {
  const note = await prisma.note.findUnique({
    where: { id },
    select: {
      ...summarySelect,
      content: true,
      attachments: { orderBy: { createdAt: "asc" } },
      linksTo: {
        select: { source: { select: { id: true, title: true, date: true } } },
      },
    },
  });
  if (!note) return null;
  const backlinks: NoteRef[] = note.linksTo
    .map((l) => l.source)
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    ...toSummary(note),
    content: parseDoc(note.content),
    attachments: note.attachments.map(attachmentInfo),
    backlinks,
  };
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter((t): t is string => typeof t === "string").map(normalizeTag).filter(Boolean))];
}

function tagsInput(names: string[]) {
  return {
    set: [],
    connectOrCreate: names.map((name) => ({ where: { name }, create: { name } })),
  };
}

/** Résout les liens internes d'un document en identifiants de notes. */
async function resolveLinkTargets(doc: JSONNode, selfId: string): Promise<string[]> {
  const refs = extractNoteLinks(doc);
  const ids = new Set(refs.filter((r) => r.id).map((r) => r.id as string));
  const unresolved = refs.filter((r) => !r.id && r.title);
  if (unresolved.length) {
    const all = await prisma.note.findMany({ select: { id: true, title: true } });
    const byTitle = new Map(all.map((n) => [fold(n.title.trim()), n.id]));
    for (const r of unresolved) {
      const id = byTitle.get(fold(r.title));
      if (id) ids.add(id);
    }
  }
  ids.delete(selfId);
  if (!ids.size) return [];
  const existing = await prisma.note.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
  return existing.map((n) => n.id);
}

export async function createNote(input: {
  title?: string;
  date?: string;
  tags?: string[];
  content?: JSONNode;
} = {}): Promise<NoteDetail> {
  const title = (input.title ?? "").trim();
  const doc = input.content ?? EMPTY_DOC;
  const tags = cleanTags(input.tags);
  const text = docToText(doc);
  const note = await prisma.note.create({
    data: {
      title,
      date: isDateKey(input.date) ? input.date : todayKey(),
      content: JSON.stringify(doc),
      contentText: text,
      searchText: buildSearchText(title, text, tags),
      tags: { connectOrCreate: tags.map((name) => ({ where: { name }, create: { name } })) },
    },
  });
  const targets = await resolveLinkTargets(doc, note.id);
  if (targets.length) {
    await prisma.noteLink.createMany({ data: targets.map((targetId) => ({ sourceId: note.id, targetId })) });
  }
  return (await getNote(note.id))!;
}

async function pruneVersions(noteId: string) {
  const old = await prisma.noteVersion.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
    skip: MAX_VERSIONS,
    select: { id: true },
  });
  if (old.length) await prisma.noteVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } });
}

export async function updateNote(id: string, patch: NotePatch): Promise<NoteDetail | null> {
  const current = await prisma.note.findUnique({ where: { id }, include: { tags: true } });
  if (!current) return null;

  const title = typeof patch.title === "string" ? patch.title.replace(/\s+/g, " ").trim().slice(0, 300) : current.title;
  const contentStr = patch.content ? JSON.stringify(patch.content) : current.content;
  const tags = patch.tags !== undefined ? cleanTags(patch.tags) : current.tags.map((t) => t.name);
  const textChanged = title !== current.title || contentStr !== current.content;

  // Historique : on conserve l'état précédent si le dernier instantané date de plus de 10 minutes.
  if (textChanged && (current.title || current.contentText)) {
    const last = await prisma.noteVersion.findFirst({ where: { noteId: id }, orderBy: { createdAt: "desc" } });
    if (!last || Date.now() - last.createdAt.getTime() > SNAPSHOT_INTERVAL_MS) {
      if (!last || last.content !== current.content || last.title !== current.title) {
        await prisma.noteVersion.create({ data: { noteId: id, title: current.title, content: current.content } });
      }
    }
  }

  const doc = parseDoc(contentStr);
  const text = textChanged ? docToText(doc) : current.contentText;
  const data: Prisma.NoteUpdateInput = {
    title,
    content: contentStr,
    contentText: text,
    searchText: buildSearchText(title, text, tags),
  };
  if (patch.tags !== undefined) data.tags = tagsInput(tags);
  if (isDateKey(patch.date)) data.date = patch.date;
  if (typeof patch.favorite === "boolean") data.favorite = patch.favorite;
  if (typeof patch.important === "boolean") data.important = patch.important;
  // Un simple changement d'étoile ne doit pas modifier la date de dernière modification.
  if (!textChanged && patch.tags === undefined && patch.date === undefined) data.updatedAt = current.updatedAt;

  await prisma.note.update({ where: { id }, data });

  if (patch.content) {
    const targets = await resolveLinkTargets(doc, id);
    await prisma.$transaction([
      prisma.noteLink.deleteMany({ where: { sourceId: id } }),
      prisma.noteLink.createMany({ data: targets.map((targetId) => ({ sourceId: id, targetId })) }),
    ]);
  }

  if (title !== current.title) await propagateRename(id, title);

  if (patch.snapshot) {
    const last = await prisma.noteVersion.findFirst({ where: { noteId: id }, orderBy: { createdAt: "desc" } });
    if (!last || last.content !== contentStr || last.title !== title) {
      await prisma.noteVersion.create({ data: { noteId: id, title, content: contentStr } });
    }
  }
  if (textChanged || patch.snapshot) await pruneVersions(id);

  return getNote(id);
}

/** Met à jour le texte des liens [[...]] qui pointent vers une note renommée. */
async function propagateRename(targetId: string, title: string) {
  const sources = await prisma.note.findMany({
    where: { linksFrom: { some: { targetId } } },
    include: { tags: { select: { name: true } } },
  });
  for (const s of sources) {
    const next = renameLinksInDoc(parseDoc(s.content), targetId, title);
    if (!next) continue;
    const text = docToText(next);
    await prisma.note.update({
      where: { id: s.id },
      data: {
        content: JSON.stringify(next),
        contentText: text,
        searchText: buildSearchText(s.title, text, s.tags.map((t) => t.name)),
        updatedAt: s.updatedAt,
      },
    });
  }
}

export async function deleteNote(id: string): Promise<boolean> {
  const note = await prisma.note.findUnique({ where: { id }, include: { attachments: true } });
  if (!note) return false;
  await prisma.note.delete({ where: { id } });
  await Promise.all(
    note.attachments.map((a) => fs.rm(path.join(UPLOADS_DIR, a.storedAs), { force: true })),
  );
  return true;
}

/** Suggestions de notes pour la saisie de [[...]]. */
export async function lookupNotes(q: string, excludeId?: string, limit = 8): Promise<NoteRef[]> {
  const all = await prisma.note.findMany({
    where: { title: { not: "" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, title: true, date: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const query = fold(q.trim());
  const toRef = ({ id, title, date }: NoteRef) => ({ id, title, date });
  if (!query) return all.slice(0, limit).map(toRef);
  return all
    .map((n) => ({ n, pos: fold(n.title).indexOf(query) }))
    .filter((x) => x.pos !== -1)
    .sort((a, b) => (a.pos === 0 ? 0 : 1) - (b.pos === 0 ? 0 : 1))
    .slice(0, limit)
    .map((x) => toRef(x.n));
}

/** Trouve une note par son titre exact (sans tenir compte des accents), ou la crée. */
export async function resolveTitle(title: string, create: boolean): Promise<NoteRef | null> {
  const wanted = fold(title.trim());
  if (!wanted) return null;
  const all = await prisma.note.findMany({ select: { id: true, title: true, date: true } });
  const found = all.find((n) => fold(n.title.trim()) === wanted);
  if (found) return found;
  if (!create) return null;
  const note = await createNote({ title: title.trim() });
  return { id: note.id, title: note.title, date: note.date };
}

// ——— Tags ———

export async function listTags(): Promise<TagInfo[]> {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { notes: true } } },
    orderBy: { name: "asc" },
  });
  return tags.map((t) => ({ id: t.id, name: t.name, count: t._count.notes }));
}

async function refreshSearchText(noteIds: string[]) {
  const notes = await prisma.note.findMany({
    where: { id: { in: noteIds } },
    include: { tags: { select: { name: true } } },
  });
  for (const n of notes) {
    await prisma.note.update({
      where: { id: n.id },
      data: {
        searchText: buildSearchText(n.title, n.contentText, n.tags.map((t) => t.name)),
        updatedAt: n.updatedAt,
      },
    });
  }
}

export async function createTag(name: string): Promise<TagInfo | null> {
  const clean = normalizeTag(name);
  if (!clean) return null;
  const tag = await prisma.tag.upsert({ where: { name: clean }, create: { name: clean }, update: {} });
  const count = await prisma.note.count({ where: { tags: { some: { id: tag.id } } } });
  return { id: tag.id, name: tag.name, count };
}

export async function renameTag(id: string, name: string): Promise<TagInfo | null> {
  const clean = normalizeTag(name);
  const tag = await prisma.tag.findUnique({ where: { id }, include: { notes: { select: { id: true } } } });
  if (!tag || !clean) return null;
  const noteIds = tag.notes.map((n) => n.id);
  const existing = await prisma.tag.findUnique({ where: { name: clean } });
  let result;
  if (existing && existing.id !== id) {
    // Fusion avec le tag existant
    for (const noteId of noteIds) {
      await prisma.note.update({
        where: { id: noteId },
        data: { tags: { connect: { id: existing.id } } },
      });
    }
    await prisma.tag.delete({ where: { id } });
    result = existing;
  } else {
    result = await prisma.tag.update({ where: { id }, data: { name: clean } });
  }
  await refreshSearchText(noteIds);
  const count = await prisma.note.count({ where: { tags: { some: { id: result.id } } } });
  return { id: result.id, name: result.name, count };
}

export async function deleteTag(id: string): Promise<boolean> {
  const tag = await prisma.tag.findUnique({ where: { id }, include: { notes: { select: { id: true } } } });
  if (!tag) return false;
  await prisma.tag.delete({ where: { id } });
  await refreshSearchText(tag.notes.map((n) => n.id));
  return true;
}

// ——— Historique ———

export async function listVersions(noteId: string): Promise<VersionInfo[]> {
  const versions = await prisma.noteVersion.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
  });
  return versions.map((v) => ({
    id: v.id,
    title: v.title,
    createdAt: v.createdAt.toISOString(),
    words: docToText(parseDoc(v.content)).split(/\s+/).filter(Boolean).length,
  }));
}

export async function getVersion(noteId: string, versionId: string) {
  const v = await prisma.noteVersion.findFirst({ where: { id: versionId, noteId } });
  if (!v) return null;
  return { id: v.id, title: v.title, createdAt: v.createdAt.toISOString(), content: parseDoc(v.content) };
}

export async function restoreVersion(noteId: string, versionId: string): Promise<NoteDetail | null> {
  const [note, version] = await Promise.all([
    prisma.note.findUnique({ where: { id: noteId } }),
    prisma.noteVersion.findFirst({ where: { id: versionId, noteId } }),
  ]);
  if (!note || !version) return null;
  // L'état actuel est conservé avant la restauration : on peut toujours revenir en arrière.
  await prisma.noteVersion.create({ data: { noteId, title: note.title, content: note.content } });
  return updateNote(noteId, { title: version.title, content: parseDoc(version.content) });
}
