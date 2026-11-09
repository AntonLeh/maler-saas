// Vorlagen für Briefe und E-Mails – mit KI-Entwurf
import { useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import type { Template } from "./logic";

type Props = { templates: Template[]; onChange: (list: Template[]) => void; onClose: () => void };

const GOALS: [string, string][] = [
  ["vorstellen", "Maler-SaaS vorstellen"],
  ["vortrag", "Vortrag / Vorführung bei einer Versammlung anbieten"],
  ["kooperation", "Kooperation / Mitgliedervorteil vorschlagen"],
  ["nachfassen", "Freundlich nachfassen"],
  ["infos", "Angefragte Informationen senden"],
];

export default function TemplateManager({ templates, onChange, onClose }: Props) {
  const [sel, setSel] = useState<Template | null>(templates[0] ?? null);
  const [draft, setDraft] = useState<Partial<Template>>(templates[0] ?? { kind: "brief", name: "", subject: "", body: "" });
  const [ai, setAi] = useState({ goal: "vorstellen", target: "Maler- und Lackiererinnungen", offer: "", notes: "" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const pick = (t: Template | null) => {
    setSel(t);
    setDraft(t ?? { kind: "brief", name: "", subject: "", body: "" });
    setMsg(null);
  };

  const save = async () => {
    if (!draft.name?.trim()) return setMsg({ text: "Bitte einen Namen für die Vorlage eintragen.", ok: false });
    setBusy("save");
    try {
      const t = await api.saveTemplate(sel?.id ?? null, { kind: draft.kind, name: draft.name.trim(), subject: draft.subject ?? "", body: draft.body ?? "" });
      const list = sel ? templates.map((x) => (x.id === t.id ? t : x)) : [...templates, t];
      onChange(list);
      setSel(t);
      setMsg({ text: "Vorlage gespeichert.", ok: true });
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!sel || !(await showConfirm(`Vorlage „${sel.name}“ löschen?`, { danger: true, confirmLabel: "Löschen" }))) return;
    await api.deleteTemplate(sel.id);
    const list = templates.filter((x) => x.id !== sel.id);
    onChange(list);
    pick(list[0] ?? null);
  };

  const generate = async () => {
    setBusy("ai");
    setMsg(null);
    try {
      const r = await api.aiDraft({ kind: (draft.kind ?? "brief") as "brief" | "email", goal: ai.goal, target: ai.target, offer: ai.offer, notes: ai.notes });
      setDraft((d) => ({ ...d, subject: r.subject, body: r.body, name: d.name || GOALS.find((g) => g[0] === ai.goal)?.[1] || "Entwurf" }));
      setMsg({ text: "Entwurf eingesetzt – bitte lesen, anpassen und speichern.", ok: true });
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="ok-panel">
      <div className="ok-panel-head">
        <h3>Vorlagen</h3>
        <div className="ok-row-actions">
          <button type="button" className="btn btn-secondary" onClick={() => pick(null)}>
            + Neue Vorlage
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
      <div className="ok-tpl">
        <ul className="ok-tpl-list">
          {templates.map((t) => (
            <li key={t.id}>
              <button type="button" className={sel?.id === t.id ? "on" : ""} onClick={() => pick(t)}>
                <small>{t.kind === "brief" ? "📄 Brief" : "✉️ E-Mail"}</small>
                {t.name}
              </button>
            </li>
          ))}
        </ul>
        <div>
          {msg && <p className={`ok-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
          <div className="ok-grid">
            <div className="ok-field">
              <label>Art</label>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Template["kind"] })}>
                <option value="brief">Brief (Post)</option>
                <option value="email">E-Mail (nur mit Grundlage)</option>
              </select>
            </div>
            <div className="ok-field">
              <label>Name der Vorlage</label>
              <input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="ok-field full">
              <label>Betreff</label>
              <input value={draft.subject ?? ""} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
            <div className="ok-field full">
              <label>Text</label>
              <textarea rows={14} value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              <small>Platzhalter: {"{anrede}"} · {"{organisation}"} · {"{region}"} · {"{stadt}"} · {"{ansprechpartner}"}</small>
            </div>
          </div>
          <div className="ok-row-actions">
            {sel && (
              <button type="button" className="btn btn-secondary" onClick={remove}>
                Löschen
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy === "save"}>
              {busy === "save" ? "Speichert …" : "Vorlage speichern"}
            </button>
          </div>

          <div className="ok-box">
            <h4>✨ Entwurf mit KI</h4>
            <div className="ok-grid">
              <div className="ok-field">
                <label>Ziel</label>
                <select value={ai.goal} onChange={(e) => setAi({ ...ai, goal: e.target.value })}>
                  {GOALS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ok-field">
                <label>Empfänger</label>
                <input value={ai.target} onChange={(e) => setAi({ ...ai, target: e.target.value })} />
              </div>
              <div className="ok-field">
                <label>Angebot (optional)</label>
                <input value={ai.offer} onChange={(e) => setAi({ ...ai, offer: e.target.value })} placeholder="z. B. 3 Monate kostenlos für Mitglieder" />
              </div>
              <div className="ok-field">
                <label>Hinweise (optional)</label>
                <input value={ai.notes} onChange={(e) => setAi({ ...ai, notes: e.target.value })} placeholder="z. B. kurz halten, Vortrag 20 Minuten" />
              </div>
            </div>
            <button type="button" className="btn btn-secondary" onClick={generate} disabled={busy === "ai"}>
              {busy === "ai" ? "Schreibt …" : `Entwurf für ${draft.kind === "email" ? "E-Mail" : "Brief"} erstellen`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
