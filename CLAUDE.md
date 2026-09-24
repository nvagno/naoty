@AGENTS.md

# Mon Carnet de Recherche — notes pour les agents

Carnet de recherche personnel, local, mono-utilisateur. Interface et textes en français. Priorité : écriture et consultation ; ne pas ajouter de fonctions de gestion de projet, de bibliographie ou de collaboration.

- Données : SQLite `data/carnet.db` via Prisma 7 (adaptateur better-sqlite3, client généré dans `src/generated/prisma`, `npx prisma generate` après modification du schéma, `npx prisma migrate dev` pour une migration).
- Le contenu des notes est un document Tiptap JSON (`Note.content`). `contentText` et `searchText` (texte replié sans accents) sont recalculés côté serveur à chaque enregistrement dans `src/lib/server/notes.ts`. Toute écriture de note doit passer par ce module.
- Les liens `[[…]]` sont des nœuds `noteLink` { id, title } ; la table `NoteLink` est reconstruite à chaque enregistrement ; renommer une note met à jour le titre des liens qui y pointent.
- Dates des notes : chaînes `AAAA-MM-JJ` en heure locale (`src/lib/dates.ts`), jamais d'objets Date pour `Note.date`.
- Pages clientes qui chargent les données via `/api/*`. Les pages statiques ne doivent rien afficher qui dépende de l'heure au moment du build.
- Vérifications : `npx tsc --noEmit`, `npm run lint`, `npm test`, `npx next build`.
