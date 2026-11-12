// Mitarbeiter bearbeiten → Urlaub: Anspruch, Arbeitstage, Eintritt, Resturlaub Vorjahr, Urlaubskonto
import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import { balance, deDate, EMPTY_LEAVE, fmtNum, hasLeave, legalMinimum, suggestedEntitlement, WEEKDAYS } from "./logic";
import type { Absence, Calendar, Leave, UPerson } from "./logic";
import "./ur.css";

type Props = { tenantId: number; person: UPerson; onOpenOverview?: () => void };

const num = (v: string): number | null => {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const str = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export default function LeaveSection({ tenantId, person, onOpenOverview }: Props) {
  const year = new Date().getFullYear();
  const [leave, setLeave] = useState<Leave | null>(null);
  const [absences, setAbsences] = useState<Absence[] | null>([]);
  const [cal, setCal] = useState<Calendar>({ land: "de", region: null });
  const [days, setDays] = useState("");
  const [carry, setCarry] = useState("");
  const [override, setOverride] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [leaves, abs, c] = await Promise.all([api.loadLeaves(tenantId), api.loadAbsences(tenantId, `${year}-01-01`), api.loadCalendar(tenantId)]);
      if (cancel) return;
      const l = leaves.get(person.id) ?? EMPTY_LEAVE(person.id, tenantId);
      setLeave(l);
      setAbsences(abs);
      setCal(c);
      setDays(str(l.vacation_days));
      setCarry(str(l.years?.[String(year)]?.carry));
      setOverride(str(l.years?.[String(year)]?.entitled));
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId, person.id, year]);

  const draft: Leave | null = useMemo(() => {
    if (!leave) return null;
    const y = { ...(leave.years ?? {}) };
    const cur = { ...(y[String(year)] ?? {}) };
    cur.carry = num(carry);
    cur.entitled = num(override);
    if (cur.carry == null) delete cur.carry;
    if (cur.entitled == null) delete cur.entitled;
    if (Object.keys(cur).length) y[String(year)] = cur;
    else delete y[String(year)];
    return { ...leave, vacation_days: num(days), years: y };
  }, [leave, days, carry, override, year]);

  if (!hasLeave(person)) return null;
  if (!leave || !draft) return null;

  const bal = absences ? balance(draft, year, absences, cal, person.exit_date) : null;
  const sug = suggestedEntitlement(draft, year, person.exit_date);
  const min = legalMinimum(cal.land, draft.work_weekdays.length);
  const toggleDay = (n: number) => {
    const has = leave.work_weekdays.includes(n);
    const next = has ? leave.work_weekdays.filter((x) => x !== n) : [...leave.work_weekdays, n].sort();
    if (next.length) setLeave({ ...leave, work_weekdays: next });
  };

  const save = async () => {
    setMsg(null);
    const d = num(days);
    if (d != null && (d < 0 || d > 60)) return setMsg({ ok: false, text: "Bitte 0 bis 60 Urlaubstage eingeben." });
    setBusy(true);
    try {
      await api.saveLeave(draft);
      setLeave(draft);
      setMsg({ ok: true, text: "Urlaub gespeichert." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="single-page-section ur-root">
      <div className="card form-page-card">
        <div className="ur-head">
          <h3>🏖 Urlaub</h3>
          {onOpenOverview && (
            <button type="button" className="btn btn-secondary btn-small" onClick={onOpenOverview}>
              Urlaub & Abwesenheiten öffnen
            </button>
          )}
        </div>
        {absences === null ? (
          <p className="ur-msg err">{api.NEEDS_SQL}</p>
        ) : (
          <>
            <div className="ur-grid">
              <label className="ur-field">
                <span>Urlaubstage pro Jahr (voller Anspruch)</span>
                <input inputMode="decimal" value={days} onChange={(e) => setDays(e.target.value)} placeholder="z. B. 30" />
              </label>
              <label className="ur-field">
                <span>Eintritt in den Betrieb</span>
                <input type="date" value={leave.entry_date ?? ""} onChange={(e) => setLeave({ ...leave, entry_date: e.target.value || null })} />
              </label>
            </div>
            <div className="ur-field">
              <span>Arbeitstage pro Woche</span>
              <div className="ur-days">
                {WEEKDAYS.map((w) => (
                  <button key={w.n} type="button" className={leave.work_weekdays.includes(w.n) ? "on" : ""} onClick={() => toggleDay(w.n)}>
                    {w.short}
                  </button>
                ))}
              </div>
              <small className="ur-small">
                Urlaub und Soll-Stunden zählen nur an diesen Tagen. Gesetzlicher Mindesturlaub bei {leave.work_weekdays.length} Tagen pro Woche: {fmtNum(min)} Tage.
                {num(days) != null && num(days)! < min && <b className="ur-neg"> Der eingetragene Anspruch liegt darunter!</b>}
              </small>
            </div>
            <div className="ur-grid">
              <label className="ur-field">
                <span>Resturlaub aus {year - 1} (Übertrag)</span>
                <input inputMode="decimal" value={carry} onChange={(e) => setCarry(e.target.value)} placeholder="automatisch / 0" />
              </label>
              <label className="ur-field">
                <span>Anspruch {year} abweichend (optional)</span>
                <input inputMode="decimal" value={override} onChange={(e) => setOverride(e.target.value)} placeholder={sug.days ? `${fmtNum(sug.days)}${sug.note ? ` – ${sug.note}` : ""}` : "–"} />
              </label>
            </div>
            <p className="ur-small">
              Der Übertrag wird ab dem nächsten Jahr automatisch aus dem Resturlaub berechnet. {cal.land === "de" && "In Deutschland verfällt Resturlaub aus dem Vorjahr in der Regel am 31.03. – aber nur, wenn Sie den Mitarbeiter rechtzeitig schriftlich darauf hingewiesen haben."}
              {sug.note && ` Vorschlag ${year}: ${fmtNum(sug.days)} Tage (${sug.note}).`}
            </p>

            {bal && (
              <div className="ur-konto">
                <div>
                  <span>Anspruch {year}</span>
                  <b>{fmtNum(bal.entitled)}</b>
                </div>
                <div>
                  <span>+ Übertrag</span>
                  <b>{fmtNum(bal.carry)}</b>
                </div>
                <div>
                  <span>− genommen</span>
                  <b>{fmtNum(bal.taken)}</b>
                </div>
                <div>
                  <span>− geplant</span>
                  <b>{fmtNum(bal.planned)}</b>
                </div>
                <div className={`sum${bal.rest < 0 ? " neg" : ""}`}>
                  <span>Resturlaub</span>
                  <b>{fmtNum(bal.rest)}</b>
                </div>
                {bal.byKind.krank > 0 && (
                  <div className="krank">
                    <span>Krankheitstage {year}</span>
                    <b>{fmtNum(bal.byKind.krank)}</b>
                  </div>
                )}
              </div>
            )}
            {person.exit_date && <p className="ur-small">Austritt am {deDate(person.exit_date)} – der Anspruch wird entsprechend berechnet.</p>}
            {msg && <p className={`ur-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
            <button type="button" className="btn btn-primary ur-save" onClick={save} disabled={busy}>
              {busy ? "Speichert …" : "Urlaub speichern"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
