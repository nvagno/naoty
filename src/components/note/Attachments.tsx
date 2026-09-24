"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Download, File, FileImage, FileText, Trash2 } from "lucide-react";
import type { AttachmentInfo } from "@/lib/types";
import { ConfirmDialog } from "../ui";
import { deleteAttachment } from "@/lib/client/api";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

const isPdf = (a: AttachmentInfo) => a.mimeType === "application/pdf";
const isImage = (a: AttachmentInfo) => a.mimeType.startsWith("image/") && a.mimeType !== "image/svg+xml";
const isText = (a: AttachmentInfo) => /^text\/(plain|markdown|csv)$/.test(a.mimeType);

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((t) => !cancelled && setText(t.length > 20000 ? t.slice(0, 20000) + "\n…" : t))
      .catch(() => !cancelled && setText("(aperçu indisponible)"));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-paper-2 p-4 text-xs leading-relaxed text-ink-2">
      {text ?? "Chargement…"}
    </pre>
  );
}

function AttachmentRow({ a, onDelete }: { a: AttachmentInfo; onDelete: () => void }) {
  const previewable = isPdf(a) || isImage(a) || isText(a);
  const [open, setOpen] = useState(isPdf(a));
  const Icon = isImage(a) ? FileImage : isPdf(a) || isText(a) ? FileText : File;
  return (
    <li className="rounded-lg border border-line">
      <div className="flex items-center gap-3 px-3 py-2">
        <Icon size={16} className="shrink-0 text-ink-3" />
        <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-ink hover:underline">
          {a.filename}
        </a>
        <span className="shrink-0 text-xs text-ink-3">{formatSize(a.size)}</span>
        {previewable && (
          <button onClick={() => setOpen((o) => !o)} className="icon-btn h-7 w-7" aria-label={open ? "Masquer l'aperçu" : "Afficher l'aperçu"}>
            <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        <a href={`${a.url}?download=1`} className="icon-btn h-7 w-7" aria-label="Télécharger" title="Télécharger">
          <Download size={14} />
        </a>
        <button onClick={onDelete} className="icon-btn h-7 w-7 hover:text-danger" aria-label="Supprimer la pièce jointe" title="Supprimer">
          <Trash2 size={14} />
        </button>
      </div>
      {open && (
        <div className="border-t border-line p-2">
          {isPdf(a) && <iframe src={a.url} title={a.filename} className="h-[60vh] w-full rounded-md bg-paper-2" />}
          {isImage(a) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.url} alt={a.filename} className="mx-auto max-h-[60vh] rounded-md" />
          )}
          {isText(a) && <TextPreview url={a.url} />}
        </div>
      )}
    </li>
  );
}

export function Attachments({
  items,
  onRemoved,
}: {
  items: AttachmentInfo[];
  onRemoved: (id: string) => void;
}) {
  const [pending, setPending] = useState<AttachmentInfo | null>(null);
  if (!items.length) return null;
  return (
    <section className="no-print mt-12">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-ink-3">Pièces jointes</h2>
      <ul className="space-y-2">
        {items.map((a) => (
          <AttachmentRow key={a.id} a={a} onDelete={() => setPending(a)} />
        ))}
      </ul>
      <ConfirmDialog
        open={!!pending}
        title="Supprimer la pièce jointe ?"
        message={
          <>
            « {pending?.filename} » sera définitivement supprimé.
            {pending && isImage(pending) && " Si l'image apparaît dans le texte, elle n'y sera plus affichée."}
          </>
        }
        confirmLabel="Supprimer"
        danger
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await deleteAttachment(pending.id).catch(() => {});
          onRemoved(pending.id);
        }}
      />
    </section>
  );
}
