// Auftragsliste: Status-Gruppen, Hinweise, Sortierung, Kürzel
export type ListOrder = {
  id: string | number;
  title: string;
  description?: string | null;
  status: string;
  customer_id: string | number;
  address_street?: string | null;
  address_zip?: string | null;
  address_city?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};
export type ListAssignment = { order_id: string | number; user_id: number; assignment_role: string };

export type Tab = "aktiv" | "neu" | "arbeit" | "pruefung" | "fertig" | "abgerechnet" | "alle";
export const TABS: { key: Tab; label: string }[] = [
  { key: "aktiv", label: "Aktiv" },
  { key: "neu", label: "Neu / geplant" },
  { key: "arbeit", label: "In Arbeit" },
  { key: "pruefung", label: "Zur Prüfung" },
  { key: "fertig", label: "Fertig" },
  { key: "abgerechnet", label: "Abgerechnet" },
  { key: "alle", label: "Alle" },
];

const DONE = new Set(["fertig", "abgerechnet", "storniert"]);
export const isDone = (s: string) => DONE.has(s);

export function inTab(o: ListOrder, t: Tab): boolean {
  switch (t) {
    case "aktiv":
      return !isDone(o.status);
    case "neu":
      return o.status === "neu" || o.status === "geplant";
    case "arbeit":
      return o.status === "in_arbeit" || o.status === "pausiert";
    case "pruefung":
      return o.status === "zur_pruefung";
    case "fertig":
      return o.status === "fertig";
    case "abgerechnet":
      return o.status === "abgerechnet";
    default:
      return true;
  }
}

/** Alte Filter-Modi (Dashboard-Kacheln) → Reiter */
export function tabFromMode(mode: string): Tab {
  return ({ open: "aktiv", new: "neu", review: "pruefung", finished: "fertig", billed: "abgerechnet", completed: "fertig" } as Record<string, Tab>)[mode] ?? "alle";
}

export const STATUS: Record<string, { label: string; cls: string }> = {
  neu: { label: "Neu", cls: "s-neu" },
  geplant: { label: "Geplant", cls: "s-geplant" },
  in_arbeit: { label: "In Arbeit", cls: "s-arbeit" },
  pausiert: { label: "Pausiert", cls: "s-pausiert" },
  zur_pruefung: { label: "Zur Prüfung", cls: "s-pruefung" },
  fertig: { label: "Fertig", cls: "s-fertig" },
  abgerechnet: { label: "Abgerechnet", cls: "s-abgerechnet" },
  storniert: { label: "Storniert", cls: "s-storniert" },
};
export const statusInfo = (s: string) => STATUS[s] ?? { label: (s || "–").replaceAll("_", " "), cls: "" };

export const todayIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (v?: string | null) => (v ? v.slice(0, 10) : "");

export type Flag = { key: "overdue" | "unassigned" | "no_material" | "review" | "today"; label: string };

export function flagsOf(o: ListOrder, team: ListAssignment[], materialOrderIds: string[] | null, today = todayIso()): Flag[] {
  const f: Flag[] = [];
  if (o.status === "zur_pruefung") f.push({ key: "review", label: "Wartet auf Freigabe" });
  if (isDone(o.status)) return f;
  if (o.status !== "zur_pruefung" && day(o.end_date) && day(o.end_date) < today) f.push({ key: "overdue", label: "Überfällig" });
  else if (day(o.start_date) === today) f.push({ key: "today", label: "Startet heute" });
  const workers = team.filter((a) => a.assignment_role === "employee");
  if (!workers.length) f.push({ key: "unassigned", label: "Niemand eingeteilt" });
  else if (materialOrderIds && !materialOrderIds.includes(String(o.id)) && o.status !== "zur_pruefung") f.push({ key: "no_material", label: "Kein Material" });
  return f;
}

export type Sort = "start" | "ende" | "kunde" | "neu";
export const SORTS: { key: Sort; label: string }[] = [
  { key: "start", label: "Start" },
  { key: "ende", label: "Ende" },
  { key: "kunde", label: "Kunde" },
  { key: "neu", label: "Zuletzt angelegt" },
];

export function sortOrders<T extends ListOrder>(list: T[], sort: Sort, customerName: (id: T["customer_id"]) => string): T[] {
  const byDate = (k: "start_date" | "end_date") => (a: T, b: T) => (day(a[k]) || "9999").localeCompare(day(b[k]) || "9999") || String(a.title).localeCompare(String(b.title), "de");
  const copy = [...list];
  if (sort === "start") return copy.sort(byDate("start_date"));
  if (sort === "ende") return copy.sort(byDate("end_date"));
  if (sort === "kunde") return copy.sort((a, b) => customerName(a.customer_id).localeCompare(customerName(b.customer_id), "de"));
  return copy.sort((a, b) => Number(b.id) - Number(a.id) || String(b.id).localeCompare(String(a.id)));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "")).toUpperCase();
}

export function matches(o: ListOrder, term: string, extra: string[]): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return [o.title, o.description, o.address_street, o.address_zip, o.address_city, statusInfo(o.status).label, ...extra].some((v) => String(v ?? "").toLowerCase().includes(t));
}

export const fmtDay = (v?: string | null) => (v ? new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–");
