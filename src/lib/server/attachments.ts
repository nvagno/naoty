import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma, UPLOADS_DIR } from "./db";
import type { AttachmentInfo } from "@/lib/types";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Types affichés tels quels par le navigateur ; les autres sont servis en téléchargement. */
const INLINE_TYPES = [/^image\/(png|jpe?g|gif|webp|avif|bmp)$/, /^application\/pdf$/, /^text\/plain$/, /^text\/markdown$/, /^text\/csv$/];

export function isInlineType(mime: string) {
  return INLINE_TYPES.some((re) => re.test(mime));
}

function extensionOf(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

export async function saveAttachment(noteId: string, file: File): Promise<AttachmentInfo> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const storedAs = crypto.randomUUID() + extensionOf(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOADS_DIR, storedAs), buffer);
  const filename = path.basename(file.name).slice(0, 200) || "fichier";
  const a = await prisma.attachment.create({
    data: {
      noteId,
      filename,
      mimeType: file.type || "application/octet-stream",
      size: buffer.length,
      storedAs,
    },
  });
  return {
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt.toISOString(),
    url: `/api/attachments/${a.id}`,
  };
}

export async function readAttachment(id: string) {
  const a = await prisma.attachment.findUnique({ where: { id } });
  if (!a) return null;
  try {
    const data = await fs.readFile(path.join(UPLOADS_DIR, a.storedAs));
    return { attachment: a, data };
  } catch {
    return null;
  }
}

export async function deleteAttachment(id: string): Promise<boolean> {
  const a = await prisma.attachment.findUnique({ where: { id } });
  if (!a) return false;
  await prisma.attachment.delete({ where: { id } });
  await fs.rm(path.join(UPLOADS_DIR, a.storedAs), { force: true });
  return true;
}
