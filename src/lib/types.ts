// Objets échangés entre l'API et l'interface.
import type { JSONNode } from "./text";

export type NoteSummary = {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  /** Extrait autour du terme recherché, le cas échéant */
  snippet?: string | null;
  tags: string[];
  favorite: boolean;
  important: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NoteRef = { id: string; title: string; date: string };

export type AttachmentInfo = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url: string;
};

export type NoteDetail = NoteSummary & {
  content: JSONNode;
  attachments: AttachmentInfo[];
  backlinks: NoteRef[];
};

export type NotePatch = {
  title?: string;
  content?: JSONNode;
  date?: string;
  tags?: string[];
  favorite?: boolean;
  important?: boolean;
  /** Enregistrement manuel : crée un point dans l'historique */
  snapshot?: boolean;
};

export type TagInfo = { id: string; name: string; count: number };

export type VersionInfo = { id: string; title: string; createdAt: string; words: number };
