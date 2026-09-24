import { describe, expect, it } from "vitest";
import { dayLabel, groupBy, isDateKey, longDate, monthLabel, toDateKey } from "@/lib/dates";

const now = new Date(2026, 8, 24, 15, 0); // 24 septembre 2026

describe("dates", () => {
  it("formate les clés de date en heure locale", () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
  it("valide les dates", () => {
    expect(isDateKey("2026-09-24")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("24/09/2026")).toBe(false);
  });
  it("donne des libellés relatifs", () => {
    expect(dayLabel("2026-09-24", now)).toBe("Aujourd'hui");
    expect(dayLabel("2026-09-23", now)).toBe("Hier");
    expect(dayLabel("2026-09-12", now)).toBe("12 septembre");
    expect(dayLabel("2025-08-30", now)).toBe("30 août 2025");
  });
  it("formate les dates longues et les mois", () => {
    expect(longDate("2026-09-24")).toBe("jeudi 24 septembre 2026");
    expect(monthLabel("2026-08")).toBe("août 2026");
  });
  it("regroupe en conservant l'ordre", () => {
    const g = groupBy(["2026-09-24", "2026-09-24", "2026-08-30"], (d) => d.slice(0, 7));
    expect(g.map((x) => [x.key, x.items.length])).toEqual([
      ["2026-09", 2],
      ["2026-08", 1],
    ]);
  });
});
