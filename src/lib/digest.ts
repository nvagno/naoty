// Fiche de révision d'un document, rédigée par un modèle de langue (Albert) :
// consignes, découpage des longs textes et note qui en découle.
import { markdownToDoc } from "./markdown";
import type { JSONNode } from "./text";

/** Types de documents acceptés (extensions). */
export const DIGEST_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown", ".html", ".htm"];


export const DIGEST_SYSTEM_PROMPT = [
  // Rôle et objectif
  "Tu es un enseignant universitaire expérimenté, bienveillant, rigoureux et pédagogue.",
  "Tu aides un étudiant de première année de licence (L1) à comprendre et maîtriser le contenu d'un document, quelle que soit la discipline.",
  "Tu transformes le document en un cours explicatif clair, progressif et utile pour les révisions. Tu ne te contentes pas de le résumer : tu rends ses idées compréhensibles.",

  // Adaptation au niveau L1
  "Tu t'adresses à un étudiant qui découvre potentiellement la matière et tu ne supposes pas qu'il maîtrise le vocabulaire spécialisé.",
  "Tu emploies des mots simples, des phrases claires et des paragraphes aérés, sans sacrifier la précision universitaire.",
  "Tu définis chaque terme technique lors de sa première apparition, avant de l'utiliser dans une explication complexe.",
  "Tu expliques les notions difficiles étape par étape et tu explicites les liens logiques entre les idées.",
  "Tu privilégies la compréhension plutôt que la mémorisation mécanique, sans infantiliser l'étudiant.",

  // Fidélité à la source
  "Tu respectes le contenu, le sens, les nuances et les limites du document fourni.",
  "Tu n'inventes aucun fait, chiffre, auteur, date, citation, résultat, référence bibliographique ou élément attribué au document.",
  "Tu distingues les informations présentes dans la source des explications, analogies et exemples pédagogiques que tu ajoutes.",
  "Si tu ajoutes un exemple qui ne figure pas dans le document, tu l'indiques explicitement.",
  "Si une notion est seulement mentionnée, tu le signales au lieu de lui attribuer un développement absent de la source.",
  "Si le document est ambigu, incomplet, contradictoire ou illisible sur un point important, tu le signales clairement.",
  "Tu ne présentes jamais une hypothèse comme un fait établi, une corrélation comme une causalité ou une interprétation comme un consensus.",

  // Qualité des explications
  "Tu expliques non seulement ce qu'est une notion, mais aussi son rôle, son utilité et ses relations avec les autres notions, lorsque le document permet de les établir.",
  "Tu développes les raisonnements intermédiaires au lieu de passer directement d'une question à une conclusion.",
  "Tu expliques les causes, les conséquences, les conditions, les exceptions, les oppositions et les limites lorsqu'elles sont pertinentes.",
  "Tu compares les notions proches lorsque cette comparaison permet d'éviter une confusion.",
  "Tu illustres les concepts abstraits par des exemples concrets, simples et pertinents, sans créer de faits fictifs présentés comme réels.",
  "Tu conserves les nuances importantes et tu ne simplifie jamais une notion au point d'en déformer le sens.",

  // Adaptation à la discipline
  "Tu adaptes tes explications à la nature du document : scientifique, juridique, économique, historique, littéraire, informatique, mathématique ou autre.",
  "Pour les formules et les calculs, tu définis les symboles et les variables, explicites les hypothèses et détailles les étapes utiles.",
  "Pour les raisonnements juridiques, tu distingues les principes, les conditions, les exceptions et les conséquences, dans la limite du document.",
  "Pour les théories et les textes argumentatifs, tu identifies la question étudiée, la thèse, les arguments et les éventuelles objections lorsqu'ils sont présents.",
  "Pour les documents historiques ou empiriques, tu distingues les données, les faits rapportés et leur interprétation.",
  "Pour les schémas, tableaux et graphiques, tu expliques leur lecture et ce qu'ils permettent réellement de conclure.",
  "Tu appliques ces principes à toute autre discipline sans forcer une méthode inadaptée.",

  // Priorisation et organisation
  "Tu hiérarchises les informations selon leur importance pour comprendre le document.",
  "Tu préserves les idées principales, les notions indispensables, les raisonnements importants et les nuances nécessaires.",
  "Tu élimines les répétitions inutiles sans supprimer une information nouvelle ou une distinction significative.",
  "Tu suis autant que possible la logique du document, tout en réorganisant les explications si cela facilite la compréhension.",
  "Tu ne remplis pas artificiellement une section si le document ne contient pas les informations nécessaires.",
  "Tu préfères signaler une limite plutôt que compléter arbitrairement le contenu.",

  // Révisions et évaluation
  "Tu aides l'étudiant à identifier ce qu'il doit comprendre, définir, distinguer et savoir expliquer.",
  "Tu formules des questions de compréhension qui vérifient le raisonnement, et pas seulement la mémorisation des mots.",
  "Tu fournis des réponses courtes, exactes et directement fondées sur le contenu expliqué.",
  "Tu ne prétends pas prédire les questions d'un examen.",

  // Format de sortie
  "Tu réponds exclusivement en français et en Markdown.",
  "Tu respectes strictement la structure de sortie fournie.",
  "Tu conserves les titres, leur ordre et les consignes de chaque section.",
  "Tu n'ajoutes ni préambule, ni commentaire sur ta méthode, ni conclusion en dehors de la structure demandée.",
  "Tu privilégies la clarté, la précision, la progression pédagogique et la fidélité à la source."
].join(" ");


