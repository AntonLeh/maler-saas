// Aufmaß: Zahlen lesen und Flächen berechnen – genau wie die Angebotsfunktion in der Datenbank
// (generate_quote_from_site_visit): Wand = manuelle Fläche ODER 2 × (Länge + Breite) × Höhe
// abzüglich Öffnungen (Fenster/Türen) über 2,5 m² je Stück (VOB/C, DIN 18363); Decke = Länge × Breite.

import type { SiteVisitFormState, SiteVisitRoomForm } from "./types";

/** VOB/C: Öffnungen bis 2,5 m² werden übermessen (nicht abgezogen) */
export const OPENING_LIMIT_SQM = 2.5;

/** „3,45“, „3.45“, „ 3,45 m“ → 3.45; leer/ungültig → null */
export function toNum(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/\s|m²|m2|m\b/gi, "");
  if (!s) return null;
  // Tausenderpunkt + Dezimalkomma (1.234,5) → 1234.5
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const fmt = (n: number | null | undefined, digits = 2) =>
  n == null ? "–" : n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits });

export type Opening = { kind: "Fenster" | "Tür"; count: number; area: number; deducted: boolean };

export type RoomCalc = {
  floor: number | null;
  wallGross: number | null;
  deduction: number;
  wall: number | null;
  manual: boolean;
  ceiling: number;
  openings: Opening[];
  windows: number;
  doors: number;
  radiators: number;
  missing: string[];
};

export function calcRoom(room: SiteVisitRoomForm, form: Pick<SiteVisitFormState, "windows" | "doors" | "radiators">): RoomCalc {
  const L = toNum(room.length_m);
  const W = toNum(room.width_m);
  const H = toNum(room.height_m);
  const manual = toNum(room.manual_wall_area_sqm);
  const mine = <T extends { room_temp_id: number | null }>(list: T[]) => list.filter((x) => String(x.room_temp_id) === String(room.temp_id));
  const cnt = (s: string) => Math.max(0, Math.round(toNum(s) ?? 1));

  const openings: Opening[] = [];
  for (const w of mine(form.windows)) {
    const a = (toNum(w.width_m) ?? 0) * (toNum(w.height_m) ?? 0);
    openings.push({ kind: "Fenster", count: cnt(w.count_items), area: a, deducted: a > OPENING_LIMIT_SQM });
  }
  for (const d of mine(form.doors)) {
    const a = (toNum(d.width_m) ?? 0) * (toNum(d.height_m) ?? 0);
    openings.push({ kind: "Tür", count: cnt(d.count_items), area: a, deducted: a > OPENING_LIMIT_SQM });
  }
  const deduction = round2(openings.filter((o) => o.deducted).reduce((s, o) => s + o.count * o.area, 0));

  const floor = L != null && W != null ? round2(L * W) : null;
  const wallGross = L != null && W != null && H != null ? round2(2 * (L + W) * H) : null;
  const wall = manual != null ? round2(manual) : wallGross != null ? round2(Math.max(0, wallGross - deduction)) : null;
  const ceiling = room.paint_ceiling && floor != null ? floor : 0;

  const missing: string[] = [];
  if (manual == null) {
    if (L == null) missing.push("Länge");
    if (W == null) missing.push("Breite");
    if (H == null) missing.push("Höhe");
  }
  const sum = (list: { count_items: string }[]) => list.reduce((s, x) => s + cnt(x.count_items), 0);

  return {
    floor,
    wallGross,
    deduction: manual != null ? 0 : deduction,
    wall,
    manual: manual != null,
    ceiling,
    openings,
    windows: sum(mine(form.windows)),
    doors: sum(mine(form.doors)),
    radiators: sum(mine(form.radiators)),
    missing,
  };
}

export function calcTotals(form: SiteVisitFormState) {
  const rooms = form.rooms.map((r) => ({ room: r, c: calcRoom(r, form) }));
  const add = (k: "wall" | "ceiling" | "floor") => round2(rooms.reduce((s, x) => s + (x.c[k] ?? 0), 0));
  return {
    rooms,
    wall: add("wall"),
    ceiling: add("ceiling"),
    floor: add("floor"),
    windows: rooms.reduce((s, x) => s + x.c.windows, 0),
    doors: rooms.reduce((s, x) => s + x.c.doors, 0),
    radiators: rooms.reduce((s, x) => s + x.c.radiators, 0),
    hours: round2(form.custom_services.reduce((s, x) => s + (toNum(x.hours) ?? 0), 0)),
  };
}

/** Bezeichnung für Bereiche ohne Namen (statt sie beim Speichern wegzulassen) */
export const roomLabel = (room: SiteVisitRoomForm, index: number) => room.room_name.trim() || `Bereich ${index + 1}`;
