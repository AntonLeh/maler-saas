// Stunden nachtragen (Admin; Projektleiter für eigene Aufträge)
import { useMemo, useState } from "react";
import * as api from "./api";
import { EMPLOYMENT } from "../mitarbeiter-arten/logic";
import { fmtH, nameOf, typeOf, ymd } from "./logic";
import type { Person } from "./logic";
import "./st.css";

type Props = {
  people: Person[];
  orders: { id: number; title: string; city?: string | null }[];
  fixedOrderId?: number;
  defaultUserId?: number;
  onSaved: (message: string) => void;
  onClose: () => void;
};

export default function ManualTimeDialog({ people, orders, fixedOrderId, defaultUserId, onSaved, onClose }: Props) {
  const staff = useMemo(
    () =>
      people
        .filter((p) => (p.role_id === 3 || p.role_id === 4) && p.is_active !== false)
        // ohne App zuerst – für die ist das Nachtragen gedacht
        .sort((a, b) => Number(a.app_access !== false) - Number(b.app_access !== false) || nameOf(a).localeCompare(nameOf(b), "de")),
    [people]
  );
  const [userId, setUserId] = useState<number | "">(defaultUserId ?? "");
  const [orderId, setOrderId] = useState<number | "">(fixedOrderId ?? "");
  const [day, setDay] = useState(ymd(new Date()));
  const [from, setFrom] = useState("07:00");
  const [to, setTo] = useState("16:00");
  const [pause, setPause] = useState("30");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const start = new Date(`${day}T${from || "00:00"}:00`);
  const end = new Date(`${day}T${to || "00:00"}:00`);
  if (end <= start) end.setDate(end.getDate() + 1); // über Mitternacht
  const net = Math.max(0, (end.getTime() - start.getTime()) / 60000 - (Number(pause) || 0));

  const save = async () => {
    if (!userId) return setErr("Bitte eine Person wählen.");
    if (!orderId) return setErr("Bitte einen Auftrag wählen.");
    setBusy(true);
    setErr("");
    try {
      await api.addManualEntry({ userId: Number(userId), orderId: Number(orderId), start, end, breakMinutes: Number(pause) || 0, note });
      const p = staff.find((s) => s.id === userId);
      onSaved(`${fmtH(net)} Std. für ${nameOf(p)} am ${new Date(`${day}T12:00:00`).toLocaleDateString("de-DE")} nachgetragen.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-modal-bg" onClick={() => !busy && onClose()}>
      <div className="st-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>Stunden nachtragen</h3>
        <p className="st-small">Für Personen ohne App (z. B. Leiharbeiter, Subunternehmer) oder wenn jemand das Stoppen vergessen hat. Der Eintrag wird als „nachgetragen“ gekennzeichnet.</p>
        {err && <p className="st-msg err">{err}</p>}
        <div className="st-grid">
          <label className="st-field full">
            <span>Person</span>
            <select value={userId} onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Bitte wählen</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameOf(p)} – {EMPLOYMENT[typeOf(p)].short}
                  {p.app_access === false ? " (ohne App)" : ""}
                </option>
              ))}
            </select>
          </label>
          {!fixedOrderId && (
            <label className="st-field full">
              <span>Auftrag</span>
              <select value={orderId} onChange={(e) => setOrderId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Bitte wählen</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                    {o.city ? ` (${o.city})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="st-field">
            <span>Datum</span>
            <input type="date" value={day} max={ymd(new Date())} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="st-field">
            <span>Pause (Minuten)</span>
            <input inputMode="numeric" value={pause} onChange={(e) => setPause(e.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="st-field">
            <span>Von</span>
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="st-field">
            <span>Bis</span>
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="st-field full">
            <span>Notiz (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. laut Stundenzettel der Zeitarbeitsfirma" />
          </label>
        </div>
        <p className="st-total">
          Arbeitszeit: <b>{fmtH(net)} Std.</b> netto
        </p>
        <div className="st-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || net <= 0}>
            {busy ? "Speichert …" : "Stunden eintragen"}
          </button>
        </div>
      </div>
    </div>
  );
}
