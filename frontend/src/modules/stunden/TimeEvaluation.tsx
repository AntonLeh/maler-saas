// Arbeitsstunden (nur Admin): Zeitraum, Filter, Kennzahlen, Soll/Ist, Hinweise (ArbZG), Korrekturen, Export
import { Fragment, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import type { Correction } from "./api";
import { EMPLOYMENT, EMPLOYMENT_ORDER } from "../mitarbeiter-arten/logic";
import type { Pay } from "../mitarbeiter-arten/logic";
import {
  costSplit,
  csv,
  dayOf,
  deDate,
  download,
  findAlerts,
  fmtH,
  fmtMoney,
  GROUP_LABELS,
  hm,
  hours,
  nameOf,
  netMinutes,
  presetRange,
  sollMinutes,
  sourceOf,
  SOURCE_LABELS,
  typeOf,
  yearRange,
  ymd,
} from "./logic";
import type { Entry, Group, Person } from "./logic";
import CorrectionDialog from "./CorrectionDialog";
import "./st.css";

type View = "people" | "orders" | "entries";
type Preset = "week" | "lastweek" | "month" | "lastmonth" | "year";
type Props = { tenantId: number; currencySymbol: string; onBack: () => void };

const PRESETS: [Preset, string][] = [
  ["week", "Diese Woche"],
  ["lastweek", "Letzte Woche"],
  ["month", "Dieser Monat"],
  ["lastmonth", "Letzter Monat"],
  ["year", "Dieses Jahr"],
];
const rangeOf = (p: Preset) => (p === "year" ? yearRange() : presetRange(p));

export default function TimeEvaluation({ tenantId, currencySymbol: cur, onBack }: Props) {
  const [preset, setPreset] = useState<Preset | "">("month");
  const [from, setFrom] = useState(rangeOf("month").from);
  const [to, setTo] = useState(rangeOf("month").to);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [openEntries, setOpenEntries] = useState<Entry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [pays, setPays] = useState<Map<number, Pay>>(new Map());
  const [orders, setOrders] = useState<{ id: number; title: string; city: string | null; status: string; planned_hours: number | null }[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<View>("people");
  const [fPerson, setFPerson] = useState("");
  const [fOrder, setFOrder] = useState("");
  const [fType, setFType] = useState("");
  const [fixing, setFixing] = useState<Entry | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // Stammdaten einmal laden
  useEffect(() => {
    Promise.all([api.loadPeople(tenantId), api.loadPays(tenantId), api.loadOrders(tenantId), api.loadCorrections(tenantId)])
      .then(([p, pay, o, c]) => {
        setPeople(p);
        setPays(pay);
        setOrders(o);
        setCorrections(c);
      })
      .catch((e) => setError((e as Error).message));
  }, [tenantId]);

  const reload = async () => {
    setLoading(true);
    try {
      const [e, open, c] = await Promise.all([api.loadEntries(tenantId, { from, to }), api.loadOpenEntries(tenantId), api.loadCorrections(tenantId)]);
      setEntries(e);
      setOpenEntries(open);
      setCorrections(c);
      setError("");
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [tenantId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (p: Preset) => {
    const r = rangeOf(p);
    setPreset(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const byId = useMemo(() => new Map(people.map((p) => [Number(p.id), p])), [people]);
  const orderTitle = useMemo(() => {
    const m = new Map(orders.map((o) => [String(o.id), o.city ? `${o.title} (${o.city})` : o.title]));
    return (id: Entry["order_id"]) => (id == null ? "ohne Auftrag" : m.get(String(id)) ?? `Auftrag ${id}`);
  }, [orders]);
  const corrected = useMemo(() => new Map<number, Correction[]>(corrections.reduce((m, c) => m.set(c.time_entry_id, [...(m.get(c.time_entry_id) ?? []), c]), new Map<number, Correction[]>())), [corrections]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const p = byId.get(Number(e.user_id));
        if (fPerson && String(e.user_id) !== fPerson) return false;
        if (fOrder && String(e.order_id) !== fOrder) return false;
        if (fType && typeOf(p) !== fType) return false;
        return true;
      }),
    [entries, byId, fPerson, fOrder, fType]
  );

  const split = useMemo(() => costSplit(filtered, people), [filtered, people]);
  const totalMin = filtered.reduce((s, e) => s + netMinutes(e), 0);
  const workDays = new Set(filtered.map((e) => `${e.user_id}|${dayOf(e)}`)).size;
  const orderMin = filtered.filter((e) => e.order_id != null).reduce((s, e) => s + netMinutes(e), 0);
  const alerts = useMemo(() => findAlerts([...filtered, ...openEntries.filter((o) => !fPerson || String(o.user_id) === fPerson)], people), [filtered, openEntries, people, fPerson]);

  // ---------- je Mitarbeiter ----------
  const perPerson = useMemo(() => {
    const m = new Map<number, { minutes: number; cost: number; days: Set<string>; entries: number }>();
    for (const e of filtered) {
      const p = byId.get(Number(e.user_id));
      const n = netMinutes(e);
      const cur0 = m.get(Number(e.user_id)) ?? { minutes: 0, cost: 0, days: new Set<string>(), entries: 0 };
      cur0.minutes += n;
      cur0.cost += (n / 60) * Number(p?.hourly_rate || 0);
      cur0.days.add(dayOf(e));
      cur0.entries++;
      m.set(Number(e.user_id), cur0);
    }
    return [...m.entries()]
      .map(([id, v]) => {
        const p = byId.get(id);
        const pay = pays.get(id);
        const soll = EMPLOYMENT[typeOf(p)].own ? sollMinutes(pay?.weekly_hours ?? null, from, to > ymd(new Date()) ? ymd(new Date()) : to, p?.exit_date) : 0;
        return { id, p, ...v, soll };
      })
      .sort((a, b) => nameOf(a.p).localeCompare(nameOf(b.p), "de"));
  }, [filtered, byId, pays, from, to]);

  // ---------- je Auftrag ----------
  const perOrder = useMemo(() => {
    const m = new Map<string, { minutes: number; cost: number; people: Map<number, number> }>();
    for (const e of filtered) {
      const k = String(e.order_id ?? "–");
      const p = byId.get(Number(e.user_id));
      const n = netMinutes(e);
      const cur0 = m.get(k) ?? { minutes: 0, cost: 0, people: new Map<number, number>() };
      cur0.minutes += n;
      cur0.cost += (n / 60) * Number(p?.hourly_rate || 0);
      cur0.people.set(Number(e.user_id), (cur0.people.get(Number(e.user_id)) ?? 0) + n);
      m.set(k, cur0);
    }
    return [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.minutes - a.minutes);
  }, [filtered, byId]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [["Datum", "Mitarbeiter", "Beschäftigung", "Auftrag", "Beginn", "Ende", "Pause (min)", "Stunden", "Kosten-Stundensatz", "Kosten", "Herkunft", "korrigiert"]];
    for (const e of [...filtered].sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)))) {
      const p = byId.get(Number(e.user_id));
      const n = netMinutes(e);
      rows.push([dayOf(e), nameOf(p, e.user_id), EMPLOYMENT[typeOf(p)].short, orderTitle(e.order_id), hm(e.started_at!), hm(e.ended_at!), Number(e.total_break_minutes || 0), hours(n), Number(p?.hourly_rate || 0), Math.round((n / 60) * Number(p?.hourly_rate || 0) * 100) / 100, SOURCE_LABELS[sourceOf(e)] || "selbst gestempelt", corrected.has(e.id) ? "ja" : ""]);
    }
    download(new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }), `Arbeitsstunden_${from}_${to}.csv`);
  };

  const staff = people.filter((p) => p.role_id === 3 || p.role_id === 4).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "de"));
  const groups: Group[] = ["own", "leih", "sub"];
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);
  const allEntries = [...entries, ...openEntries];

  return (
    <section className="single-page-section st-root">
      <div className="card form-page-card st-page">
        <div className="page-topbar">
          <div>
            <h2>Arbeitsstunden</h2>
            <p>Stunden, Kosten, Über- und Minusstunden sowie Hinweise zum Arbeitszeitgesetz.</p>
          </div>
          <div className="st-actions">
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
              CSV (Excel)
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        <div className="st-presets">
          {PRESETS.map(([k, l]) => (
            <button key={k} type="button" className={preset === k ? "on" : ""} onClick={() => choose(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="st-bar">
          <label className="st-field">
            <span>Von</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset("");
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="st-field">
            <span>Bis</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset("");
                setTo(e.target.value);
              }}
            />
          </label>
          <label className="st-field">
            <span>Mitarbeiter</span>
            <select value={fPerson} onChange={(e) => setFPerson(e.target.value)}>
              <option value="">Alle</option>
              {staff.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {nameOf(p)}
                  {p.is_active === false ? " (ausgeschieden)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="st-field">
            <span>Beschäftigung</span>
            <select value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">Alle</option>
              {EMPLOYMENT_ORDER.map((k) => (
                <option key={k} value={k}>
                  {EMPLOYMENT[k].short}
                </option>
              ))}
            </select>
          </label>
          <label className="st-field">
            <span>Auftrag</span>
            <select value={fOrder} onChange={(e) => setFOrder(e.target.value)}>
              <option value="">Alle</option>
              {orders.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="st-msg err">{error}</p>}
        {msg && <p className="st-msg ok">{msg}</p>}

        {alerts.length > 0 && (
          <div className="st-alerts">
            <h4>Braucht Aufmerksamkeit ({alerts.length})</h4>
            <ul>
              {visibleAlerts.map((a) => {
                const entry = a.entryId ? allEntries.find((x) => x.id === a.entryId) : undefined;
                return (
                  <li key={a.key} className={`k-${a.kind}`}>
                    <span>{a.text}</span>
                    {entry && entry.started_at && (
                      <button type="button" className="st-link" onClick={() => setFixing(entry)}>
                        Korrigieren
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {alerts.length > 5 && (
              <button type="button" className="st-link" onClick={() => setShowAllAlerts((s) => !s)}>
                {showAllAlerts ? "Weniger anzeigen" : `Alle ${alerts.length} Hinweise anzeigen`}
              </button>
            )}
          </div>
        )}

        <div className="st-split">
          <div className="sum">
            <span>Stunden gesamt</span>
            <b>{fmtH(totalMin)} Std.</b>
            <small>{filtered.length} Einträge</small>
          </div>
          {groups
            .filter((g) => split[g].minutes > 0)
            .map((g) => (
              <div key={g}>
                <span>{GROUP_LABELS[g]}</span>
                <b>{fmtMoney(split[g].cost, cur)}</b>
                <small>{fmtH(split[g].minutes)} Std.</small>
              </div>
            ))}
          <div>
            <span>Ø pro Arbeitstag</span>
            <b>{workDays ? `${fmtH(totalMin / workDays)} Std.` : "–"}</b>
            <small>je Person und Tag</small>
          </div>
          <div>
            <span>Auf Aufträgen</span>
            <b>{totalMin ? `${Math.round((orderMin / totalMin) * 100)} %` : "–"}</b>
            <small>der Stunden</small>
          </div>
        </div>

        <div className="st-tabs">
          {(
            [
              ["people", "Pro Mitarbeiter"],
              ["orders", "Pro Auftrag"],
              ["entries", "Alle Einträge"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" className={view === k ? "on" : ""} onClick={() => setView(k)}>
              {l}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="st-empty">Lädt …</p>
        ) : filtered.length === 0 ? (
          <p className="st-empty">Im gewählten Zeitraum sind keine abgeschlossenen Stunden erfasst.</p>
        ) : view === "people" ? (
          <table className="st-table st-cards">
            <thead>
              <tr>
                <th>Mitarbeiter</th>
                <th className="r">Tage</th>
                <th className="r">Ist</th>
                <th className="r">Soll</th>
                <th className="r">Über/Minus</th>
                <th className="r">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {perPerson.map((r) => {
                const diff = r.soll ? r.minutes - r.soll : null;
                return (
                  <tr key={r.id}>
                    <td data-label="">
                      <button
                        type="button"
                        className="st-name"
                        onClick={() => {
                          setFPerson(String(r.id));
                          setView("entries");
                        }}
                      >
                        {nameOf(r.p, r.id)}
                      </button>
                      <small>
                        {EMPLOYMENT[typeOf(r.p)].short}
                        {r.p?.app_access === false ? " · ohne App" : ""}
                      </small>
                    </td>
                    <td className="r" data-label="Tage">
                      {r.days.size}
                    </td>
                    <td className="r" data-label="Ist">
                      {fmtH(r.minutes)}
                    </td>
                    <td className="r" data-label="Soll">
                      {r.soll ? fmtH(r.soll) : "–"}
                    </td>
                    <td className={`r ${diff == null ? "" : diff >= 0 ? "pos" : "neg"}`} data-label="Über/Minus">
                      {diff == null ? "–" : `${diff >= 0 ? "+" : "−"}${fmtH(Math.abs(diff))}`}
                    </td>
                    <td className="r" data-label="Kosten">
                      {fmtMoney((r.minutes / 60) * Number(r.p?.hourly_rate || 0), cur)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : view === "orders" ? (
          <table className="st-table st-cards">
            <thead>
              <tr>
                <th>Auftrag</th>
                <th>Wer</th>
                <th className="r">Stunden</th>
                <th className="r">Geplant</th>
                <th className="r">Abweichung</th>
                <th className="r">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {perOrder.map((r) => (
                <tr key={r.k}>
                  <td data-label="">
                    <button
                      type="button"
                      className="st-name"
                      onClick={() => {
                        if (r.k !== "–") setFOrder(r.k);
                        setView("entries");
                      }}
                    >
                      {r.k === "–" ? "ohne Auftrag" : orderTitle(r.k)}
                    </button>
                  </td>
                  <td data-label="Wer">
                    {[...r.people.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([pid, m]) => `${nameOf(byId.get(pid), pid)} ${fmtH(m)}`)
                      .join(" · ")}
                  </td>
                  <td className="r" data-label="Stunden">
                    {fmtH(r.minutes)}
                  </td>
                  {(() => {
                    const planned = orders.find((o) => String(o.id) === r.k)?.planned_hours ?? null;
                    const diff = planned ? r.minutes / 60 - planned : null;
                    return (
                      <>
                        <td className="r" data-label="Geplant">
                          {planned ? planned.toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "–"}
                        </td>
                        <td className={`r ${diff == null ? "" : diff > 0 ? "neg" : "pos"}`} data-label="Abweichung">
                          {diff == null ? "–" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("de-DE", { maximumFractionDigits: 1 })}`}
                        </td>
                      </>
                    );
                  })()}
                  <td className="r" data-label="Kosten">
                    {fmtMoney(r.cost, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="st-table st-cards">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Mitarbeiter</th>
                <th>Auftrag</th>
                <th>Zeit</th>
                <th className="r">Pause</th>
                <th className="r">Stunden</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...filtered]
                .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
                .slice(0, 500)
                .map((e) => {
                  const p = byId.get(Number(e.user_id));
                  const src = sourceOf(e);
                  const corr = corrected.get(e.id);
                  return (
                    <Fragment key={e.id}>
                      <tr>
                        <td data-label="Datum">{deDate(dayOf(e))}</td>
                        <td data-label="">
                          {nameOf(p, e.user_id)}
                          <small>{EMPLOYMENT[typeOf(p)].short}</small>
                        </td>
                        <td data-label="Auftrag">{orderTitle(e.order_id)}</td>
                        <td data-label="Zeit">
                          {hm(e.started_at!)}–{hm(e.ended_at!)}
                          {src !== "self" && <small>{SOURCE_LABELS[src]}</small>}
                          {corr && (
                            <small className="st-corr" title={corr.map((c) => `${new Date(c.created_at).toLocaleString("de-DE")}: ${c.reason}`).join("\n")}>
                              korrigiert: {corr[0].reason}
                            </small>
                          )}
                        </td>
                        <td className="r" data-label="Pause">
                          {Number(e.total_break_minutes) ? `${e.total_break_minutes} min` : "–"}
                        </td>
                        <td className="r" data-label="Stunden">
                          {fmtH(netMinutes(e))}
                        </td>
                        <td className="r">
                          <button type="button" className="st-link" onClick={() => setFixing(e)}>
                            Korrigieren
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        )}
        {view === "entries" && filtered.length > 500 && <p className="st-small">Es werden die neuesten 500 Einträge angezeigt – für alle bitte „CSV (Excel)“ nutzen.</p>}
        <p className="st-small">
          Soll-Stunden aus den Wochenstunden im Mitarbeiter-Formular (Mo–Fr, ohne Feiertage und Urlaub). Hinweise nach Arbeitszeitgesetz: höchstens 10 Std. am Tag, Pause ab 6 Std. 30
          min und ab 9 Std. 45 min, mindestens 11 Std. Ruhezeit.
        </p>
      </div>

      {fixing && (
        <CorrectionDialog
          entry={fixing}
          person={byId.get(Number(fixing.user_id))}
          orderTitle={orderTitle(fixing.order_id)}
          onSaved={async (text) => {
            setFixing(null);
            setMsg(text);
            await reload();
          }}
          onClose={() => setFixing(null)}
        />
      )}
    </section>
  );
}
