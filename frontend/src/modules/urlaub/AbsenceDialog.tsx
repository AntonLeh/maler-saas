// Abwesenheit eintragen / ändern (nur Inhaber)
import { useState } from "react";
import * as api from "./api";
import { balance, countDays, DEFAULT_WEEKDAYS, deDate, EMPTY_LEAVE, fmtNum, KIND_ORDER, KINDS, overlaps, todayIso } from "./logic";
import { personName } from "./logic";
import type { Absence, AbsenceKind, Calendar, Leave, UPerson } from "./logic";
import "./ur.css";


type Props = {
  tenantId: number;
  currentUserId: number;
  people: UPerson[];
  absences: Absence[];
  leaves: Map<number, Leave>;
  cal: Calendar;
  edit?: Absence | null;
  presetUserId?: number | null;
  presetDate?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function AbsenceDialog({ tenantId, currentUserId, people, absences, leaves, cal, edit, presetUserId, presetDate, onClose, onSaved }: Props) {
  const [userId, setUserId] = useState<number | "">(edit?.user_id ?? presetUserId ?? (people.length === 1 ? people[0].id : ""));
  const [kind, setKind] = useState<AbsenceKind>(edit?.kind ?? "urlaub");
  const [from, setFrom] = useState(edit?.start_date ?? presetDate ?? todayIso());
  const [to, setTo] = useState(edit?.end_date ?? presetDate ?? todayIso());
  const [startHalf, setStartHalf] = useState(edit?.start_half ?? false);
  const [endHalf, setEndHalf] = useState(edit?.end_half ?? false);
  const [au, setAu] = useState(edit?.au_present ?? false);
  const [note, setNote] = useState(edit?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const person = people.find((p) => p.id === userId);
  const leave = userId ? leaves.get(Number(userId)) ?? EMPTY_LEAVE(Number(userId), tenantId) : null;
  const weekdays = leave?.work_weekdays?.length ? leave.work_weekdays : DEFAULT_WEEKDAYS;
  const single = from === to;
  const draft = { start_date: from, end_date: to < from ? from : to, start_half: startHalf, end_half: single ? startHalf : endHalf };
  const days = from && to && to >= from ? countDays(draft, weekdays, cal) : 0;
  const clash = userId ? absences.filter((a) => a.id !== edit?.id && Number(a.user_id) === Number(userId) && a.status !== "abgelehnt" && overlaps(a, from, to)) : [];
  const restAfter = (() => {
    if (kind !== "urlaub" || !leave?.vacation_days || !from) return null;
    const year = Number(from.slice(0, 4));
    const others = absences.filter((a) => a.id !== edit?.id);
    const fake: Absence = { id: -1, tenant_id: tenantId, user_id: Number(userId), kind, ...draft, au_present: false, note: null, status: "genehmigt" };
    return balance(leave, year, [...others, fake], cal, person?.exit_date).rest;
  })();

  const save = async () => {
    setError("");
    if (!userId) return setError("Bitte die Person wählen.");
    if (!from || !to || to < from) return setError("Bitte einen gültigen Zeitraum wählen (bis ≥ von).");
    if (days === 0) return setError("Im gewählten Zeitraum liegt kein Arbeitstag (Wochenende/Feiertag).");
    setBusy(true);
    try {
      const v = { tenant_id: tenantId, user_id: Number(userId), kind, ...draft, au_present: kind === "krank" || kind === "kind_krank" ? au : false, note };
      if (edit) await api.updateAbsence(edit.id, v);
      else await api.addAbsence(v, currentUserId);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="ur-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ur-dialog">
        <h3>{edit ? "Abwesenheit ändern" : "Abwesenheit eintragen"}</h3>

        <label className="ur-field">
          <span>Person</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")} disabled={!!edit}>
            <option value="">Bitte wählen</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {personName(p)}
              </option>
            ))}
          </select>
        </label>

        <div className="ur-field">
          <span>Art</span>
          <div className="ur-kinds">
            {KIND_ORDER.map((k) => (
              <button key={k} type="button" className={kind === k ? "on" : ""} style={kind === k ? { background: KINDS[k].bg, borderColor: KINDS[k].color, color: KINDS[k].color } : undefined} onClick={() => setKind(k)}>
                {KINDS[k].icon} {KINDS[k].label}
              </button>
            ))}
          </div>
          {KINDS[kind].hint && <small className="ur-small">{KINDS[kind].hint}</small>}
        </div>

        <div className="ur-grid">
          <label className="ur-field">
            <span>Von</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (!to || to < e.target.value) setTo(e.target.value);
              }}
            />
          </label>
          <label className="ur-field">
            <span>Bis</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="ur-checks">
          <label>
            <input type="checkbox" checked={startHalf} onChange={(e) => setStartHalf(e.target.checked)} /> {single ? "nur halber Tag" : "erster Tag nur halb"}
          </label>
          {!single && (
            <label>
              <input type="checkbox" checked={endHalf} onChange={(e) => setEndHalf(e.target.checked)} /> letzter Tag nur halb
            </label>
          )}
          {(kind === "krank" || kind === "kind_krank") && (
            <label>
              <input type="checkbox" checked={au} onChange={(e) => setAu(e.target.checked)} /> AU-Bescheinigung liegt vor
            </label>
          )}
        </div>

        <label className="ur-field">
          <span>Notiz (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "sonderurlaub" ? "z. B. Hochzeit" : ""} />
        </label>

        <div className="ur-sum">
          <b>{fmtNum(days)}</b> {days === 1 ? "Arbeitstag" : "Arbeitstage"}{from && to >= from ? ` (${deDate(from)}${single ? "" : ` – ${deDate(to)}`})` : ""}
          <small>Wochenenden, freie Tage der Person und Feiertage zählen nicht mit.</small>
          {restAfter != null && <small className={restAfter < 0 ? "ur-neg" : ""}>Resturlaub {from.slice(0, 4)} danach: {fmtNum(restAfter)} Tage{restAfter < 0 ? " – mehr als der Anspruch!" : ""}</small>}
          {kind === "urlaub" && userId && !leave?.vacation_days && <small>Für diese Person ist noch kein Urlaubsanspruch eingetragen (Mitarbeiter → Bearbeiten → Urlaub).</small>}
        </div>

        {clash.length > 0 && (
          <p className="ur-msg warn">
            Überschneidet sich mit: {clash.map((a) => `${KINDS[a.kind].short} ${deDate(a.start_date)}–${deDate(a.end_date)}`).join(", ")}
          </p>
        )}
        {error && <p className="ur-msg err">{error}</p>}

        <div className="ur-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
