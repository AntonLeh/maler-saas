// Urlaub & Abwesenheiten (nur Inhaber): Jahresübersicht, Monatskalender, Liste
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { showConfirm, showPrompt } from "../../lib/dialogs";
import * as api from "./api";
import AbsenceDialog from "./AbsenceDialog";
import {
  balance,
  canBeAbsent,
  countDays,
  DEFAULT_WEEKDAYS,
  deDate,
  deShort,
  EMPTY_LEAVE,
  fmtNum,
  hasLeave,
  isHoliday,
  KIND_ORDER,
  KINDS,
  personName,
  todayIso,
  ymd,
} from "./logic";
import type { Absence, AbsenceKind, Calendar, Leave, UPerson } from "./logic";
import "./ur.css";

type Tab = "jahr" | "kalender" | "liste";
type Props = { tenantId: number; currentUserId: number; people: UPerson[]; onBack: () => void; onOpenPerson?: (id: number) => void };

const pad = (n: number) => String(n).padStart(2, "0");
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });

export default function UrlaubPage({ tenantId, currentUserId, people, onBack, onOpenPerson }: Props) {
  const now = new Date();
  const [tab, setTab] = useState<Tab>("kalender");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(ymd(now).slice(0, 7));
  const [absences, setAbsences] = useState<Absence[] | null>([]);
  const [leaves, setLeaves] = useState<Map<number, Leave>>(new Map());
  const [cal, setCal] = useState<Calendar>({ land: "de", region: null });
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ edit?: Absence | null; userId?: number | null; date?: string | null } | null>(null);
  const [fPerson, setFPerson] = useState("");
  const [fKind, setFKind] = useState<AbsenceKind | "">("");

  const fetchAll = useCallback(() => Promise.all([api.loadAbsences(tenantId), api.loadLeaves(tenantId), api.loadCalendar(tenantId)]), [tenantId]);
  const apply = ([a, l, c]: Awaited<ReturnType<typeof fetchAll>>) => {
    setAbsences(a);
    setLeaves(l);
    setCal(c);
    setLoading(false);
  };
  const load = async () => apply(await fetchAll());
  useEffect(() => {
    let cancel = false;
    void fetchAll().then((r) => {
      if (cancel) return;
      setAbsences(r[0]);
      setLeaves(r[1]);
      setCal(r[2]);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [fetchAll]);

  const team = useMemo(
    () => people.filter((p) => canBeAbsent(p) && (p.is_active !== false || (p.exit_date && p.exit_date >= `${year}-01-01`))).sort((a, b) => personName(a).localeCompare(personName(b), "de")),
    [people, year],
  );
  const leaveOf = (id: number) => leaves.get(id) ?? EMPTY_LEAVE(id, tenantId);
  const wdOf = (id: number) => (leaves.get(id)?.work_weekdays?.length ? leaves.get(id)!.work_weekdays : DEFAULT_WEEKDAYS);
  const list = useMemo(() => absences ?? [], [absences]);

  const rows = useMemo(
    () => team.map((p) => ({ p, own: hasLeave(p), bal: balance(leaves.get(p.id) ?? EMPTY_LEAVE(p.id, tenantId), year, list, cal, p.exit_date) })),
    [team, leaves, tenantId, year, list, cal],
  );
  const today = todayIso();
  const lateInYear = year === now.getFullYear() && now.getMonth() >= 9;
  const restWarn = rows.filter((r) => r.own && lateInYear && r.bal.rest > 0 && (leaves.get(r.p.id)?.vacation_days ?? 0) > 0);
  const absentToday = team.filter((p) => list.some((a) => Number(a.user_id) === p.id && a.status === "genehmigt" && a.start_date <= today && a.end_date >= today));

  const pending = list.filter((a) => a.status === "beantragt").sort((a, b) => a.start_date.localeCompare(b.start_date));
  const [deciding, setDeciding] = useState<number | null>(null);
  const [reqError, setReqError] = useState("");
  const rangeText = (a: Absence) => (a.start_date === a.end_date ? deDate(a.start_date) : `${deDate(a.start_date)} – ${deDate(a.end_date)}`);
  const decide = async (a: Absence, approve: boolean) => {
    setReqError("");
    let reason = "";
    if (!approve) {
      const r = await showPrompt("Grund für die Ablehnung (geht an den Mitarbeiter):", { placeholder: "z. B. Auftrag Lindenstraße läuft in dieser Woche" });
      if (r === null) return;
      reason = r;
    }
    setDeciding(a.id);
    try {
      const what = a.kind === "urlaub" ? "Urlaub" : KINDS[a.kind].label;
      const text = approve ? `✅ Dein ${what} vom ${rangeText(a)} ist genehmigt.` : `❌ Dein ${what} vom ${rangeText(a)} wurde abgelehnt${reason.trim() ? `: ${reason.trim()}` : "."}`;
      await api.decideRequest(a, approve, reason, currentUserId, text);
      await load();
    } catch (e) {
      setReqError((e as Error).message);
    } finally {
      setDeciding(null);
    }
  };

  const remove = async (a: Absence) => {
    if (!(await showConfirm(`${KINDS[a.kind].label} von ${personName(team.find((p) => p.id === Number(a.user_id)))} (${deDate(a.start_date)} – ${deDate(a.end_date)}) löschen?`, { danger: true, confirmLabel: "Löschen" }))) return;
    await api.deleteAbsence(a.id);
    await load();
  };

  // ---------- Kalender ----------
  const monthDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const n = new Date(y, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`);
  }, [month]);
  const shiftMonth = (d: number) => {
    const [y, m] = month.split("-").map(Number);
    const nd = new Date(y, m - 1 + d, 1);
    setMonth(`${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`);
  };
  const cellAbs = (pid: number, day: string) => list.find((a) => Number(a.user_id) === pid && a.status !== "abgelehnt" && a.start_date <= day && a.end_date >= day);

  const filtered = list
    .filter((a) => a.start_date.slice(0, 4) <= String(year) && a.end_date.slice(0, 4) >= String(year))
    .filter((a) => !fPerson || String(a.user_id) === fPerson)
    .filter((a) => !fKind || a.kind === fKind)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  return (
    <section className="single-page-section ur-root">
      <div className="card">
        <div className="page-topbar">
          <div>
            <h2>🏖 Urlaub & Abwesenheiten</h2>
            <p>Urlaubskonto, Krankheitstage und wer wann fehlt – nur für Sie sichtbar. Projektleiter sehen nur „abwesend“.</p>
          </div>
          <div className="ur-top-actions">
            <button type="button" className="btn btn-primary" onClick={() => setDialog({})} disabled={absences === null}>
              + Abwesenheit eintragen
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        {absences === null && <p className="ur-msg err">{api.NEEDS_SQL}</p>}
        {absences !== null && cal.land === "de" && !cal.region && (
          <p className="ur-msg warn">Bitte in den Einstellungen das Bundesland eintragen – sonst werden nur die bundesweiten Feiertage berücksichtigt.</p>
        )}

        {absentToday.length > 0 && (
          <p className="ur-today">
            Heute abwesend: {absentToday.map((p) => {
              const a = cellAbs(p.id, today)!;
              return `${personName(p)} (${KINDS[a.kind].short})`;
            }).join(", ")}
          </p>
        )}

        {restWarn.length > 0 && (
          <div className="ur-msg warn">
            <b>Resturlaub {year}:</b> {restWarn.map((r) => `${personName(r.p)} ${fmtNum(r.bal.rest)} Tage`).join(" · ")}
            <br />
            <small>
              {cal.land === "de"
                ? "Weisen Sie die Mitarbeiter schriftlich (z. B. per E-Mail) darauf hin, den Resturlaub bis zum Jahresende zu nehmen – sonst verfällt er nicht."
                : "Bitte rechtzeitig planen, damit der Urlaub im Urlaubsjahr genommen wird."}
            </small>
          </div>
        )}

        {pending.length > 0 && (
          <div className="ur-requests">
            <h3>📨 Offene Anträge ({pending.length})</h3>
            {reqError && <p className="ur-msg err">{reqError}</p>}
            {pending.map((a) => {
              const p = people.find((x) => x.id === Number(a.user_id));
              const wd = wdOf(Number(a.user_id));
              const d = countDays(a, wd, cal);
              const lv = leaves.get(Number(a.user_id));
              const restAfter = a.kind === "urlaub" && lv?.vacation_days ? balance(lv, Number(a.start_date.slice(0, 4)), [...list, { ...a, status: "genehmigt" }], cal, p?.exit_date).rest : null;
              const clash = list.filter((o) => o.id !== a.id && o.status === "genehmigt" && Number(o.user_id) !== Number(a.user_id) && o.start_date <= a.end_date && o.end_date >= a.start_date);
              return (
                <div key={a.id} className="ur-req">
                  <div>
                    <b>
                      {personName(p)} · {KINDS[a.kind].icon} {KINDS[a.kind].short} {rangeText(a)}
                    </b>
                    <small>
                      {fmtNum(d)} Arbeitstage{restAfter != null && <span className={restAfter < 0 ? "ur-neg" : ""}> · Rest danach {fmtNum(restAfter)}</span>}
                      {a.note ? ` · „${a.note}“` : ""}
                      {clash.length > 0 && ` · gleichzeitig weg: ${[...new Set(clash.map((o) => personName(people.find((x) => x.id === Number(o.user_id)))))].join(", ")}`}
                    </small>
                  </div>
                  <div className="ur-req-actions">
                    <button type="button" className="btn btn-primary btn-small" disabled={deciding === a.id} onClick={() => decide(a, true)}>
                      Genehmigen
                    </button>
                    <button type="button" className="btn btn-secondary btn-small" disabled={deciding === a.id} onClick={() => decide(a, false)}>
                      Ablehnen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="ur-tabs">
          {(
            [
              ["kalender", "Kalender"],
              ["jahr", "Urlaubskonto"],
              ["liste", "Liste"],
            ] as [Tab, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
          {tab !== "kalender" && (
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Jahr">
              {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <p className="ur-small">Lädt …</p>
        ) : team.length === 0 ? (
          <p className="ur-small">Noch keine Mitarbeiter angelegt.</p>
        ) : tab === "kalender" ? (
          <>
            <div className="ur-month">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Vormonat">
                ‹
              </button>
              <b>{monthLabel(month)}</b>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Nächster Monat">
                ›
              </button>
              <button type="button" className="ur-link" onClick={() => setMonth(ymd(new Date()).slice(0, 7))}>
                Heute
              </button>
            </div>
            <div className="ur-cal-wrap">
              <table className="ur-cal">
                <thead>
                  <tr>
                    <th className="who">Mitarbeiter</th>
                    {monthDays.map((d) => {
                      const wd = new Date(`${d}T12:00:00`).getDay();
                      const hol = isHoliday(d, cal);
                      return (
                        <th key={d} className={`${wd === 0 || wd === 6 ? "we" : ""}${hol ? " hol" : ""}${d === today ? " today" : ""}`} title={hol ?? ""}>
                          <small>{["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][wd]}</small>
                          {Number(d.slice(8))}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {team.map((p) => (
                    <tr key={p.id}>
                      <td className="who">
                        <button type="button" className="ur-link" onClick={() => onOpenPerson?.(p.id)}>
                          {personName(p)}
                        </button>
                      </td>
                      {monthDays.map((d) => {
                        const a = cellAbs(p.id, d);
                        const wd = new Date(`${d}T12:00:00`).getDay();
                        const off = !wdOf(p.id).includes(wd) || !!isHoliday(d, cal);
                        const half = a && ((d === a.start_date && a.start_half) || (d === a.end_date && a.end_half));
                        return (
                          <td
                            key={d}
                            className={`${off ? "off" : ""}${a ? " abs" : ""}${a?.status === "beantragt" ? " req" : ""}${half ? " half" : ""}${d === today ? " today" : ""}`}
                            style={a && !off ? { background: KINDS[a.kind].bg, color: KINDS[a.kind].color } : undefined}
                            title={a ? `${KINDS[a.kind].label}${a.status === "beantragt" ? " (beantragt)" : ""}${half ? " (halber Tag)" : ""}${a.note ? ` – ${a.note}` : ""}` : isHoliday(d, cal) ?? ""}
                            onClick={() => (a ? setDialog({ edit: a }) : !off && absences !== null && setDialog({ userId: p.id, date: d }))}
                          >
                            {a && !off ? KINDS[a.kind].icon : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ur-legend">
              {KIND_ORDER.map((k) => (
                <span key={k} style={{ background: KINDS[k].bg, color: KINDS[k].color }}>
                  {KINDS[k].icon} {KINDS[k].short}
                </span>
              ))}
              <span className="off">frei / Feiertag</span>
            </div>
            <p className="ur-small">Auf einen freien Tag tippen, um eine Abwesenheit einzutragen; auf einen farbigen Tag, um sie zu ändern.</p>
          </>
        ) : tab === "jahr" ? (
          <div className="ur-table-wrap">
            <table className="ur-table">
              <thead>
                <tr>
                  <th>Mitarbeiter</th>
                  <th className="r">Anspruch</th>
                  <th className="r">Übertrag</th>
                  <th className="r">genommen</th>
                  <th className="r">geplant</th>
                  <th className="r">Rest</th>
                  <th className="r">Krank</th>
                  <th>Sonstiges</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, own, bal }) => {
                  const noLeave = own && !leaveOf(p.id).vacation_days;
                  const other = KIND_ORDER.filter((k) => k !== "urlaub" && k !== "krank" && bal.byKind[k] > 0).map((k) => `${KINDS[k].short} ${fmtNum(bal.byKind[k])}`);
                  return (
                    <tr key={p.id}>
                      <td>
                        <button type="button" className="ur-link" onClick={() => onOpenPerson?.(p.id)}>
                          {personName(p)}
                        </button>
                        {p.is_active === false && <small> (ausgeschieden)</small>}
                      </td>
                      {!own ? (
                        <td colSpan={5} className="ur-muted">
                          Leiharbeit – Urlaub über die Zeitarbeitsfirma
                        </td>
                      ) : noLeave ? (
                        <td colSpan={5} className="ur-muted">
                          kein Urlaubsanspruch eingetragen – <button type="button" className="ur-link" onClick={() => onOpenPerson?.(p.id)}>jetzt eintragen</button>
                        </td>
                      ) : (
                        <>
                          <td className="r" title={bal.entitledNote}>
                            {fmtNum(bal.entitled)}
                            {bal.entitledNote && " *"}
                          </td>
                          <td className="r">{fmtNum(bal.carry)}</td>
                          <td className="r">{fmtNum(bal.taken)}</td>
                          <td className="r">{fmtNum(bal.planned)}</td>
                          <td className={`r b${bal.rest < 0 ? " neg" : lateInYear && bal.rest > 0 ? " warn" : ""}`}>{fmtNum(bal.rest)}</td>
                        </>
                      )}
                      <td className="r">{bal.byKind.krank ? fmtNum(bal.byKind.krank) : "–"}</td>
                      <td>{other.join(" · ") || "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="ur-small">Alle Angaben in Arbeitstagen. * = anteiliger Anspruch (Ein-/Austritt) oder angepasst. Der Rest wird automatisch ins nächste Jahr übertragen.</p>
          </div>
        ) : (
          <>
            <div className="ur-filter">
              <select value={fPerson} onChange={(e) => setFPerson(e.target.value)}>
                <option value="">Alle Mitarbeiter</option>
                {team.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personName(p)}
                  </option>
                ))}
              </select>
              <select value={fKind} onChange={(e) => setFKind(e.target.value as AbsenceKind | "")}>
                <option value="">Alle Arten</option>
                {KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {KINDS[k].label}
                  </option>
                ))}
              </select>
            </div>
            {filtered.length === 0 ? (
              <p className="ur-small">Keine Abwesenheiten in {year}.</p>
            ) : (
              <div className="ur-table-wrap">
                <table className="ur-table">
                  <thead>
                    <tr>
                      <th>Mitarbeiter</th>
                      <th>Art</th>
                      <th>Zeitraum</th>
                      <th className="r">Tage</th>
                      <th>Notiz</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <Fragment key={a.id}>
                        <tr>
                          <td>{personName(team.find((p) => p.id === Number(a.user_id)) ?? people.find((p) => p.id === Number(a.user_id)))}</td>
                          <td>
                            <span className="ur-chip" style={{ background: KINDS[a.kind].bg, color: KINDS[a.kind].color }}>
                              {KINDS[a.kind].icon} {KINDS[a.kind].short}
                            </span>
                            {a.au_present && <small> · AU</small>}
                          </td>
                          <td>
                            {a.start_date === a.end_date ? deDate(a.start_date) : `${deShort(a.start_date)} – ${deDate(a.end_date)}`}
                            {(a.start_half || a.end_half) && <small> (halb)</small>}
                          </td>
                          <td className="r">{fmtNum(countDays(a, wdOf(Number(a.user_id)), cal))}</td>
                          <td>{a.note || ""}</td>
                          <td className="ur-row-actions">
                            <button type="button" className="btn btn-secondary btn-small" onClick={() => setDialog({ edit: a })}>
                              Ändern
                            </button>
                            <button type="button" className="btn btn-danger btn-small" onClick={() => remove(a)}>
                              Löschen
                            </button>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {dialog && (
        <AbsenceDialog
          tenantId={tenantId}
          currentUserId={currentUserId}
          people={team.filter((p) => p.is_active !== false || dialog.edit)}
          absences={list}
          leaves={leaves}
          cal={cal}
          edit={dialog.edit}
          presetUserId={dialog.userId}
          presetDate={dialog.date}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await load();
          }}
        />
      )}
    </section>
  );
}
