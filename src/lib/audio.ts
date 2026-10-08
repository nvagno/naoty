// Enregistrements vocaux : durée, nom de fichier, transcription en paragraphes.
import type { JSONNode } from "./text";

/** « 0:42 », « 12:05 », « 1:02:09 ». */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Titre d'un vocal enregistré à une date donnée : « Vocal du 8 octobre 2026 à 14 h 05 ». */
export function recordingTitle(d: Date): string {
  const date = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `Vocal du ${date} à ${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Extension de fichier pour un type audio produit par MediaRecorder. */
export function audioExtension(mimeType: string): string {
  if (/ogg/.test(mimeType)) return ".ogg";
  if (/mp4|aac|m4a/.test(mimeType)) return ".m4a";
  return ".webm";
}

/** Texte transcrit découpé en paragraphes d'environ `size` caractères, entre deux phrases. */
export function transcriptParagraphs(text: string, size = 600): JSONNode[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+(?:[.!?…]+|$)\s*/g) ?? [];
  const paragraphs: string[] = [];
  let current = "";
  for (const s of sentences) {
    current += s;
    if (current.length >= size) {
      paragraphs.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] }));
}
