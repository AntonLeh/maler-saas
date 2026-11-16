// Owner-Aufgaben & Notizzettel: Sortierung und Hilfen (ohne React, testbar)

export type Todo = { id: number; title: string; category: string | null; due_date: string | null; done: boolean; done_at: string | null; created_at: string };
export type Note = { id: number; title: string; body: string; color: NoteColor; pinned: boolean; created_at: string; updated_at: string };
export type NoteColor = "gelb" | "gruen" | "blau" | "rosa";
export const NOTE_COLORS: NoteColor[] = ["gelb", "gruen", "blau", "rosa"];

export const todayIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const isOverdue = (t: Todo, today = todayIso()) => !t.done && !!t.due_date && t.due_date < today;
export const isDueToday = (t: Todo, today = todayIso()) => !t.done && t.due_date === today;
/** Zahl am Knopf: offene Aufgaben, die heute oder früher fällig sind */
export const dueCount = (todos: Todo[], today = todayIso()) => todos.filter((t) => !t.done && !!t.due_date && t.due_date <= today).length;

/** Offene zuerst: überfällig/fällig nach Datum, dann ohne Datum nach Anlage; erledigte zuletzt (neueste zuerst) */
export function sortTodos(list: Todo[]) {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return String(b.done_at ?? "").localeCompare(String(a.done_at ?? ""));
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date) || a.id - b.id;
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.id - b.id;
  });
}

export const categoriesOf = (todos: Todo[]) => [...new Set(todos.map((t) => t.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "de"));

export function sortNotes(list: Note[]) {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updated_at).localeCompare(String(a.updated_at)));
}

export const matchNote = (n: Note, q: string) => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${n.title} ${n.body}`.toLowerCase();
  return words.every((w) => hay.includes(w));
};

/** „heute“, „morgen“, „Fr, 20.11.“ */
export function dueText(iso: string, today = todayIso()) {
  const d = new Date(`${iso}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gestern";
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: d.getFullYear() !== t.getFullYear() ? "numeric" : undefined });
}
