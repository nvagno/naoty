import { describe, expect, it } from "vitest";
import { audioExtension, formatDuration, recordingTitle, transcriptParagraphs } from "@/lib/audio";
import { docToMarkdown } from "@/lib/markdown";
import { docToText } from "@/lib/text";

describe("vocaux", () => {
  it("formate les durées", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(42.4)).toBe("0:42");
    expect(formatDuration(725)).toBe("12:05");
    expect(formatDuration(3729)).toBe("1:02:09");
  });

  it("nomme l'enregistrement d'après sa date", () => {
    expect(recordingTitle(new Date(2026, 9, 8, 14, 5))).toBe("Vocal du 8 octobre 2026 à 14 h 05");
    expect(audioExtension("audio/webm")).toBe(".webm");
    expect(audioExtension("audio/ogg")).toBe(".ogg");
    expect(audioExtension("audio/mp4")).toBe(".m4a");
  });

  it("découpe la transcription en paragraphes entre deux phrases", () => {
    const sentence = "Une phrase assez longue pour remplir le paragraphe. ";
    const paragraphs = transcriptParagraphs(sentence.repeat(30) + "Fin sans point", 300);
    expect(paragraphs.length).toBeGreaterThan(1);
    for (const p of paragraphs.slice(0, -1)) expect(p.content![0].text).toMatch(/\.$/);
    expect(paragraphs.at(-1)!.content![0].text).toMatch(/Fin sans point$/);
    expect(transcriptParagraphs("   ")).toEqual([]);
  });

  it("apparaît dans le texte et le Markdown de la note", () => {
    const doc = {
      type: "doc",
      content: [{ type: "audioClip", attrs: { src: "/api/attachments/a1", title: "Vocal du 8 octobre 2026 à 14 h 05", duration: 12 } }],
    };
    expect(docToText(doc)).toBe("Vocal du 8 octobre 2026 à 14 h 05");
    expect(docToMarkdown(doc, { resolveImage: (src) => src.replace("/api/attachments/", "fichiers/") })).toBe(
      "*[Vocal]* [Vocal du 8 octobre 2026 à 14 h 05](fichiers/a1)",
    );
  });
});
