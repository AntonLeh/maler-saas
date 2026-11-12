// Mitarbeiter-App / Projektleiter: Mein Urlaub – Resturlaub, Anträge stellen und zurückziehen
import { useCallback, useEffect, useState } from "react";
import * as api from "./api";
import type { MyLeave } from "./api";
import { addDays, balance, countDays, deDate, deShort, fmtNum, KINDS, REQUEST_KINDS, STATUS_LABEL, todayIso } from "./logic";
import type { Absence, AbsenceKind } from "./logic";
import "./ur.css";

type Props = { userId: number; className?: string };

export default function MyLeaveCard({ userId, className = "" }: Props) {
  const [me, setMe] = useState<MyLeave | null | undefined>(undefined);
  const [list, setList] = useState<Absence[]>([]);
  const [form, setForm] = useState(false);
  const [kind, setKind] = useState<AbsenceKind>("urlaub");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [startHalf, setStartHalf] = useState(false);
  const [endHalf, setEndHalf] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchAll = useCallback(() => Promise.all([api.loadMyLeave(userId), api.loadMyAbsences(userId)]), [userId]);
  useEffect(() => {
    let cancel = false;
    void fetchAll().then(([m, l]) => {
      if (cancel) return;
      setMe(m);
      setList(l);
    });
    return () => {
      cancel = true;
    };
  }, [fetchAll]);
  const reload = async () => {
    const [m, l] = await fetchAll();
    setMe(m);
    setList(l);
  };

  if (!me || ["leiharbeit", "sub"].includes(String(me.employmentType ?? ""))) return null;

  const year = new Date().getFullYear();
  const today = todayIso();
  const bal = balance(me.leave, year, list, me.cal, me.exitDate, today);
  const hasEntitlement = !!me.leave.vacation_days;
  const single = from === to;
  const draft = { start_date: from, end_date: to, start_half: startHalf, end_half: single ? startHalf : endHalf };
  const days = from && to && to >= from ? countDays(draft, me.leave.work_weekdays, me.cal) : 0;
  const pendingDays = list
    .filter((a) => a.status === "beantragt" && a.kind === "urlaub")
    .reduce((s, a) => s + countDays(a, me.leave.work_weekdays, me.cal, `${year}-01-01`, `${year}-12-31`), 0);
  const visible = list.filter((a) => a.end_date >= addDays(today, -60) && (a.status !== "abgelehnt" || a.end_date >= today)).sort((a, b) => a.start_date.localeCompare(b.start_date));

  const submit = async () => {
    setMsg(null);
    if (!from || !to || to < from) return setMsg({ ok: false, text: "Bitte Von und Bis wählen." });
    if (days === 0) return setMsg({ ok: false, text: "Im Zeitraum liegt kein Arbeitstag (Wochenende/Feiertag)." });
    setBusy(true);
    try {
      await api.requestAbsence({ kind, start: from, end: to, startHalf, endHalf: single ? startHalf : endHalf, note });
      setForm(false);
      setFrom(""); setTo(""); setNote(""); setStartHalf(false); setEndHalf(false);
      setMsg({ ok: true, text: "Antrag gestellt. Du bekommst eine Nachricht, sobald er genehmigt oder abgelehnt ist." });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (a: Absence) => {
    setMsg(null);
    try {
      await api.cancelRequest(a.id);
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <section className={`ur-my ${className}`}>
      <div className="ur-my-head">
        <div>
          <h2>🏖 Mein Urlaub {year}</h2>
          {hasEntitlement ? (
            <small>
              Anspruch {fmtNum(bal.entitled)}
              {bal.carry ? ` + ${fmtNum(bal.carry)} aus ${year - 1}` : ""} · genommen {fmtNum(bal.taken)} · geplant {fmtNum(bal.planned)}
              {pendingDays ? ` · beantragt ${fmtNum(pendingDays)}` : ""}
            </small>
          ) : (
            <small>Dein Urlaubsanspruch ist noch nicht eingetragen – du kannst trotzdem Urlaub beantragen.</small>
          )}
        </div>
        {hasEntitlement && (
          <div className={`ur-my-rest${bal.rest < 0 ? " neg" : ""}`}>
            <b>{fmtNum(bal.rest)}</b>
            <span>Tage übrig</span>
          </div>
        )}
      </div>

      {msg && <p className={`ur-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}

      {visible.length > 0 && (
        <ul className="ur-my-list">
          {visible.map((a) => (
            <li key={a.id} className={`s-${a.status}`}>
              <div>
                <b>
                  {KINDS[a.kind].icon} {KINDS[a.kind].short}: {a.start_date === a.end_date ? deDate(a.start_date) : `${deShort(a.start_date)} – ${deDate(a.end_date)}`}
                </b>
                <small>
                  {fmtNum(countDays(a, me.leave.work_weekdays, me.cal))} Arbeitstage · {STATUS_LABEL[a.status]}
                  {a.status === "abgelehnt" && a.decision_note ? ` – ${a.decision_note}` : ""}
                </small>
              </div>
              {a.status === "beantragt" && (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => cancel(a)}>
                  Zurückziehen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!form ? (
        <button type="button" className="btn btn-primary ur-my-btn" onClick={() => { setForm(true); setMsg(null); }}>
          Urlaub beantragen
        </button>
      ) : (
        <div className="ur-my-form">
          <div className="ur-kinds">
            {REQUEST_KINDS.map((k) => (
              <button key={k} type="button" className={kind === k ? "on" : ""} style={kind === k ? { background: KINDS[k].bg, borderColor: KINDS[k].color, color: KINDS[k].color } : undefined} onClick={() => setKind(k)}>
                {KINDS[k].icon} {KINDS[k].label}
              </button>
            ))}
          </div>
          <div className="ur-grid">
            <label className="ur-field">
              <span>Von</span>
              <input type="date" value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); }} />
            </label>
            <label className="ur-field">
              <span>Bis</span>
              <input type="date" value={to} min={from || today} onChange={(e) => setTo(e.target.value)} />
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
          </div>
          <label className="ur-field">
            <span>Bemerkung (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </label>
          {days > 0 && (
            <p className="ur-small">
              = {fmtNum(days)} Arbeitstage
              {kind === "urlaub" && hasEntitlement && (() => {
                const y = Number(from.slice(0, 4));
                const b = y === year ? bal : balance(me.leave, y, list, me.cal, me.exitDate, today);
                const pend = list.filter((x) => x.status === "beantragt" && x.kind === "urlaub").reduce((s, x) => s + countDays(x, me.leave.work_weekdays, me.cal, `${y}-01-01`, `${y}-12-31`), 0);
                const inYear = countDays(draft, me.leave.work_weekdays, me.cal, `${y}-01-01`, `${y}-12-31`);
                return ` · danach übrig ${y}: ${fmtNum(b.rest - pend - inYear)} Tage`;
              })()}
            </p>
          )}
          <div className="ur-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setForm(false)}>
              Abbrechen
            </button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? "Sendet …" : "Antrag senden"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
