// Fiche de révision d'un document, rédigée par un modèle de langue (Albert) :
// consignes, découpage des longs textes et note qui en découle.
import { markdownToDoc } from "./markdown";
import type { JSONNode } from "./text";

/** Types de documents acceptés (extensions). */
export const DIGEST_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown", ".html", ".htm"];

export const DIGEST_SYSTEM_PROMPT = [
  "Tu es un enseignant universitaire bienveillant et rigoureux.",
  "Tu aides un étudiant de première année de licence (L1) à maîtriser le contenu d'un document.",
  "Tu expliques avec des mots simples, tu définis chaque terme technique la première fois qu'il apparaît et tu donnes des exemples concrets.",
  "Tu restes fidèle au document : tu n'inventes ni faits, ni chiffres, ni auteurs, ni références. Si une notion n'est qu'évoquée, tu le dis.",
  "Tu réponds en français, en Markdown, sans préambule ni conclusion hors de la structure demandée.",
].join(" ");

const STRUCTURE = `# <titre court et explicite du document>

## En bref
Deux ou trois phrases : de quoi parle le document et pourquoi c'est important.

## Les idées essentielles
Cinq à dix points numérotés, du plus important au moins important. Chaque point commence par une phrase en gras qui énonce l'idée, suivie d'une explication simple de deux à quatre phrases.

## Les notions clés
Une liste « **terme** : définition simple » pour chaque notion indispensable à la compréhension.

## Comprendre le raisonnement
Comment les idées s'enchaînent : la question de départ, la démarche, les résultats ou arguments, la conclusion.

## Un exemple pour fixer les idées
Un exemple concret ou une analogie, tiré du document si possible ; sinon, précise que l'exemple est ajouté pour illustrer.

## Pièges à éviter
Les confusions fréquentes et les limites signalées par le document.

## Pour vérifier que j'ai compris
Cinq questions de compréhension, chacune suivie de sa réponse courte sur une nouvelle ligne, en italique (*Réponse : …*).`;

/** Consigne pour un document qui tient en une seule requête. */
export function digestPrompt(text: string, filename: string): string {
  return `Voici le texte extrait du document « ${filename} ». Rédige une fiche de révision qui permette à un étudiant de L1 de bien maîtriser son contenu, en respectant exactement cette structure :

${STRUCTURE}

Texte du document :
"""
${text}
"""`;
}

/** Consigne pour une partie d'un long document : relevé fidèle, sans mise en forme pédagogique. */
export function partPrompt(text: string, filename: string, index: number, total: number): string {
  return `Voici la partie ${index} sur ${total} du texte extrait du document « ${filename} ». Relève de façon fidèle et dense les idées, définitions, arguments, résultats, chiffres et exemples importants de cette partie, sous forme de liste Markdown. N'ajoute rien qui n'y figure pas.

Texte de la partie ${index} :
"""
${text}
"""`;
}

/** Consigne finale d'un long document, à partir des relevés de chaque partie. */
export function mergePrompt(parts: string[], filename: string): string {
  const notes = parts.map((p, i) => `### Partie ${i + 1}\n${p.trim()}`).join("\n\n");
  return `Le document « ${filename} » est trop long pour être lu d'un seul tenant : voici les relevés fidèles de ses ${parts.length} parties, dans l'ordre. À partir de ces relevés uniquement, rédige une fiche de révision qui permette à un étudiant de L1 de bien maîtriser l'ensemble du document, en respectant exactement cette structure :

${STRUCTURE}

Relevés :
"""
${notes}
"""`;
}

/** Découpe un texte en morceaux d'au plus `maxChars` caractères, de préférence entre deux paragraphes. */
export function splitText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    let cut = window.lastIndexOf("\n\n");
    if (cut < maxChars / 2) cut = window.lastIndexOf("\n");
    if (cut < maxChars / 2) cut = window.search(/[.!?…]\s[^.!?…]*$/) + 1;
    if (cut < maxChars / 2) cut = window.lastIndexOf(" ");
    if (cut < maxChars / 2) cut = maxChars;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Nettoie le texte extrait d'un document : coupures de mots, espaces, lignes vides en série. */
export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/­/g, "")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Titre (premier titre de niveau 1) et corps de la fiche rédigée par le modèle. */
export function splitDigest(markdown: string): { title: string; body: string } {
  // Certains modèles entourent leur réponse d'un bloc ```markdown.
  const text = markdown
    .trim()
    .replace(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/, "$1")
    .trim();
  const m = text.match(/^#\s+(.+)\n?/);
  if (!m) return { title: "", body: text };
  return { title: m[1].replace(/[*_`]/g, "").trim(), body: text.slice(m[0].length).trim() };
}

/** Nom du document sans extension, comme titre de repli. */
export function titleFromFilename(filename: string): string {
  return filename.replace(/\.[a-z0-9]{1,10}$/i, "").replace(/[_]+/g, " ").trim();
}

export type DigestSource = {
  filename: string;
  model: string;
  parts: number;
  /** Seul le début du document a été lu */
  truncated?: boolean;
};

/** Contenu de la note : origine de la fiche, fiche, puis place pour les notes personnelles. */
export function digestToDoc(body: string, source: DigestSource): JSONNode {
  const italic = [{ type: "italic" }];
  const origin = `Fiche rédigée par Albert (${source.model}) à partir de « ${source.filename} »${
    source.parts > 1 ? `, lu en ${source.parts} parties` : ""
  }${source.truncated ? " (document très long : seul le début a été lu)" : ""}. À relire : le modèle peut se tromper ou simplifier à l'excès.`;
  const fiche = markdownToDoc(body).content ?? [];
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: origin, marks: italic }] },
      ...fiche,
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Mes notes" }] },
      { type: "paragraph" },
    ],
  };
}