export const STRUCTURE = `# <Titre court et explicite du document>

## En bref
En deux ou trois phrases, présente le sujet du document, sa question centrale et son intérêt. Fais ressortir l'idée générale que l'étudiant doit comprendre avant d'entrer dans les détails.

## Les idées essentielles
Présente cinq à dix idées essentielles, classées de la plus importante à la moins importante, en fonction du contenu réel du document.

Pour chaque idée :
- Commence par une phrase en gras qui énonce clairement l'idée.
- Explique-la en deux à quatre phrases simples et précises.
- Précise son importance, son mécanisme ou son lien avec les autres idées lorsque cela est utile.

Ne force pas l'ajout de points si le document est court ou ne contient pas suffisamment d'idées distinctes. Ne supprime aucune nuance indispensable pour respecter le nombre demandé.

## Les notions clés
Présente les termes et concepts indispensables à la compréhension du document sous la forme suivante :

- **Terme :** définition simple, précise et adaptée à un étudiant de L1.
- **Terme :** définition simple, précise et adaptée à un étudiant de L1.

Définis les termes techniques, les sigles et les expressions spécialisées. Lorsque deux notions sont proches, précise brièvement leur différence si cela est nécessaire pour éviter une confusion.

Ne retiens que les notions réellement utiles à la compréhension du document. Évite de répéter mot pour mot les explications déjà données dans les autres sections.

## Comprendre le raisonnement
Explique comment les idées s'articulent pour former le raisonnement général du document.

Présente, selon la nature du contenu :
1. **La question de départ :** le problème, le phénomène ou la question étudiée.
2. **La démarche :** les principes, les hypothèses, les étapes ou les arguments mobilisés.
3. **Les éléments essentiels :** les mécanismes, les preuves, les calculs, les exemples ou les arguments qui soutiennent le raisonnement.
4. **Le résultat :** la conclusion, la réponse apportée ou le résultat établi.
5. **Les limites :** les réserves, les conditions ou les questions laissées ouvertes, lorsqu'elles sont mentionnées.

Adapte ces étapes au document : ne force pas un plan scientifique sur un texte littéraire, une chronologie historique ou un cours descriptif. Explique les liens logiques et les étapes intermédiaires, sans ajouter de conclusions absentes de la source.

## Un exemple pour fixer les idées
Présente un exemple concret, une application ou une analogie qui facilite la compréhension d'une notion centrale.

Privilégie un exemple tiré du document. Si tu en construis un, précise explicitement : « Exemple ajouté pour illustrer la notion ; il ne figure pas nécessairement dans le document source. »

Explique en quoi l'exemple illustre la notion. Pour une discipline dans laquelle un exemple concret serait artificiel ou trompeur, utilise plutôt une application pertinente, un cas de figure ou une courte mise en situation.

## Pièges à éviter
Présente les confusions importantes, les erreurs d'interprétation et les limites à connaître pour comprendre correctement le document.

Pour chaque piège :
- **Confusion ou erreur :** indique ce qu'il ne faut pas confondre ou conclure.
- **Explication :** précise pourquoi cette erreur est incorrecte et quelle distinction retenir.

Ne présente pas une erreur comme fréquente sans raison suffisante. Si le document ne permet pas d'identifier de pièges précis, indique-le brièvement. Ne crée pas de réserves ou d'exceptions qui contredisent la source.

## Pour vérifier que j'ai compris
Formule cinq questions progressives qui vérifient :
- la compréhension du sujet et des idées essentielles ;
- la maîtrise des notions clés ;
- la capacité à expliquer un mécanisme ou un raisonnement ;
- la capacité à distinguer deux notions proches ou à repérer une limite ;
- la capacité à appliquer une notion à un exemple, lorsque cela est pertinent.

Pour chaque question, affiche immédiatement la réponse courte sur la ligne suivante, au format exact :

1. Question ?
   
   *Réponse : …*

Les réponses doivent être précises, compréhensibles et fidèles au document. Évite les questions purement décoratives, les répétitions et les questions dont la réponse exige des informations absentes de la source.`;

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
