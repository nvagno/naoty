"use client";

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PenTool } from "lucide-react";
import { takeOpenRequest } from "./Drawing";
import { loadExcalidraw, type DrawingElements } from "./excalidraw";
import { isDark } from "@/lib/client/theme";

const DrawingCanvas = dynamic(() => import("./DrawingCanvas"), { ssr: false });

function useDarkTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(isDark());
    sync();
    window.addEventListener("carnet:theme", sync);
    return () => window.removeEventListener("carnet:theme", sync);
  }, []);
  return dark;
}

/** Aperçu SVG du dessin dans la note ; un clic l'ouvre en plein écran pour le modifier. */
export function DrawingView({ node, editor, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const elements = (node.attrs.elements ?? []) as DrawingElements;
  const editable = editor.isEditable;
  const dark = useDarkTheme();
  const [open, setOpen] = useState(() => editable && takeOpenRequest(editor));
  const scene = JSON.stringify(elements.filter((e) => !e.isDeleted));
  const empty = scene === "[]";
  const key = `${dark ? "dark" : "light"}:${scene}`;
  // Aperçu associé à l'état du dessin pour lequel il a été produit (svg null : échec du rendu).
  const [preview, setPreview] = useState<{ key: string; svg: string | null } | null>(null);
  const rendered = empty || preview?.key === key;

  useEffect(() => {
    if (empty) return;
    let cancelled = false;
    loadExcalidraw()
      .then(({ exportToSvg }) =>
        exportToSvg({
          elements: JSON.parse(scene),
          appState: { exportBackground: false, exportWithDarkMode: dark },
          files: null,
          exportPadding: 16,
        }),
      )
      .then((el) => {
        // Largeur d'origine comme maximum : un petit croquis n'est pas agrandi.
        el.removeAttribute("height");
        return el.outerHTML;
      })
      .catch(() => null)
      .then((svg) => !cancelled && setPreview({ key: `${dark ? "dark" : "light"}:${scene}`, svg }));
    return () => {
      cancelled = true;
    };
  }, [scene, dark, empty]);

  // Pendant le recalcul, on garde l'aperçu précédent plutôt qu'un bloc vide.
  const svg = empty ? null : preview?.svg ?? null;

  return (
    <NodeViewWrapper
      className={`drawing${selected ? " ProseMirror-selectednode" : ""}`}
      data-drawing=""
      data-drawing-pending={rendered ? undefined : ""}
    >
      <div
        role={editable ? "button" : undefined}
        tabIndex={editable ? -1 : undefined}
        title={editable ? "Modifier le dessin" : undefined}
        onClick={editable ? () => setOpen(true) : undefined}
        className={`drawing-preview${editable ? " cursor-pointer" : ""}`}
        contentEditable={false}
      >
        {svg ? (
          // SVG produit localement par Excalidraw à partir des éléments du dessin.
          <div className="drawing-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="drawing-empty">
            <PenTool size={16} />
            {!empty ? (rendered ? "Aperçu indisponible" : "Préparation du dessin…") : editable ? "Dessin vide — cliquez pour dessiner" : "Dessin vide"}
          </div>
        )}
      </div>
      {open && (
        <DrawingCanvas
          elements={elements}
          dark={dark}
          onSave={(next) => {
            // La note a pu être fermée entre-temps.
            if (!editor.isDestroyed) updateAttributes({ elements: next });
          }}
          onDelete={() => {
            setOpen(false);
            deleteNode();
          }}
          onClose={() => {
            setOpen(false);
            editor.commands.focus();
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
