// Owner: Aufgaben (To-dos) und Notizzettel
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Pin, Plus, StickyNote, Trash2 } from "lucide-react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import { NOTE_COLORS, categoriesOf, dueText, isDueToday, isOverdue, matchNote, sortNotes, sortTodos, todayIso } from "./logic";
import type { Note, NoteColor, Todo } from "./logic";
import "../bi/bi.css";
import "./oa.css";

type Tab = "todos" | "notes";
const COLOR_LABEL: Record<NoteColor, string> = { gelb: "Gelb", gruen: "Grün", blau: "Blau", rosa: "Rosa" };

export default function OwnerTasks({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (localStorage.getItem("owner-aufgaben-reiter") as Tab) === "notes" ? "notes" : "todos";
    } catch {
      return "todos";
    }
  });
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    Promise.all([api.loadTodos(), api.loadNotes()])
      .then(([t, n]) => {
        if (cancel) return;
        setTodos(t);
        setNotes(n);
      })
      .catch((e: Error) => !cancel && setErr(e.message));
    return () => {
      cancel = true;
    };
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem("owner-aufgaben-reiter", t);
    } catch {
      /* egal */
    }
  };
  const openCount = (todos ?? []).filter((t) => !t.done).length;

  return (
    <section className="single-page-section">
      <div className="bi2">
        <div className="bi2-top">
          <div>
            <h2>
              {tab === "todos" ? <CheckSquare size={24} aria-hidden="true" /> : <StickyNote size={24} aria-hidden="true" />} Aufgaben &amp; Notizen
            </h2>
            <p>Ihre persönliche Liste – nur Sie als Owner sehen sie.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Zurück
          </button>
        </div>

        <div className="bi2-periods" role="tablist" aria-label="Bereich">
          <button type="button" role="tab" aria-selected={tab === "todos"} className={tab === "todos" ? "on" : ""} onClick={() => choose("todos")}>
            To-dos{openCount > 0 && <span className="oa-count">{openCount}</span>}
          </button>
          <button type="button" role="tab" aria-selected={tab === "notes"} className={tab === "notes" ? "on" : ""} onClick={() => choose("notes")}>
            Notizzettel{notes && notes.length > 0 && <span className="oa-count">{notes.length}</span>}
          </button>
        </div>

        {err && <p className="bi2-msg">{err}</p>}
        {!err && (todos === null || notes === null) && <p className="bi2-muted">Lädt …</p>}
        {!err && todos && tab === "todos" && <Todos todos={todos} setTodos={(f) => setTodos((l) => f(l ?? []))} onError={setErr} />}
        {!err && notes && tab === "notes" && <Notes notes={notes} setNotes={(f) => setNotes((l) => f(l ?? []))} onError={setErr} />}
      </div>
    </section>
  );
}

