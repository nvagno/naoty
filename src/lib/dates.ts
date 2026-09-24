// Dates des notes : chaînes « AAAA-MM-JJ » en heure locale, sans fuseau.

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(now = new Date()): string {
  return toDateKey(now);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** « Aujourd'hui », « Hier », « 12 septembre » ou « 12 septembre 2025 ». */
export function dayLabel(key: string, now = new Date()): string {
  const today = todayKey(now);
  const yesterday = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return "Hier";
  const d = parseKey(key);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** « jeudi 24 septembre 2026 » */
export function longDate(key: string): string {
  const d = parseKey(key);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « 24 septembre » */
export function shortDate(key: string): string {
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** « septembre 2026 » */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** Regroupe des éléments (déjà triés) par clé, en conservant l'ordre. */
export function groupBy<T>(items: T[], keyOf: (item: T) => string): { key: string; items: T[] }[] {
  const groups: { key: string; items: T[] }[] = [];
  for (const item of items) {
    const key = keyOf(item);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

/** « il y a 5 min », « aujourd'hui à 14:02 », « 12 sept. 2026 à 09:15 » */
export function formatDateTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const key = toDateKey(d);
  if (key === todayKey(now)) return `aujourd'hui à ${time}`;
  return `${dayLabel(key, now)} à ${time}`.replace(/^Hier/, "hier");
}
