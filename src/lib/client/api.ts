// Appels à l'API locale, côté navigateur.
import type { AttachmentInfo, NoteDetail, NotePatch, NoteRef, NoteSummary, TagInfo, VersionInfo } from "@/lib/types";
import type { JSONNode } from "@/lib/text";
import { todayKey } from "@/lib/dates";
import type { LinkMeta } from "@/lib/linkMeta";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Erreur ${res.status}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export type ListParams = { q?: string; tag?: string; favorite?: boolean; important?: boolean; limit?: number; offset?: number };

export function listNotes(params: ListParams = {}) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.tag) p.set("tag", params.tag);
  if (params.favorite) p.set("favorite", "1");
  if (params.important) p.set("important", "1");
  if (params.limit) p.set("limit", String(params.limit));
  if (params.offset) p.set("offset", String(params.offset));
  return request<{ notes: NoteSummary[]; hasMore: boolean }>(`/api/notes?${p}`);
}

export const getNote = (id: string) => request<NoteDetail>(`/api/notes/${id}`);

export const createNote = (data: { title?: string; date?: string; tags?: string[] } = {}) =>
  request<NoteDetail>("/api/notes", { method: "POST", body: JSON.stringify({ date: todayKey(), ...data }) });

export const updateNote = (id: string, patch: NotePatch, keepalive = false) =>
  request<NoteDetail>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch), keepalive });

export const deleteNote = (id: string) => request<null>(`/api/notes/${id}`, { method: "DELETE" });

export const lookupNotes = (q: string, exclude?: string) =>
  request<NoteRef[]>(`/api/notes/lookup?q=${encodeURIComponent(q)}${exclude ? `&exclude=${exclude}` : ""}`);

export const resolveTitle = (title: string, create = false) =>
  request<NoteRef>("/api/notes/resolve", { method: "POST", body: JSON.stringify({ title, create }) });

export const listTags = () => request<TagInfo[]>("/api/tags");
export const createTag = (name: string) => request<TagInfo>("/api/tags", { method: "POST", body: JSON.stringify({ name }) });
export const renameTag = (id: string, name: string) =>
  request<TagInfo>(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
export const deleteTag = (id: string) => request<null>(`/api/tags/${id}`, { method: "DELETE" });

export const listVersions = (id: string) => request<VersionInfo[]>(`/api/notes/${id}/versions`);
export const getVersion = (id: string, versionId: string) =>
  request<{ id: string; title: string; createdAt: string; content: JSONNode }>(`/api/notes/${id}/versions/${versionId}`);
export const restoreVersion = (id: string, versionId: string) =>
  request<NoteDetail>(`/api/notes/${id}/versions/${versionId}`, { method: "POST" });

export function uploadAttachment(noteId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<AttachmentInfo>(`/api/notes/${noteId}/attachments`, { method: "POST", body: form });
}

export const fetchLinkMeta = (url: string) =>
  request<LinkMeta & { error?: string }>(`/api/link-preview?url=${encodeURIComponent(url)}`);

export const deleteAttachment = (id: string) => request<null>(`/api/attachments/${id}`, { method: "DELETE" });

export function importFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<{ created: number; skipped: number }>("/api/import", { method: "POST", body: form });
}