// ---------------- To-dos ----------------
function Todos({ todos, setTodos, onError }: { todos: Todo[]; setTodos: (f: (t: Todo[]) => Todo[]) => void; onError: (m: string) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const today = todayIso();
  const cats = categoriesOf(todos);

  const shown = useMemo(() => sortTodos(todos.filter((t) => (!filter || t.category === filter) && (showDone || !t.done))), [todos, filter, showDone]);
  const doneCount = todos.filter((t) => t.done).length;

  const run = async <T,>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      onError((e as Error).message);
    }
  };
  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const t = await run(() => api.addTodo({ title: title.trim(), category: category.trim() || null, due_date: due || null }));
    setBusy(false);
    if (t) {
      setTodos((l) => [...l, t]);
      setTitle("");
      setDue("");
    }
  };
  const patch = async (id: number, p: Partial<Pick<Todo, "title" | "category" | "due_date" | "done">>) => {
    setTodos((l) => l.map((t) => (t.id === id ? { ...t, ...p, done_at: "done" in p ? (p.done ? new Date().toISOString() : null) : t.done_at } : t)));
    const saved = await run(() => api.updateTodo(id, p));
    if (saved) setTodos((l) => l.map((t) => (t.id === id ? saved : t)));
  };
  const remove = async (t: Todo) => {
    if (!(await showConfirm(`„${t.title}“ löschen?`, { danger: true, confirmLabel: "Löschen" }))) return;
    setTodos((l) => l.filter((x) => x.id !== t.id));
    await run(() => api.deleteTodo(t.id));
  };
  const clearDone = async () => {
    if (!(await showConfirm(`${doneCount} erledigte Aufgabe${doneCount === 1 ? "" : "n"} endgültig löschen?`, { danger: true, confirmLabel: "Löschen" }))) return;
    setTodos((l) => l.filter((x) => !x.done));
    await run(() => api.deleteDoneTodos());
  };

  return (
    <section className="bi2-card">
      <form
        className="oa-add"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input className="oa-add-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neue Aufgabe … (Enter)" aria-label="Neue Aufgabe" maxLength={300} />
        <input className="oa-add-cat" list="oa-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kategorie" aria-label="Kategorie" maxLength={40} />
        <datalist id="oa-cats">
          {cats.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input className="oa-add-date" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Fällig am" />
        <button type="submit" className="btn btn-primary oa-add-btn" disabled={!title.trim() || busy}>
          <Plus size={16} aria-hidden="true" /> Hinzufügen
        </button>
      </form>

      <div className="oa-filters">
        <button type="button" className={`oa-chip${filter === "" ? " on" : ""}`} onClick={() => setFilter("")}>
          Alle
        </button>
        {cats.map((c) => (
          <button key={c} type="button" className={`oa-chip${filter === c ? " on" : ""}`} onClick={() => setFilter(filter === c ? "" : c)}>
            {c} <small>{todos.filter((t) => t.category === c && !t.done).length}</small>
          </button>
        ))}
        <span className="oa-filters-right">
          <label className="bi2-check">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Erledigte zeigen ({doneCount})
          </label>
          {showDone && doneCount > 0 && (
            <button type="button" className="oa-link danger" onClick={clearDone}>
              Erledigte löschen
            </button>
          )}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="bi2-muted oa-empty">{todos.some((t) => !t.done) ? "In dieser Kategorie ist nichts offen." : "✓ Alles erledigt – oder tragen Sie oben eine neue Aufgabe ein."}</p>
      ) : (
        <ul className="oa-list">
          {shown.map((t) => (
            <li key={t.id} className={`${t.done ? "done" : ""}${isOverdue(t, today) ? " late" : ""}`}>
              <input type="checkbox" className="oa-check" checked={t.done} onChange={(e) => patch(t.id, { done: e.target.checked })} aria-label={`${t.title} erledigt`} />
              <div className="oa-main">
                {editing === t.id ? (
                  <EditTodo todo={t} cats={cats} onCancel={() => setEditing(null)} onSave={(p) => (setEditing(null), patch(t.id, p))} />
                ) : (
                  <button type="button" className="oa-title" onClick={() => !t.done && setEditing(t.id)} title={t.done ? undefined : "Zum Bearbeiten klicken"}>
                    {t.title}
                  </button>
                )}
                {editing !== t.id && (t.category || t.due_date) && (
                  <span className="oa-meta">
                    {t.category && <span className="oa-tag">{t.category}</span>}
                    {t.due_date && (
                      <span className={`oa-due${isOverdue(t, today) ? " late" : isDueToday(t, today) ? " today" : ""}`}>
                        {isOverdue(t, today) ? "überfällig · " : "fällig "}
                        {dueText(t.due_date, today)}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <button type="button" className="oa-icon" aria-label="Löschen" title="Löschen" onClick={() => remove(t)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditTodo({ todo, cats, onSave, onCancel }: { todo: Todo; cats: string[]; onSave: (p: { title: string; category: string | null; due_date: string | null }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(todo.title);
  const [cat, setCat] = useState(todo.category ?? "");
  const [due, setDue] = useState(todo.due_date ?? "");
  const save = () => title.trim() && onSave({ title: title.trim(), category: cat.trim() || null, due_date: due || null });
  return (
    <form
      className="oa-edit"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Aufgabe" maxLength={300} />
      <input list="oa-cats-edit" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Kategorie" aria-label="Kategorie" maxLength={40} />
      <datalist id="oa-cats-edit">
        {cats.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Fällig am" />
      <button type="submit" className="btn btn-primary">
        Speichern
      </button>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Abbrechen
      </button>
    </form>
  );
}

// ---------------- Notizzettel ----------------
function Notes({ notes, setNotes, onError }: { notes: Note[]; setNotes: (f: (n: Note[]) => Note[]) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [fresh, setFresh] = useState<number | null>(null);
  const shown = useMemo(() => sortNotes(notes.filter((n) => matchNote(n, q))), [notes, q]);

  const add = async () => {
    try {
      const n = await api.addNote();
      setNotes((l) => [...l, n]);
      setQ("");
      setFresh(n.id);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <section className="bi2-card">
      <div className="bi2-tablebar">
        <button type="button" className="btn btn-primary oa-add-btn" onClick={add}>
          <Plus size={16} aria-hidden="true" /> Neuer Zettel
        </button>
        <input type="search" className="oa-search" placeholder="Notizen durchsuchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Notizen durchsuchen" />
      </div>
      {shown.length === 0 ? (
        <p className="bi2-muted oa-empty">{q ? "Keine Notiz gefunden." : "Noch keine Notizen. Mit „Neuer Zettel“ legen Sie die erste an."}</p>
      ) : (
        <div className="oa-notes">
          {shown.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              autoFocus={fresh === n.id}
              onChange={(saved) => setNotes((l) => l.map((x) => (x.id === saved.id ? saved : x)))}
              onDelete={() => setNotes((l) => l.filter((x) => x.id !== n.id))}
              onError={onError}
            />
          ))}
        </div>
      )}
      <p className="bi2-small">Notizen werden beim Tippen automatisch gespeichert. 📌 hält einen Zettel oben.</p>
    </section>
  );
}

function NoteCard({ note, autoFocus, onChange, onDelete, onError }: { note: Note; autoFocus: boolean; onChange: (n: Note) => void; onDelete: () => void; onError: (m: string) => void }) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [state, setState] = useState<"" | "saving" | "saved">("");
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ title: note.title, body: note.body });

  const save = async (p: Partial<Pick<Note, "title" | "body" | "color" | "pinned">>) => {
    setState("saving");
    try {
      const saved = await api.updateNote(note.id, p);
      onChange({ ...saved, title: latest.current.title, body: latest.current.body });
      setState("saved");
    } catch (e) {
      setState("");
      onError((e as Error).message);
    }
  };
  // beim Tippen: 0,7 s nach der letzten Eingabe speichern
  const type = (t: string, b: string) => {
    latest.current = { title: t, body: b };
    setTitle(t);
    setBody(b);
    setState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save({ title: t, body: b }), 700);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const remove = async () => {
    if ((title.trim() || body.trim()) && !(await showConfirm("Diesen Zettel löschen?", { danger: true, confirmLabel: "Löschen" }))) return;
    window.clearTimeout(timer.current);
    onDelete();
    try {
      await api.deleteNote(note.id);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <article className={`oa-note ${note.color}${note.pinned ? " pinned" : ""}`}>
      <div className="oa-note-top">
        <input className="oa-note-title" value={title} onChange={(e) => type(e.target.value, body)} placeholder="Titel" aria-label="Titel" maxLength={200} autoFocus={autoFocus} />
        <button type="button" className={`oa-icon${note.pinned ? " on" : ""}`} aria-pressed={note.pinned} aria-label={note.pinned ? "Nicht mehr anheften" : "Anheften"} title={note.pinned ? "Nicht mehr anheften" : "Anheften"} onClick={() => save({ pinned: !note.pinned })}>
          <Pin size={16} />
        </button>
      </div>
      <textarea className="oa-note-body" value={body} onChange={(e) => type(title, e.target.value)} placeholder="Notiz …" aria-label="Notiz" rows={6} maxLength={20000} />
      <div className="oa-note-foot">
        <span className="oa-colors" role="radiogroup" aria-label="Farbe">
          {NOTE_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={note.color === c} aria-label={COLOR_LABEL[c]} title={COLOR_LABEL[c]} className={`oa-dot ${c}${note.color === c ? " on" : ""}`} onClick={() => save({ color: c })} />
          ))}
        </span>
        <span className="oa-note-state">{state === "saving" ? "speichert …" : state === "saved" ? "gespeichert" : new Date(note.updated_at).toLocaleDateString("de-DE")}</span>
        <button type="button" className="oa-icon" aria-label="Zettel löschen" title="Zettel löschen" onClick={remove}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
