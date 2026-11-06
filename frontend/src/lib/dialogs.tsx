// Eigene Dialoge statt der Browser-Fenster (alert / confirm / prompt).
// Aufruf wie gewohnt, nur mit await:
//   await showAlert("Gespeichert.");
//   if (!(await showConfirm("Wirklich löschen?", { danger: true, confirmLabel: "Löschen" }))) return;
//   const wert = await showPrompt("Lohnanteil in %", { defaultValue: "70", suffix: "%" });
// Der Dialog wird beim ersten Aufruf automatisch eingehängt – kein Einbau in die Seiten nötig.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import "./dialogs.css";

type Base = { title?: string; tone?: "info" | "success" | "warning" | "error" };
export type AlertOptions = Base & { okLabel?: string };
export type ConfirmOptions = Base & { confirmLabel?: string; cancelLabel?: string; danger?: boolean };
export type PromptOptions = Base & {
  defaultValue?: string;
  placeholder?: string;
  suffix?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email";
  multiline?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Fehlermeldung zurückgeben, wenn die Eingabe nicht passt – dann bleibt der Dialog offen */
  validate?: (value: string) => string | null;
};

type Entry =
  | { id: number; kind: "alert"; message: string; opts: AlertOptions; resolve: (v: void) => void }
  | { id: number; kind: "confirm"; message: string; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: "prompt"; message: string; opts: PromptOptions; resolve: (v: string | null) => void };

let queue: Entry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => queue[0] ?? null;

let mounted = false;
function ensureHost() {
  if (mounted || typeof document === "undefined") return;
  mounted = true;
  const el = document.createElement("div");
  el.id = "app-dialog-root";
  document.body.appendChild(el);
  createRoot(el).render(<DialogHost />);
}

function push(e: Omit<Entry, "id">) {
  ensureHost();
  queue = [...queue, { ...(e as Entry), id: nextId++ }];
  emit();
}
function close(id: number) {
  queue = queue.filter((q) => q.id !== id);
  emit();
}

export function showAlert(message: string, opts: AlertOptions = {}): Promise<void> {
  return new Promise((resolve) => push({ kind: "alert", message, opts, resolve } as Omit<Entry, "id">));
}
export function showConfirm(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => push({ kind: "confirm", message, opts, resolve } as Omit<Entry, "id">));
}
export function showPrompt(message: string, opts: PromptOptions = {}): Promise<string | null> {
  return new Promise((resolve) => push({ kind: "prompt", message, opts, resolve } as Omit<Entry, "id">));
}

const TITLES = { alert: "Hinweis", confirm: "Bitte bestätigen", prompt: "Eingabe" };
const ICONS = { info: "i", success: "✓", warning: "!", error: "!" };

function DialogHost() {
  const entry = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!entry) return null;
  return <Dialog key={entry.id} entry={entry} />;
}

function Dialog({ entry }: { entry: Entry }) {
  const [value, setValue] = useState(entry.kind === "prompt" ? entry.opts.defaultValue ?? "" : "");
  const [error, setError] = useState<string | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const tone = entry.opts.tone ?? (entry.kind === "confirm" && (entry.opts as ConfirmOptions).danger ? "warning" : "info");

  const cancel = () => {
    close(entry.id);
    if (entry.kind === "alert") entry.resolve();
    else if (entry.kind === "confirm") entry.resolve(false);
    else entry.resolve(null);
  };
  const ok = () => {
    if (entry.kind === "prompt") {
      const problem = entry.opts.validate?.(value) ?? null;
      if (problem) {
        setError(problem);
        inputRef.current?.focus();
        return;
      }
      close(entry.id);
      entry.resolve(value);
      return;
    }
    close(entry.id);
    if (entry.kind === "alert") entry.resolve();
    else entry.resolve(true);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (entry.kind === "prompt") {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else okRef.current?.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const o = entry.opts as ConfirmOptions & PromptOptions & AlertOptions;
  const okLabel = entry.kind === "alert" ? o.okLabel ?? "OK" : o.confirmLabel ?? "OK";
  const cancelLabel = o.cancelLabel ?? "Abbrechen";

  return (
    <div className="ad-backdrop" onMouseDown={(e) => e.target === e.currentTarget && entry.kind !== "prompt" && cancel()}>
      <div className={`ad-dialog ad-${tone}`} role={entry.kind === "alert" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={`ad-title-${entry.id}`}>
        <div className="ad-head">
          <span className="ad-icon" aria-hidden="true">
            {ICONS[tone]}
          </span>
          <h2 id={`ad-title-${entry.id}`}>{entry.opts.title ?? TITLES[entry.kind]}</h2>
        </div>
        <div className="ad-body">
          <p className="ad-message">{entry.message}</p>
          {entry.kind === "prompt" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ok();
              }}
            >
              <div className="ad-input">
                {o.multiline ? (
                  <textarea
                    ref={inputRef}
                    value={value}
                    placeholder={o.placeholder}
                    rows={4}
                    onChange={(e) => {
                      setValue(e.target.value);
                      setError(null);
                    }}
                  />
                ) : (
                  <input
                    ref={inputRef}
                    type={o.inputMode === "email" ? "email" : "text"}
                    inputMode={o.inputMode === "email" ? "email" : o.inputMode}
                    value={value}
                    placeholder={o.placeholder}
                    onChange={(e) => {
                      setValue(e.target.value);
                      setError(null);
                    }}
                  />
                )}
                {o.suffix && <span className="ad-suffix">{o.suffix}</span>}
              </div>
              {error && <p className="ad-error">{error}</p>}
            </form>
          )}
        </div>
        <div className="ad-foot">
          {entry.kind !== "alert" && (
            <button type="button" className="btn btn-secondary" onClick={cancel}>
              {cancelLabel}
            </button>
          )}
          <button ref={okRef} type="button" className={`btn ${o.danger ? "ad-danger" : "btn-primary"}`} onClick={ok}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
