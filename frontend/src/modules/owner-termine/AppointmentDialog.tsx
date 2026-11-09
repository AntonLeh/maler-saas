// Termin anlegen / bearbeiten
import { useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import * as L from "./logic";
import type { Appointment } from "./logic";
import "./ot.css";

type ContactOption = { id: number; organisation: string; city?: string | null };

type Props = {
  appt: Appointment | null;
  defaults?: { date?: Date; contactId?: number | null; title?: string; kind?: L.Kind };
  contacts: ContactOption[];
  onSaved: (a: Appointment) => void;
  onDeleted?: (id: number) => void;
  onClose: () => void;
};

export default function AppointmentDialog({ appt, defaults, contacts, onSaved, onDeleted, onClose }: Props) {
  const s0 = appt ? new Date(appt.starts_at) : defaults?.date ?? new Date(new Date().setHours(10, 0, 0, 0));
  const e0 = appt ? new Date(appt.ends_at) : new Date(s0.getTime() + 60 * 60000);
  const [title, setTitle] = useState(appt?.title ?? defaults?.title ?? "");
  const [kind, setKind] = useState<L.Kind>(appt?.kind ?? defaults?.kind ?? (defaults?.contactId ? "innung" : "sonstiges"));
  const [allDay, setAllDay] = useState(appt?.all_day ?? false);
  const [date, setDate] = useState(L.ymd(s0));
  const [from, setFrom] = useState(L.hm(s0));
  const [endDate, setEndDate] = useState(L.ymd(e0));
  const [to, setTo] = useState(L.hm(e0));
  const [location, setLocation] = useState(appt?.location ?? "");
  const [url, setUrl] = useState(appt?.url ?? "");
  const [notes, setNotes] = useState(appt?.notes ?? "");
  const [contactId, setContactId] = useState<number | "">(appt?.contact_id ?? defaults?.contactId ?? "");
  const [recur, setRecur] = useState<L.Recur>(appt?.recur ?? "none");
  const [until, setUntil] = useState(appt?.recur_until ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Beginn verschoben → Ende mitziehen (gleiche Dauer)
  const changeStart = (d: string, t: string) => {
    const oldS = L.parseLocal(date, from);
    const oldE = L.parseLocal(endDate, to);
    const dur = Math.max(0, oldE.getTime() - oldS.getTime());
    const ns = L.parseLocal(d, t);
    const ne = new Date(ns.getTime() + dur);
    setDate(d);
    setFrom(t);
    setEndDate(L.ymd(ne));
    setTo(L.hm(ne));
  };

  const save = async () => {
    if (!title.trim()) return setErr("Bitte einen Titel eintragen.");
    if (!date) return setErr("Bitte ein Datum wählen.");
    const s = allDay ? L.parseLocal(date, "00:00") : L.parseLocal(date, from);
    const e = allDay ? L.parseLocal(endDate || date, "00:00") : L.parseLocal(endDate || date, to);
    if (e < s) return setErr("Das Ende liegt vor dem Beginn.");
    if (recur !== "none" && until && until < date) return setErr("„Wiederholen bis“ liegt vor dem ersten Termin.");
    if (url && !/^https?:\/\//i.test(url.trim())) return setErr("Der Link muss mit https:// beginnen.");
    setBusy(true);
    setErr("");
    try {
      const a = await api.saveAppointment(appt?.id ?? null, {
        title: title.trim(),
        kind,
        all_day: allDay,
        starts_at: s.toISOString(),
        ends_at: e.toISOString(),
        location: location.trim() || null,
        url: url.trim() || null,
        notes: notes.trim() || null,
        contact_id: contactId === "" ? null : contactId,
        recur,
        recur_until: recur === "none" ? null : until || null,
      });
      onSaved(a);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!appt) return;
    const msg = appt.recur !== "none" ? `Die ganze Serie „${appt.title}“ löschen?` : `Termin „${appt.title}“ löschen?`;
    if (!(await showConfirm(msg, { danger: true, confirmLabel: "Löschen" }))) return;
    try {
      await api.deleteAppointment(appt.id);
      onDeleted?.(appt.id);
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  return (
    <div className="ot-dialog">
      <div className="ot-dialog-head">
        <h3>{appt ? "Termin bearbeiten" : "Neuer Termin"}</h3>
        <div className="ot-actions">
          {appt && (
            <button type="button" className="btn btn-secondary" onClick={remove}>
              Löschen
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </div>
      {err && <p className="ot-msg err">{err}</p>}
      {appt && appt.recur !== "none" && <p className="ot-small">Serie: Änderungen gelten für alle Termine dieser Serie.</p>}

      <div className="ot-grid">
        <div className="ot-field full">
          <label>Titel *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Vortrag Malerinnung München" autoFocus={!appt} />
        </div>
        <div className="ot-field full">
          <label>Art</label>
          <div className="ot-kinds">
            {(Object.keys(L.KINDS) as L.Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                className={kind === k ? "on" : ""}
                style={kind === k ? { background: L.KINDS[k].color, borderColor: L.KINDS[k].color } : { color: L.KINDS[k].color, borderColor: L.KINDS[k].bg }}
                onClick={() => setKind(k)}
              >
                {L.KINDS[k].label}
              </button>
            ))}
          </div>
        </div>
        <div className="ot-field">
          <label>Datum</label>
          <input type="date" value={date} onChange={(e) => changeStart(e.target.value, from)} />
        </div>
        {!allDay && (
          <div className="ot-field">
            <label>Von</label>
            <input type="time" value={from} onChange={(e) => changeStart(date, e.target.value)} />
          </div>
        )}
        {!allDay && (
          <div className="ot-field">
            <label>Bis</label>
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <div className="ot-field">
          <label>{allDay ? "Bis Datum" : "Ende am"}</label>
          <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <label className="ot-check">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> ganztägig
        </label>
        <div className="ot-field">
          <label>Ort</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Adresse oder „Telefon“" />
        </div>
        <div className="ot-field">
          <label>Online-Link</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/…" />
        </div>
        <div className="ot-field">
          <label>Kontakt</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">– keiner –</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.organisation}
                {c.city ? ` (${c.city})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="ot-field">
          <label>Wiederholen</label>
          <select value={recur} onChange={(e) => setRecur(e.target.value as L.Recur)}>
            {(Object.keys(L.RECUR_LABELS) as L.Recur[]).map((r) => (
              <option key={r} value={r}>
                {L.RECUR_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {recur !== "none" && (
          <div className="ot-field">
            <label>Wiederholen bis (optional)</label>
            <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
          </div>
        )}
        <div className="ot-field full">
          <label>Notiz</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
