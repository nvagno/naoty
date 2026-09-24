"use client";

import { useEffect, useRef, useState } from "react";
import { TagChip } from "../ui";
import { listTags } from "@/lib/client/api";
import { fold, normalizeTag } from "@/lib/text";

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState("");
  const [known, setKnown] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focused) listTags().then((t) => setKnown(t.map((x) => x.name))).catch(() => {});
  }, [focused]);

  const q = fold(normalizeTag(value));
  const suggestions = known.filter((t) => !tags.includes(t) && (!q || fold(t).includes(q))).slice(0, 6);

  function add(name: string) {
    const clean = normalizeTag(name);
    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
    setValue("");
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && value)) {
      e.preventDefault();
      if (suggestions[active] && q && e.key !== ",") add(suggestions[active]);
      else if (value.trim()) add(value);
    } else if (e.key === "Backspace" && !value && tags.length) {
      onChange(tags.slice(0, -1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Escape" && value) {
      e.stopPropagation();
      setValue("");
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5" onClick={() => input.current?.focus()}>
      {tags.map((t) => (
        <TagChip key={t} name={t} onRemove={() => onChange(tags.filter((x) => x !== t))} />
      ))}
      <input
        ref={input}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (value.trim()) add(value);
        }}
        placeholder={tags.length ? "+ tag" : "Ajouter des tags… (#idée, #lecture)"}
        className="min-w-24 flex-1 bg-transparent py-1 text-xs text-ink-2 placeholder:text-ink-3 focus:outline-none"
        aria-label="Ajouter un tag"
      />
      {focused && suggestions.length > 0 && (
        <ul className="fade-in absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-paper p-1 shadow-soft">
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                }}
                onMouseMove={() => setActive(i)}
                className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs ${i === active && q ? "bg-paper-2 text-ink" : "text-ink-2"}`}
              >
                #{s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
