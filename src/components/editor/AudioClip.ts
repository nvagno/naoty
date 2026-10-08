import { mergeAttributes, Node } from "@tiptap/core";
import { formatDuration } from "@/lib/audio";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    audioClip: {
      /** Insère un enregistrement vocal (pièce jointe de la note). */
      insertAudioClip: (attrs: { src: string; title: string; duration: number }) => ReturnType;
    };
  }
}

/**
 * Enregistrement vocal lu dans la note. Le fichier est une pièce jointe ; sa durée est stockée
 * dans le nœud, car les enregistrements WebM du navigateur ne l'indiquent pas.
 */
export const AudioClip = Node.create({
  name: "audioClip",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "", parseHTML: (el) => el.querySelector("audio")?.getAttribute("src") ?? "" },
      title: { default: "", parseHTML: (el) => el.getAttribute("data-title") ?? "", renderHTML: (a) => ({ "data-title": a.title }) },
      duration: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-duration")) || 0,
        renderHTML: (a) => ({ "data-duration": String(a.duration ?? 0) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-audio-clip]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, ...attrs } = HTMLAttributes;
    return [
      "div",
      mergeAttributes({ "data-audio-clip": "", class: "audio-clip" }, attrs),
      ["audio", { src: src || node.attrs.src, controls: "", preload: "metadata" }],
    ];
  },

  renderText({ node }) {
    return `[Vocal${node.attrs.title ? ` : ${node.attrs.title}` : ""}]`;
  },

  addCommands() {
    return {
      insertAudioClip:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "audio-clip";
      dom.setAttribute("data-audio-clip", "");
      dom.contentEditable = "false";

      const label = document.createElement("div");
      label.className = "audio-clip-label";
      label.textContent = [node.attrs.title || "Vocal", node.attrs.duration ? formatDuration(node.attrs.duration) : ""].filter(Boolean).join(" · ");

      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = node.attrs.src;
      // WebM sans durée : on la fait calculer au navigateur en allant à la fin, puis on revient au début.
      audio.addEventListener("loadedmetadata", () => {
        if (audio.duration !== Infinity) return;
        audio.addEventListener("durationchange", () => (audio.currentTime = 0), { once: true });
        audio.currentTime = 1e101;
      });

      dom.append(label, audio);
      return { dom, ignoreMutation: () => true, stopEvent: (e) => e.target === audio };
    };
  },
});
