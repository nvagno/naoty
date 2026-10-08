"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  FileText,
  FileUp,
  Link2,
  Menu,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  Tag,
} from "lucide-react";
import { NewFromDocumentDialog } from "./NewFromDocumentDialog";
import { NewFromLinkDialog } from "./NewFromLinkDialog";
import { SearchModal } from "./SearchModal";
import { Kbd, useModKey } from "./ui";
import { createNote } from "@/lib/client/api";
import { applyTheme, isDark, readTheme } from "@/lib/client/theme";
import { emit, SAVE_EVENT } from "@/lib/client/events";

type CarnetContext = { openSearch: () => void; newNote: () => void; newFromLink: () => void; newFromDocument: () => void };

const Ctx = createContext<CarnetContext>({ openSearch: () => {}, newNote: () => {}, newFromLink: () => {}, newFromDocument: () => {} });

export const useCarnet = () => useContext(Ctx);

const NAV = [
  { href: "/", label: "Mon carnet", icon: BookOpen },
  { href: "/notes", label: "Toutes les notes", icon: FileText },
  { href: "/favoris", label: "Favoris", icon: Star },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/chronologie", label: "Chronologie", icon: CalendarDays },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/notes") return pathname === "/notes";
  return pathname.startsWith(href);
}

function ThemeButton() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(isDark());
    sync();
    window.addEventListener("carnet:theme", sync);
    return () => window.removeEventListener("carnet:theme", sync);
  }, []);
  return (
    <button
      onClick={() => applyTheme(isDark() ? "light" : "dark")}
      className="icon-btn"
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const mod = useModKey();
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <Link href="/" onClick={onNavigate} className="mb-8 flex items-center gap-2.5 px-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink font-serif text-sm font-semibold text-paper">
          C
        </span>
        <span className="font-serif text-[15px] font-semibold leading-tight text-ink">
          Carnet de
          <br />
          Recherche
        </span>
      </Link>
      <nav className="flex-1 space-y-0.5" aria-label="Navigation principale">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-paper-3 font-medium text-ink" : "text-ink-2 hover:bg-paper-3/60 hover:text-ink"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.1 : 1.8} className={active ? "text-ink" : "text-ink-3"} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center justify-between px-1">
        <ThemeButton />
        <span className="text-[11px] text-ink-3">
          <Kbd>{mod}</Kbd> <Kbd>K</Kbd>
        </span>
      </div>
    </div>
  );
}

function toggleSidebar() {
  const html = document.documentElement;
  const hidden = html.dataset.sidebar === "hidden";
  if (hidden) delete html.dataset.sidebar;
  else html.dataset.sidebar = "hidden";
  try {
    localStorage.setItem("carnet-sidebar", hidden ? "shown" : "hidden");
  } catch {}
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [fromLinkOpen, setFromLinkOpen] = useState(false);
  const [fromDocumentOpen, setFromDocumentOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const creating = useRef(false);

  const newNote = useCallback(async () => {
    if (creating.current) return;
    creating.current = true;
    try {
      const note = await createNote();
      router.push(`/notes/${note.id}?nouvelle=1`);
    } finally {
      setTimeout(() => (creating.current = false), 400);
    }
  }, [router]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const newFromLink = useCallback(() => setFromLinkOpen(true), []);
  const newFromDocument = useCallback(() => setFromDocumentOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && !e.shiftKey && !e.altKey && key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if ((mod && key === "n" && !e.shiftKey) || (e.altKey && !mod && e.code === "KeyN")) {
        // Ctrl+N est réservé par certains navigateurs : Alt+N fonctionne partout.
        e.preventDefault();
        newNote();
      } else if (mod && key === "s") {
        e.preventDefault();
        emit(SAVE_EVENT);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [newNote]);

  // Thème « Système » : suivre les changements de préférence du système d'exploitation.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => readTheme() === "system" && applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isHome = pathname === "/";
  const mod = useModKey();

  return (
    <Ctx.Provider value={{ openSearch, newNote, newFromLink, newFromDocument }}>
      <div className="flex min-h-dvh">
        <aside className="sidebar no-print sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-paper-2 md:block">
          <Sidebar />
        </aside>

        {drawer && (
          <div className="no-print fixed inset-0 z-40 md:hidden" onClick={() => setDrawer(false)}>
            <div className="absolute inset-0 bg-ink/20" />
            <aside
              className="fade-in absolute inset-y-0 left-0 w-64 border-r border-line bg-paper-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 bg-paper/85 px-4 backdrop-blur md:px-6">
            <button onClick={() => setDrawer(true)} className="icon-btn md:hidden" aria-label="Ouvrir le menu">
              <Menu size={18} />
            </button>
            <button
              onClick={toggleSidebar}
              className="icon-btn hidden md:inline-flex"
              aria-label="Afficher ou masquer le panneau latéral"
              title="Afficher / masquer le panneau"
            >
              <PanelLeft size={17} />
            </button>
            <div className="flex-1" />
            {!isHome && (
              <>
                <button
                  onClick={openSearch}
                  className="flex h-9 w-full max-w-64 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm text-ink-3 transition-colors hover:border-ink-3/50"
                >
                  <Search size={15} />
                  <span className="flex-1 text-left">Rechercher…</span>
                  <span className="hidden sm:inline">
                    <Kbd>{mod} K</Kbd>
                  </span>
                </button>
                <button onClick={newFromLink} className="icon-btn shrink-0" aria-label="Nouvelle note depuis un lien" title="Nouvelle note depuis un lien (article, DOI, arXiv)">
                  <Link2 size={16} />
                </button>
                <button
                  onClick={newFromDocument}
                  className="icon-btn shrink-0"
                  aria-label="Fiche de révision depuis un document"
                  title="Fiche de révision depuis un document (Albert)"
                >
                  <FileUp size={16} />
                </button>
                <button onClick={newNote} className="btn-primary shrink-0 py-1.5" title={`Nouvelle note (${mod}+N ou Alt+N)`}>
                  <Plus size={16} />
                  <span className="hidden sm:inline">Nouvelle note</span>
                </button>
              </>
            )}
          </header>
          <main className="flex-1 px-5 pb-24 pt-4 md:px-10">{children}</main>
        </div>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NewFromLinkDialog open={fromLinkOpen} onClose={() => setFromLinkOpen(false)} />
      <NewFromDocumentDialog open={fromDocumentOpen} onClose={() => setFromDocumentOpen(false)} />
    </Ctx.Provider>
  );
}
