import "server-only";
import path from "node:path";
import {
  cleanExtractedText,
  digestPrompt,
  digestToDoc,
  DIGEST_EXTENSIONS,
  DIGEST_SYSTEM_PROMPT,
  mergePrompt,
  partPrompt,
  splitDigest,
  splitText,
  titleFromFilename,
} from "@/lib/digest";
import { markupToText } from "@/lib/reference";
import { AlbertError, albertChat, modelContext, readAlbertConfig } from "./albert";
import { saveAttachment } from "./attachments";
import { createNote } from "./notes";
import { decodeHtml } from "./web";

/** Au-delà, le document est tronqué : trop de requêtes pour une seule fiche. */
const MAX_TEXT_CHARS = 1_200_000;
/** Une seule requête au plus de cette taille, même si le modèle accepte davantage (durée de réponse). */
const MAX_PART_CHARS = 240_000;
/** Jetons réservés à la réponse. */
const ANSWER_TOKENS = 4096;

export class DigestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Texte d'un document téléversé. */
export async function extractText(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!DIGEST_EXTENSIONS.includes(ext)) {
    throw new DigestError("Format non pris en charge : PDF, Word (.docx), texte, Markdown ou HTML.", 415);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  try {
    if (ext === ".pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      text = (await pdfText(pdf, { mergePages: false })).text.join("\n\n");
    } else if (ext === ".docx") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } else if (ext === ".html" || ext === ".htm") {
      const html = decodeHtml(bytes, file.type).replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, "");
      text = markupToText(html.replace(/<\/(h[1-6]|li|div|tr|section|article)>/gi, "$&\n\n"));
    } else {
      text = new TextDecoder().decode(bytes);
    }
  } catch {
    throw new DigestError("Lecture du document impossible : fichier endommagé ou protégé ?", 422);
  }
  text = cleanExtractedText(text);
  if (text.replace(/\s/g, "").length < 200) {
    throw new DigestError(
      ext === ".pdf"
        ? "Ce PDF ne contient presque pas de texte (document numérisé ?). Il faut d'abord en reconnaître le texte (OCR)."
        : "Le document ne contient presque pas de texte.",
      422,
    );
  }
  return text;
}

/**
 * Fiche de révision d'un document : le texte est lu en une fois s'il tient dans le contexte
 * du modèle, sinon par parties dont les relevés sont ensuite réunis.
 */
export async function createDigestNote(file: File, opts: { attach: boolean; signal?: AbortSignal }) {
  const config = await readAlbertConfig();
  if (!config.apiKey) throw new DigestError("Aucune clé d'API Albert : renseignez-la dans les paramètres.");

  const [fullText, model] = await Promise.all([extractText(file), modelContext(config)]);
  const truncated = fullText.length > MAX_TEXT_CHARS;
  const text = truncated ? fullText.slice(0, MAX_TEXT_CHARS) : fullText;
  // Environ 3 caractères par jeton en français (estimation prudente), consignes comprises.
  const partChars = Math.min(MAX_PART_CHARS, Math.max(8_000, (model.maxContext - ANSWER_TOKENS - 1_500) * 3));
  const parts = splitText(text, partChars);
  const chat = (prompt: string) =>
    albertChat(
      config,
      [
        { role: "system", content: DIGEST_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { maxTokens: ANSWER_TOKENS, signal: opts.signal },
    );

  let markdown: string;
  if (parts.length === 1) {
    markdown = await chat(digestPrompt(text, file.name));
  } else {
    const notes: string[] = [];
    // Une partie après l'autre : les limites de débit d'Albert sont vite atteintes en parallèle.
    for (const [i, part] of parts.entries()) notes.push(await chat(partPrompt(part, file.name, i + 1, parts.length)));
    markdown = await chat(mergePrompt(notes, file.name));
  }

  const { title, body } = splitDigest(markdown);
  const note = await createNote({
    title: title || titleFromFilename(file.name),
    content: digestToDoc(body, { filename: file.name, model: model.id, parts: parts.length, truncated }),
  });
  if (opts.attach) await saveAttachment(note.id, file);
  return { id: note.id };
}

export function digestErrorResponse(e: unknown): { status: number; message: string } {
  if (e instanceof DigestError || e instanceof AlbertError) return { status: e.status, message: e.message };
  console.error(e);
  return { status: 500, message: "Création de la fiche impossible." };
}
