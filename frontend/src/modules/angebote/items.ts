// Positionen nach Bereich gruppieren: "Wohnzimmer – Wände streichen" → Bereich "Wohnzimmer", Leistung "Wände streichen"
export type ItemLike = { id: number; title: string; line_total: number | null; sort_order: number | null };

export const SEP = " – ";

export function splitTitle(title: string): { room: string | null; service: string } {
  const i = title.indexOf("–");
  if (i <= 0) return { room: null, service: title.trim() };
  const room = title.slice(0, i).trim();
  const service = title.slice(i + 1).trim();
  if (!room || !service) return { room: null, service: title.trim() };
  return { room, service };
}

export function joinTitle(room: string | null, service: string): string {
  return room ? `${room}${SEP}${service.trim()}` : service.trim();
}

export function groupItems<T extends ItemLike>(items: T[]): { room: string; items: T[]; total: number }[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const room = splitTitle(it.title).room || "Sonstige Leistungen";
    if (!groups.has(room)) groups.set(room, []);
    groups.get(room)!.push(it);
  }
  return [...groups.entries()].map(([room, list]) => ({
    room,
    items: list,
    total: list.reduce((s, x) => s + Number(x.line_total || 0), 0),
  }));
}

/** Kommazahl erlauben ("12,5"). Leer/ungültig → null. */
export function parseNum(v: string): number | null {
  const s = v.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function nextSortOrder(items: ItemLike[]): number {
  return items.length ? Math.max(...items.map((i) => Number(i.sort_order || 0))) + 1 : 1;
}
