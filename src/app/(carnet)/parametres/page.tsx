"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Archive, FileJson, FileText, Monitor, Moon, Sun, Upload } from "lucide-react";
import { Kbd, PageHeader, useModKey } from "@/components/ui";
import { getDataDir, importFile } from "@/lib/client/api";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/client/theme";

function subscribeTheme(onChange: () => void) {
  window.addEventListener("carnet:theme", onChange);
  return () => window.removeEventListener("carnet:theme", onChange);
}

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="font-medium text-ink">{title}</h2>
      {description && <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-3">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ExportLink({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <a href={href} className="flex items-start gap-3 rounded-lg border border-line px-4 py-3 transition-colors hover:bg-paper-2">
      <span className="mt-0.5 text-ink-3">{icon}</span>
      <span>
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs leading-relaxed text-ink-3">{detail}</span>
      </span>
    </a>
  );
}

export default function SettingsPage() {
  const mod = useModKey();
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as ThemeChoice);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dataDir, setDataDir] = useState<string | null>(null);

  useEffect(() => {
    getDataDir()
      .then((r) => setDataDir(r.dir))
      .catch(() => {});
  }, []);


  const themes: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Clair", icon: <Sun size={15} /> },
    { value: "dark", label: "Sombre", icon: <Moon size={15} /> },
    { value: "system", label: "Système", icon: <Monitor size={15} /> },
  ];

  async function onImport(file: File) {
    setImporting(true);
    setImportMsg(null);
    try {
      const r = await importFile(file);
      setImportMsg({
        ok: true,
        text: `${r.created} note${r.created > 1 ? "s" : ""} importée${r.created > 1 ? "s" : ""}${
          r.skipped ? `, ${r.skipped} déjà présente${r.skipped > 1 ? "s" : ""} (conservée${r.skipped > 1 ? "s" : ""} telle${r.skipped > 1 ? "s" : ""} quelle${r.skipped > 1 ? "s" : ""})` : ""
        }.`,
      });
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : "Import impossible." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl pt-4">
      <PageHeader title="Paramètres" />

      <Section title="Apparence">
        <div className="inline-flex rounded-lg border border-line p-1" role="radiogroup" aria-label="Thème">
          {themes.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={theme === t.value}
              onClick={() => {
                applyTheme(t.value);
              }}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition-colors ${
                theme === t.value ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Exporter le carnet"
        description="Vos notes vous appartiennent. Ces exports utilisent des formats ouverts, lisibles sans l'application."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <ExportLink
            href="/api/export?format=backup"
            icon={<Archive size={17} />}
            title="Sauvegarde complète"
            detail="Archive ZIP : toutes les données et les pièces jointes. Réimportable."
          />
          <ExportLink
            href="/api/export?format=markdown"
            icon={<FileText size={17} />}
            title="Toutes les notes en Markdown"
            detail="Archive ZIP : un fichier .md par note, compatible Obsidian."
          />
          <ExportLink
            href="/api/export?format=json"
            icon={<FileJson size={17} />}
            title="Données en JSON"
            detail="Notes, tags, liens et historique, sans les fichiers joints."
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-3">
          Chaque note peut aussi être exportée seule (Markdown ou PDF) depuis son menu « ⋯ ».
        </p>
      </Section>

      <Section
        title="Importer / restaurer"
        description="Importe une sauvegarde complète (.zip) ou un export JSON. Les notes déjà présentes dans le carnet ne sont jamais écrasées."
      >
        <input
          ref={fileInput}
          type="file"
          accept=".zip,.json,application/json,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onImport(f);
          }}
        />
        <button onClick={() => fileInput.current?.click()} disabled={importing} className="btn-outline">
          <Upload size={15} />
          {importing ? "Import en cours…" : "Choisir un fichier…"}
        </button>
        {importMsg && (
          <p className={`mt-3 text-sm ${importMsg.ok ? "text-ink-2" : "text-danger"}`} role="status">
            {importMsg.text}
          </p>
        )}
      </Section>

      <Section
        title="Où sont mes données ?"
        description="Tout est stocké localement, sur cet ordinateur, dans le dossier des données :"
      >
        <p className="mb-4 break-all">
          <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs">{dataDir ?? "…"}</code>
        </p>
        <ul className="space-y-1.5 text-sm text-ink-2">
          <li>
            <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs">carnet.db</code> — la base SQLite (notes, tags, liens, historique)
          </li>
          <li>
            <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs">uploads/</code> — les pièces jointes
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          Copier ce dossier suffit pour sauvegarder l&apos;intégralité du carnet.
        </p>
      </Section>

      <Section title="Raccourcis clavier">
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          {[
            [[mod, "N"], "Nouvelle note (ou Alt + N)"],
            [[mod, "K"], "Rechercher"],
            [[mod, "S"], "Enregistrer et créer un point dans l'historique"],
            [["Échap"], "Fermer une fenêtre"],
            [["[["], "Lier une autre note"],
            [[mod, "B"], "Gras"],
            [[mod, "I"], "Italique"],
          ].map(([keys, label]) => (
            <div key={label as string} className="contents">
              <dt className="flex gap-1">
                {(keys as string[]).map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dt>
              <dd className="text-ink-2">{label as string}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 max-w-xl text-xs leading-relaxed text-ink-3">
          Raccourcis d&apos;écriture : <code># </code> titre, <code>## </code> sous-titre, <code>- </code> liste, <code>1. </code> liste
          numérotée, <code>&gt; </code> citation, <code>---</code> séparateur, <code>**gras**</code>, <code>*italique*</code>.
          Certains navigateurs réservent {mod}+N à l&apos;ouverture d&apos;une fenêtre : utilisez alors Alt+N.
        </p>
      </Section>
    </div>
  );
}
