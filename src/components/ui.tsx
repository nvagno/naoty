"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { highlightSegments } from "@/lib/text";
import { modKey } from "@/lib/client/events";

export function Modal({
  open,
  onClose,
  children,
  label,
  width = "max-w-lg",
  position = "center",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  width?: string;
  position?: "center" | "top";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    // Focus sur le premier champ, sinon sur le panneau
    requestAnimationFrame(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, button");
      (target ?? panel.current)?.focus();
    });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={`no-print fixed inset-0 z-50 flex justify-center bg-ink/20 px-4 backdrop-blur-[2px] dark:bg-black/50 ${
        position === "top" ? "items-start pt-[12vh]" : "items-center"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`fade-in w-full ${width} max-h-[80vh] overflow-hidden rounded-xl border border-line bg-paper shadow-soft`}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-5 py-3">
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <button onClick={onClose} className="rounded p-1 text-ink-3 hover:bg-paper-2 hover:text-ink" aria-label="Fermer">
        <X size={16} />
      </button>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} label={title} width="max-w-sm">
      <div className="p-5">
        <h2 className="font-medium text-ink">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-2">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost" data-autofocus>
            Annuler
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={danger ? "btn-danger" : "btn-primary"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function TagChip({ name, href, onRemove }: { name: string; href?: string | false; onRemove?: () => void }) {
  const cls =
    "inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-xs text-ink-2 transition-colors";
  const label = <span>#{name}</span>;
  if (onRemove) {
    return (
      <span className={cls}>
        {label}
        <button
          onClick={onRemove}
          className="-mr-0.5 rounded-full p-0.5 text-ink-3 hover:bg-paper-3 hover:text-ink"
          aria-label={`Retirer le tag ${name}`}
        >
          <X size={11} />
        </button>
      </span>
    );
  }
  if (href === false) return <span className={cls}>{label}</span>;
  return (
    <Link
      href={href ?? `/notes?tag=${encodeURIComponent(name)}`}
      className={`${cls} hover:bg-paper-3 hover:text-ink`}
    >
      {label}
    </Link>
  );
}

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded-sm bg-marker-soft px-px text-inherit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-paper px-1.5 py-px font-sans text-[10px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-ink-3">{children}</div>;
}

export function Spinner() {
  return <div className="py-12 text-center text-sm text-ink-3">Chargement…</div>;
}

/** « Ctrl » ou « ⌘ », déterminé après le montage pour éviter un écart avec le rendu serveur. */
export function useModKey() {
  return useSyncExternalStore(noopSubscribe, modKey, () => "Ctrl");
}

const noopSubscribe = () => () => {};
