# Mon Carnet de Recherche

Carnet de recherche numérique personnel : écrire, retrouver, relier ses notes.
Tout fonctionne en local, sur votre ordinateur. Aucune donnée ne quitte la machine.

## Lancer le carnet

Prérequis : Node.js 20 ou plus récent.

```bash
npm install          # première fois seulement
npm run carnet       # prépare la base, compile et démarre sur http://localhost:3000
```

Pour développer (rechargement à chaud) : `npm run dev`.

## Où sont les données ?

| Fichier | Contenu |
| --- | --- |
| `data/carnet.db` | base SQLite : notes, tags, liens, historique |
| `data/uploads/` | pièces jointes |

Copier le dossier `data/` suffit à sauvegarder tout le carnet.
Depuis **Paramètres**, vous pouvez aussi télécharger :

- une **sauvegarde complète** (ZIP : données + pièces jointes), réimportable ;
- **toutes les notes en Markdown** (ZIP, un fichier par note, compatible Obsidian) ;
- les **données en JSON** (notes, tags, liens, historique).

Chaque note s'exporte aussi seule, en Markdown ou en PDF (menu « ⋯ » de la note).

## Utilisation

- **Nouvelle note** : bouton, `Ctrl/⌘ + N` ou `Alt + N` (certains navigateurs réservent `Ctrl + N`).
- **Recherche** : `Ctrl/⌘ + K`. Elle porte sur les titres, le contenu et les tags, sans tenir compte des accents ni des majuscules.
- **Sauvegarde** : automatique, moins d'une seconde après la dernière frappe. `Ctrl/⌘ + S` enregistre immédiatement et crée un point dans l'historique.
- **Liens entre notes** : tapez `[[`, puis choisissez une note, ou créez-la. Les notes qui pointent vers une note sont listées sous « Mentionnée dans ».
- **Mise en forme rapide** : `# ` titre, `## ` sous-titre, `- ` liste, `1. ` liste numérotée, `> ` citation, `---` séparateur.
- **Pièces jointes** : trombone de la barre d'outils, glisser-déposer ou coller. Les images s'insèrent dans le texte, les PDF et fichiers texte ont un aperçu.
- **Historique** : icône horloge. Une version est conservée toutes les 10 minutes d'écriture et à chaque `Ctrl/⌘ + S`. Restaurer une version conserve la version actuelle.
- **Favoris** (étoile) et **notes importantes** (surligneur) : les notes importantes sont mises en évidence dans les listes.

## Technique

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Tiptap 3 · Prisma 7 + SQLite.

```
prisma/schema.prisma        modèle de données (Note, Tag, NoteLink, NoteVersion, Attachment)
src/app/(carnet)/           pages : accueil, notes, favoris, tags, chronologie, paramètres
src/app/imprimer/[id]/      version imprimable (export PDF)
src/app/api/                API locale (notes, tags, versions, pièces jointes, export, import)
src/components/editor/      éditeur Tiptap, barre d'outils, liens [[…]]
src/components/note/        page d'une note : sauvegarde auto, tags, historique, pièces jointes
src/lib/                    logique partagée (texte, recherche, dates, Markdown)
src/lib/server/             accès aux données (Prisma), export/import, fichiers
tests/                      tests unitaires (npm test)
```

Commandes utiles : `npm test` (tests), `npm run lint`, `npx prisma studio` (explorer la base).
