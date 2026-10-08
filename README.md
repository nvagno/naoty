# Mon Carnet de Recherche

Carnet de recherche numérique personnel : écrire, retrouver, relier ses notes.
Tout fonctionne en local, sur votre ordinateur. Vos notes ne quittent jamais la machine : seules les adresses et DOI que vous demandez à récupérer (fiches de lien, note depuis un lien) sont envoyés au site concerné et aux bases bibliographiques ouvertes.

## Installation

Le carnet s'utilise de deux façons :

- **application de bureau** (Electron) : une fenêtre à part, un installateur par système ;
- **dans le navigateur**, depuis le dossier du projet.

Dans les deux cas, tout reste sur votre ordinateur.

### Prérequis

- [Node.js](https://nodejs.org/) 22 ou plus récent (avec `npm`) ;
- une connexion Internet lors de la première installation (téléchargement des dépendances et d'Electron) ;
- pour l'application de bureau, des outils de compilation, au cas où aucun binaire précompilé de SQLite ne serait disponible pour votre système :
  - **Linux** : `sudo apt install build-essential python3` (Debian, Ubuntu, Kali) ;
  - **macOS** : `xcode-select --install` ;
  - **Windows** : « Outils de build Visual Studio » avec la charge de travail « Développement Desktop en C++ ».

Récupérez le projet puis installez les dépendances :

```bash
git clone <adresse-du-dépôt> carnet-recherche
cd carnet-recherche
npm install
```

### Application de bureau

**Essayer sans installer** :

```bash
npm run electron     # compile le carnet puis l'ouvre dans une fenêtre
```

**Créer l'installateur** :

```bash
npm run dist
```

Les fichiers produits sont dans `dist/` :

| Système | Fichier | Installation |
| --- | --- | --- |
| Linux | `carnet-recherche-<version>-x86_64.AppImage` | `chmod +x` sur le fichier puis double-clic (installez `libfuse2` si l'AppImage ne démarre pas) |
| Linux (Debian, Ubuntu, Kali) | `carnet-recherche-<version>-amd64.deb` | `sudo apt install ./dist/carnet-recherche-<version>-amd64.deb` |
| Windows | `carnet-recherche-<version>-x64.exe` | lancer l'installateur |
| macOS | `carnet-recherche-<version>-<arch>.dmg` | ouvrir le DMG et glisser l'application dans *Applications* |

Il faut construire l'installateur **sur le système visé** : l'application contient SQLite compilé pour ce système. On ne produit donc pas l'installateur Windows depuis Linux, par exemple.

L'application n'est pas signée. Au premier lancement, Windows (SmartScreen) peut demander une confirmation (« Informations complémentaires » puis « Exécuter quand même »). Sur macOS, faites un clic droit sur l'application, puis « Ouvrir ».

Une seule fenêtre du carnet peut être ouverte à la fois. Les liens web s'ouvrent dans votre navigateur habituel.

### Dans le navigateur

```bash
npm run carnet       # prépare la base, compile et démarre sur http://localhost:3000
```

Pour développer (rechargement à chaud) : `npm run dev`.

## Où sont les données ?

Le chemin exact du dossier des données est indiqué dans **Paramètres → Où sont mes données ?**. Dans l'application de bureau, on peut aussi passer par le menu **Fichier → Ouvrir le dossier des données**.

| Utilisation | Dossier des données |
| --- | --- |
| Navigateur (`npm run carnet`, `npm run dev`) | `data/` dans le dossier du projet |
| Application de bureau, Linux | `~/.config/Mon Carnet de Recherche/data/` |
| Application de bureau, Windows | `%APPDATA%\Mon Carnet de Recherche\data\` |
| Application de bureau, macOS | `~/Library/Application Support/Mon Carnet de Recherche/data/` |

Ce dossier contient :

| Fichier | Contenu |
| --- | --- |
| `carnet.db` | base SQLite : notes, tags, liens, historique |
| `uploads/` | pièces jointes |

Pour faire une sauvegarde complète, il suffit de copier ce dossier. Pour placer les données ailleurs, par exemple dans un dossier synchronisé, lancez l'application avec la variable d'environnement `CARNET_DATA_DIR` qui pointe vers ce dossier.

**Retrouver ses notes dans l'application de bureau** : le carnet du navigateur et celui de l'application ne partagent pas le même dossier. Deux façons de transférer les notes :

- dans le navigateur, **Paramètres → Sauvegarde complète**, puis dans l'application, **Paramètres → Importer / restaurer** ;
- ou, l'application étant fermée, copiez `carnet.db` et `uploads/` du dossier `data/` du projet vers le dossier des données de l'application.

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
- **Liens web** : collez une adresse seule sur une ligne vide pour créer une **fiche du lien** (titre, description, site et, pour un article scientifique, auteurs, revue et date). Collée dans une phrase, l'adresse reste un lien simple. La fenêtre « Lien web » pré-remplit le titre de la page. La récupération nécessite une connexion Internet.
- **Note depuis un lien** : bouton « Depuis un lien » de l'accueil, ou icône lien à côté de « Nouvelle note ». Saisissez l'adresse d'un article ou d'une page, un DOI (`10.…`) ou un identifiant arXiv. Le carnet récupère le titre, les auteurs, la date, la revue (volume, numéro, pages), l'éditeur, le DOI, le résumé, les mots-clés et le lien du PDF, puis crée une note de lecture. Cette note contient une fiche du lien, la référence, une citation mise en forme, le résumé et une section « Notes de lecture ». Les informations viennent des métadonnées de la page (balises `citation_*`, Dublin Core, JSON-LD) et des bases ouvertes Crossref, DataCite, OpenAlex et arXiv. Les notices PubMed sont lues via OpenAlex. Si le DOI ou l'adresse figure déjà dans une note, la fenêtre l'indique. Certains sites bloquent la lecture automatique (JSTOR, Cairn…) : utilisez alors le DOI de l'article.
- **Fiche de révision depuis un document** : bouton « Depuis un document » de l'accueil, ou icône de téléversement à côté de « Nouvelle note ». Choisissez un PDF, un document Word (`.docx`), un fichier texte, Markdown ou HTML : Albert API en tire une fiche expliquée comme pour un étudiant de L1 (en bref, idées essentielles, notions clés, raisonnement, exemple, pièges à éviter, questions avec réponses), enregistrée comme une note avec le document en pièce jointe et une section « Mes notes ». Un long document est lu par parties, puis les relevés sont réunis. Il faut une clé d'API Albert, à renseigner dans **Paramètres → Assistant IA** (ou dans la variable d'environnement `ALBERT_API_KEY`) ; le modèle se choisit au même endroit (par défaut `openweight-medium`, Mistral Small). Le texte du document est envoyé à Albert, le reste du carnet ne quitte pas l'ordinateur. Les PDF numérisés (images sans texte) ne sont pas lus. Relisez la fiche : le modèle peut se tromper.
- **Vocaux** : icône micro de la barre d'outils. L'enregistrement démarre aussitôt (pause, reprise, niveau du micro) ; « Terminer » permet de le réécouter avant de l'insérer dans la note, avec un lecteur. Le fichier est conservé en pièce jointe. Si une clé d'API Albert est renseignée, la transcription (Whisper, en français) est ajoutée sous le vocal : elle est alors cherchable comme le reste de la note. Albert accepte des fichiers de 20 Mo au plus, soit environ 40 minutes d'enregistrement.
- **Pièces jointes** : trombone de la barre d'outils, glisser-déposer ou coller. Les images s'insèrent dans le texte, les PDF et fichiers texte ont un aperçu.
- **Historique** : icône horloge. Une version est conservée toutes les 10 minutes d'écriture et à chaque `Ctrl/⌘ + S`. Restaurer une version conserve la version actuelle.
- **Favoris** (étoile) et **notes importantes** (surligneur) : les notes importantes sont mises en évidence dans les listes.

## Technique

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Tiptap 3 · Prisma 7 + SQLite · Electron.

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
electron/main.mjs           application de bureau : fenêtre, menu, démarrage du serveur local
electron/server.mjs         processus serveur : migrations de la base puis serveur Next autonome
scripts/electron-prepare.mjs  build Next « standalone » + SQLite recompilé pour Electron
scripts/electron-after-pack.mjs  copie du serveur dans l'application (electron-builder)
```

L'application de bureau lance le serveur Next autonome (`.next/standalone`) sur un port local libre (`127.0.0.1`), dans un processus utilitaire d'Electron. Elle applique les migrations Prisma au démarrage, avec la même table `_prisma_migrations` que `prisma migrate deploy`. La configuration d'electron-builder se trouve dans la clé `build` de `package.json`.

Commandes utiles : `npm test` (tests), `npm run lint`, `npx prisma studio` (explorer la base).
