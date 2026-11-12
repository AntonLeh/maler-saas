// Arbeitszeit korrigieren (nur Admin) – mit Begründung, alter Stand bleibt im Verlauf
import { useState } from "react";
import * as api from "./api";
import { fmtH, hm, nameOf, ymd } from "./logic";
import type { Entry, Person } from "./logic";
import "./st.css";

type Props = { entry: Entry; person: Person | undefined; orderTitle: string; onSaved: (msg: string) => void; onClose: () => void };

export default function CorrectionDialog({ entry, person, orderTitle, onSaved, onClose }: Props) {
  const s0 = new Date(entry.started_at!);
  const e0 = entry.ended_at ? new Date(entry.ended_at) : null;
  const [day, setDay] = useState(ymd(s0));
  const [from, setFrom] = useState(hm(entry.started_at!));
  const [to, setTo] = useState(e0 ? hm(entry.ended_at!) : "");
  const [pause, setPause] = useState(String(entry.total_break_minutes ?? 0));
  const [reason, setReason] = useState(e0 ? "" : "Ausstempeln vergessen");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const start = new Date(`${day}T${from || "00:00"}:00`);
  const end = new Date(`${day}T${to || "00:00"}:00`);
  if (to && end <= start) end.setDate(end.getDate() + 1);
  const net = to ? Math.max(0, (end.getTime() - start.getTime()) / 60000 - (Number(pause) || 0)) : 0;

  const save = async () => {
    if (!to) return setErr("Bitte das Ende eintragen.");
    if (reason.trim().length < 5) return setErr("Bitte kurz begründen, warum korrigiert wird.");
    setBusy(true);
    setErr("");
    try {
      await api.correctEntry(entry.id, start, end, Number(pause) || 0, reason.trim());
      onSaved(`Arbeitszeit von ${nameOf(person)} korrigiert (${fmtH(net)} Std.).`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-modal-bg" onClick={() => !busy && onClose()}>
      <div className="st-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>Arbeitszeit korrigieren</h3>
        <p className="st-small">
          {nameOf(person)} · {orderTitle}
          <br />
          Bisher: {s0.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} – {e0 ? e0.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "läuft noch"}, Pause {entry.total_break_minutes ?? 0} min
        </p>
        {err && <p className="st-msg err">{err}</p>}
        <div className="st-grid">
          <label className="st-field">
            <span>Datum</span>
            <input type="date" value={day} max={ymd(new Date())} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="st-field">
            <span>Pause (Minuten)</span>
            <input inputMode="numeric" value={pause} onChange={(e) => setPause(e.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="st-field">
            <span>Beginn</span>
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="st-field">
            <span>Ende</span>
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="st-field full">
            <span>Begründung * (bleibt im Verlauf)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z. B. laut Projektleiter um 16:30 Feierabend" />
          </label>
        </div>
        <p className="st-total">
          Neu: <b>{fmtH(net)} Std.</b> netto
        </p>
        <div className="st-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Speichert …" : "Korrektur speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
