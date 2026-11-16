// Owner-Aufgaben & Notizzettel: Datenbank (Tabellen owner_todos / owner_notes, nur Owner)
import { supabase } from "../../lib/supabase";
import type { Note, NoteColor, Todo } from "./logic";

export const NEEDS_SQL = "Für Aufgaben und Notizen fehlt noch das Datenbank-Update (SQL „Aufgaben & Notizen“).";
const fail = (e: { code?: string; message?: string } | null) => {
  if (!e) return;
  throw new Error(e.code === "42P01" || /owner_(todos|notes)/.test(e.message ?? "") ? NEEDS_SQL : "Das hat nicht geklappt. Bitte noch einmal versuchen.");
};

export async function loadTodos(): Promise<Todo[]> {
  const { data, error } = await supabase.from("owner_todos").select("*").order("id");
  fail(error);
  return (data ?? []) as Todo[];
}
export async function addTodo(t: { title: string; category: string | null; due_date: string | null }): Promise<Todo> {
  const { data, error } = await supabase.from("owner_todos").insert(t).select("*").single();
  fail(error);
  return data as Todo;
}
export async function updateTodo(id: number, patch: Partial<Pick<Todo, "title" | "category" | "due_date" | "done">>): Promise<Todo> {
  const p: Record<string, unknown> = { ...patch };
  if ("done" in patch) p.done_at = patch.done ? new Date().toISOString() : null;
  const { data, error } = await supabase.from("owner_todos").update(p).eq("id", id).select("*").single();
  fail(error);
  return data as Todo;
}
export async function deleteTodo(id: number) {
  const { error } = await supabase.from("owner_todos").delete().eq("id", id);
  fail(error);
}
export async function deleteDoneTodos() {
  const { error } = await supabase.from("owner_todos").delete().eq("done", true);
  fail(error);
}

export async function loadNotes(): Promise<Note[]> {
  const { data, error } = await supabase.from("owner_notes").select("*");
  fail(error);
  return (data ?? []) as Note[];
}
export async function addNote(color: NoteColor = "gelb"): Promise<Note> {
  const { data, error } = await supabase.from("owner_notes").insert({ title: "", body: "", color }).select("*").single();
  fail(error);
  return data as Note;
}
export async function updateNote(id: number, patch: Partial<Pick<Note, "title" | "body" | "color" | "pinned">>): Promise<Note> {
  const { data, error } = await supabase.from("owner_notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  fail(error);
  return data as Note;
}
export async function deleteNote(id: number) {
  const { error } = await supabase.from("owner_notes").delete().eq("id", id);
  fail(error);
}
