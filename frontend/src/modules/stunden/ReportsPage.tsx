// Stundenlisten & Nachweise (nur Admin): Monatsliste Steuerberater, Stundennachweis Zeitarbeitsfirma, Leistungsnachweis Subunternehmer
import { Fragment, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import * as uapi from "../urlaub/api";
import { KINDS, countDays, DEFAULT_WEEKDAYS } from "../urlaub/logic";
import { EMPLOYMENT } from "../mitarbeiter-arten/logic";
import type { Pay } from "../mitarbeiter-arten/logic";
import {
  byWeek,
  presetRange,
  SOURCE_LABELS,
  costSplit,
  csv,
  deDate,
  download,
  fmtH,
  fmtMoney,
  GROUP_LABELS,
  hours,
  monthLabel,
  monthRange,
  nameOf,
  proofRows,
  stbList,
  typeOf,
  ymd,
} from "./logic";
import type { AbsenceCtx, Entry, ExternalCost, Group, Person } from "./logic";
import { proofPdf, stbPdf } from "./pdf";
import ManualTimeDialog from "./ManualTimeDialog";
import "./st.css";

type Tab = "stb" | "leih" | "sub";
type Props = {
  tenantId: number;
  currencySymbol: string;
  onBack?: () => void;
  embedded?: boolean;
};

const thisMonth = () => ymd(new Date()).slice(0, 7);
const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return ymd(d).slice(0, 7);
};
const safe = (s: string) => s.replace(/[^\wäöüÄÖÜß-]+/g, "_").slice(0, 40);

export default function ReportsPage({
  tenantId,
  currencySymbol: cur,
  onBack,
  embedded,
}: Props) {
  const [tab, setTab] = useState<Tab>("stb");
  const [people, setPeople] = useState<Person[]>([]);
  const [pays, setPays] = useState<Map<number, Pay>>(new Map());
  const [orders, setOrders] = useState<
    { id: number; title: string; city: string | null; status: string }[]
  >([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [external, setExternal] = useState<ExternalCost[]>([]);
  const [company, setCompany] = useState({ name: "", street: "", city: "" });
  const [absCtx, setAbsCtx] = useState<AbsenceCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [dialog, setDialog] = useState(false);
  const [month, setMonth] = useState(
    new Date().getDate() <= 10 ? lastMonth() : thisMonth(),
  );
  const [personId, setPersonId] = useState<number | "">("");
  const [from, setFrom] = useState(monthRange(thisMonth()).from);
  const [to, setTo] = useState(ymd(new Date()));

  const load = async () => {
    setLoading(true);
    try {
      const [p, pay, o, e, x, c, ab, lv, cl] = await Promise.all([
        api.loadPeople(tenantId),
        api.loadPays(tenantId),
        api.loadOrders(tenantId),
        api.loadEntries(tenantId),
        api.loadExternalCosts(tenantId),
        api.loadCompany(tenantId),
        uapi.loadAbsences(tenantId),
        uapi.loadLeaves(tenantId),
        uapi.loadCalendar(tenantId),
      ]);
      setAbsCtx(ab ? { absences: ab, leaves: lv, cal: cl } : null);
      setPeople(p);
      setPays(pay);
      setOrders(o);
      setEntries(e);
      setExternal(x);
      setCompany(c);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderTitle = useMemo(() => {
    const m = new Map(
      orders.map((o) => [
        String(o.id),
        o.city ? `${o.title} (${o.city})` : o.title,
      ]),
    );
    return (id: Entry["order_id"]) =>
      id == null ? "–" : (m.get(String(id)) ?? `Auftrag ${id}`);
  }, [orders]);

  // ---------- Monatsliste ----------
  const stb = useMemo(
    () => stbList(month, people, entries, pays, orderTitle, absCtx),
    [month, people, entries, pays, orderTitle, absCtx],
  );
  const monthSplit = useMemo(() => {
    const { from: f, to: t } = monthRange(month);
    const list = entries.filter((e) => {
      const d = e.work_date || (e.started_at ?? "").slice(0, 10);
      return d >= f && d <= t;
    });
    return costSplit(
      list,
      people,
      external.filter(
        (x) => x.invoice_date && x.invoice_date >= f && x.invoice_date <= t,
      ),
    );
  }, [month, entries, people, external]);

  const stbDownload = (kind: "pdf" | "csv") => {
    if (kind === "pdf")
      return download(
        stbPdf(month, stb, company, absCtx),
        `Arbeitsstunden_${month}.pdf`,
      );
    const rows: (string | number)[][] = [
      [
        "Mitarbeiter",
        "Beschäftigung",
        "Datum",
        "Stunden",
        "Aufträge",
        "Hinweis",
        "Abwesenheiten",
      ],
    ];
    for (const r of stb) {
      if (!r.days.length)
        rows.push([
          nameOf(r.person),
          EMPLOYMENT[r.type].short,
          "",
          0,
          "",
          r.note,
          r.absText,
        ]);
      r.days.forEach((d, i) =>
        rows.push([
          nameOf(r.person),
          EMPLOYMENT[r.type].short,
          d.day,
          hours(d.minutes),
          d.orders.join(", "),
          i === 0 ? r.note : "",
          i === 0 ? r.absText : "",
        ]),
      );
      // Abwesenheiten einzeln (für die Lohnabrechnung)
      for (const a of r.absences) {
        const wd = absCtx?.leaves.get(Number(r.person.id))?.work_weekdays ?? DEFAULT_WEEKDAYS;
        const { from: f, to: t } = monthRange(month);
        rows.push([
          nameOf(r.person),
          EMPLOYMENT[r.type].short,
          a.start_date === a.end_date ? a.start_date : `${a.start_date} bis ${a.end_date}`,
          0,
          "",
          `${KINDS[a.kind].label}${a.au_present ? " (AU liegt vor)" : ""}${a.note ? ` – ${a.note}` : ""}`,
          absCtx ? `${countDays(a, wd, absCtx.cal, f, t)} Tage` : "",
        ]);
      }
    }
    download(
      new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }),
      `Arbeitsstunden_${month}.csv`,
    );
  };

  // ---------- Nachweise ----------
  const kind: "leih" | "sub" = tab === "sub" ? "sub" : "leih";
  const candidates = people
    .filter((p) => typeOf(p) === (kind === "leih" ? "leiharbeit" : "sub"))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), "de"));
  const person = candidates.find((p) => p.id === personId) ?? null;
  const pay = person ? (pays.get(Number(person.id)) ?? null) : null;

  const pickPerson = (id: number | "") => {
    setPersonId(id);
    const p = candidates.find((c) => c.id === id);
    const py = p ? pays.get(Number(p.id)) : null;
    // Leiharbeit: Zeitraum = Einsatzbeginn bis Austritt (bzw. heute)
    if (p && kind === "leih") {
      setFrom(py?.assignment_start || monthRange(thisMonth()).from);
      setTo(p.exit_date || ymd(new Date()));
    }
  };

  const rows = useMemo(
    () =>
      person ? proofRows(Number(person.id), entries, from, to, orderTitle) : [],
    [person, entries, from, to, orderTitle],
  );
  const ext = useMemo(
    () =>
      person && kind === "sub"
        ? external
            .filter(
              (x) =>
                Number(x.sub_user_id) === Number(person.id) &&
                (!x.invoice_date ||
                  (x.invoice_date >= from && x.invoice_date <= to)),
            )
            .map((x) => ({ ...x, orderTitle: orderTitle(x.order_id) }))
        : [],
    [person, kind, external, from, to, orderTitle],
  );
  const minutes = rows.reduce((s, r) => s + r.minutes, 0);
  const rate =
    kind === "leih"
      ? (pay?.agency_rate ?? person?.hourly_rate ?? null)
      : pay?.sub_billing === "stunde"
        ? (pay?.sub_rate ?? person?.hourly_rate ?? null)
        : null;

  const proofDownload = (k: "pdf" | "csv") => {
    if (!person) return;
    const base = `${kind === "leih" ? "Stundennachweis" : "Leistungsnachweis"}_${safe(nameOf(person))}_${from}_${to}`;
    if (k === "pdf")
      return download(
        proofPdf({ kind, person, pay, from, to, rows, external: ext, company }),
        `${base}.pdf`,
      );
    const out: (string | number)[][] = [
      [
        "Datum",
        "Auftrag",
        "Von",
        "Bis",
        "Pause (min)",
        "Stunden",
        "nachgetragen",
      ],
    ];
    rows.forEach((r) =>
      out.push([
        r.day,
        r.order,
        r.from,
        r.to,
        r.breakMin,
        hours(r.minutes),
        r.manual ? "ja" : "",
      ]),
    );
    if (ext.length) {
      out.push([]);
      out.push([
        "Rechnungsdatum",
        "Rechnungs-Nr.",
        "Auftrag",
        "Leistung",
        "Netto",
        "§ 13b",
      ]);
      ext.forEach((x) =>
        out.push([
          x.invoice_date ?? "",
          x.invoice_no ?? "",
          x.orderTitle,
          x.description ?? "",
          Number(x.amount_net),
          x.reverse_charge ? "ja" : "",
        ]),
      );
    }
    download(
      new Blob([csv(out)], { type: "text/csv;charset=utf-8" }),
      `${base}.csv`,
    );
  };

  const groups: Group[] = ["own", "leih", "sub"];

  return (
    <section
      className={
        embedded ? "st-root st-embedded" : "single-page-section st-root"
      }
    >
      <div className={embedded ? "" : "card form-page-card st-page"}>
        <div className="page-topbar">
          <div>
            <h2>Löhne & Nachweise</h2>
            <p>
              Monatsliste für den Steuerberater, Stundennachweis für die
              Zeitarbeitsfirma, Leistungsnachweis für Subunternehmer.
            </p>
          </div>
          <div className="st-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDialog(true)}
            >
              🕒 Stunden nachtragen
            </button>
            {onBack && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onBack}
              >
                Zurück
              </button>
            )}
          </div>
        </div>

        {error && <p className="st-msg err">{error}</p>}
        {msg && <p className="st-msg ok">{msg}</p>}

        <div className="st-tabs">
          {(
            [
              ["stb", "Monatsliste Steuerberater"],
              ["leih", "Stundennachweis Zeitarbeitsfirma"],
              ["sub", "Leistungsnachweis Subunternehmer"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? "on" : ""}
              onClick={() => {
                setTab(k);
                setPersonId("");
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="st-empty">Lädt …</p>
        ) : tab === "stb" ? (
          <>
            <div className="st-bar">
              <label className="st-field">
                <span>Monat</span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => e.target.value && setMonth(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => stbDownload("pdf")}
                disabled={!stb.length}
              >
                PDF herunterladen
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => stbDownload("csv")}
                disabled={!stb.length}
              >
                CSV (Excel)
              </button>
            </div>

            <div className="st-split">
              {groups.map((g) => (
                <div key={g} className={monthSplit[g].minutes ? "" : "zero"}>
                  <span>{GROUP_LABELS[g]}</span>
                  <b>{fmtMoney(monthSplit[g].cost, cur)}</b>
                  <small>{fmtH(monthSplit[g].minutes)} Std.</small>
                </div>
              ))}
              <div className={monthSplit.external ? "" : "zero"}>
                <span>Fremdleistungen</span>
                <b>{fmtMoney(monthSplit.external, cur)}</b>
                <small>nach Rechnungsdatum</small>
              </div>
              <div className="sum">
                <span>Gesamt {monthLabel(month)}</span>
                <b>{fmtMoney(monthSplit.total, cur)}</b>
                <small>Personal + Fremdleistungen</small>
              </div>
            </div>

            {stb.length === 0 ? (
              <p className="st-empty">Kein eigenes Personal angelegt.</p>
            ) : (
              <table className="st-table">
                <thead>
                  <tr>
                    <th>Mitarbeiter</th>
                    <th>Beschäftigung</th>
                    <th className="r">Tage</th>
                    <th className="r">Stunden</th>
                    <th>Abwesend</th>
                    <th>Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {stb.map((r) => (
                    <tr key={r.person.id}>
                      <td>{nameOf(r.person)}</td>
                      <td>{EMPLOYMENT[r.type].short}</td>
                      <td className="r">{r.days.length}</td>
                      <td className="r">{fmtH(r.minutes)}</td>
                      <td title={r.absences.map((a) => `${KINDS[a.kind].label} ${a.start_date}${a.end_date !== a.start_date ? ` – ${a.end_date}` : ""}${a.au_present ? " (AU)" : ""}`).join("\n")}>
                        {absCtx ? r.absText || "–" : <small>Urlaub-SQL fehlt</small>}
                      </td>
                      <td className={r.note.includes("ACHTUNG") ? "warn" : ""}>
                        {r.note || "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="st-small">
              Soll-Stunden aus den Wochenstunden im Mitarbeiter-Formular – an den
              Arbeitstagen der Person, ohne Feiertage, Urlaub, Krankheit und andere
              Abwesenheiten (Überstundenabbau zählt nicht ab). Abwesend in
              Arbeitstagen. Die Lohnabrechnung selbst macht Ihr Steuerberater.
            </p>
          </>
        ) : (
          <>
            <div className="st-bar">
              <label className="st-field">
                <span>
                  {kind === "leih" ? "Leiharbeiter" : "Subunternehmer"}
                </span>
                <select
                  value={personId}
                  onChange={(e) =>
                    pickPerson(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Bitte wählen</option>
                  {candidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nameOf(p)}
                      {kind === "leih" && pays.get(Number(p.id))?.agency_name
                        ? ` – ${pays.get(Number(p.id))?.agency_name}`
                        : ""}
                      {kind === "sub" && pays.get(Number(p.id))?.sub_company
                        ? ` – ${pays.get(Number(p.id))?.sub_company}`
                        : ""}
                      {p.is_active === false ? " (ausgeschieden)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="st-field">
                <span>Von</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="st-field">
                <span>Bis</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => proofDownload("pdf")}
                disabled={!person}
              >
                PDF herunterladen
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => proofDownload("csv")}
                disabled={!person}
              >
                CSV (Excel)
              </button>
            </div>
            <div className="st-presets">
              {(
                [
                  ["week", "Diese Woche"],
                  ["lastweek", "Letzte Woche"],
                  ["month", "Dieser Monat"],
                  ["lastmonth", "Letzter Monat"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    const r = presetRange(k);
                    setFrom(r.from);
                    setTo(r.to);
                  }}
                >
                  {l}
                </button>
              ))}
              {kind === "leih" && pay?.assignment_start && (
                <button
                  type="button"
                  onClick={() => {
                    setFrom(pay.assignment_start!);
                    setTo(person?.exit_date || ymd(new Date()));
                  }}
                >
                  Ganzer Einsatz
                </button>
              )}
            </div>

            {candidates.length === 0 ? (
              <p className="st-empty">
                Noch keine {kind === "leih" ? "Leiharbeiter" : "Subunternehmer"}{" "}
                angelegt (Mitarbeiter anlegen → Beschäftigungsart).
              </p>
            ) : !person ? (
              <table className="st-table st-overview">
                <thead>
                  <tr>
                    <th>
                      {kind === "leih" ? "Leiharbeiter" : "Subunternehmer"}
                    </th>
                    <th>{kind === "leih" ? "Zeitarbeitsfirma" : "Firma"}</th>
                    <th className="r">Stunden im Zeitraum</th>
                    <th className="r">Betrag netto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const py = pays.get(Number(c.id));
                    const mins = proofRows(
                      Number(c.id),
                      entries,
                      from,
                      to,
                      orderTitle,
                    ).reduce((sum, r) => sum + r.minutes, 0);
                    const r =
                      kind === "leih"
                        ? (py?.agency_rate ?? c.hourly_rate)
                        : py?.sub_billing === "stunde"
                          ? (py?.sub_rate ?? c.hourly_rate)
                          : null;
                    const extSum =
                      kind === "sub"
                        ? external
                            .filter(
                              (x) =>
                                Number(x.sub_user_id) === Number(c.id) &&
                                (!x.invoice_date ||
                                  (x.invoice_date >= from &&
                                    x.invoice_date <= to)),
                            )
                            .reduce((sum, x) => sum + Number(x.amount_net), 0)
                        : 0;
                    return (
                      <tr key={c.id}>
                        <td>
                          {nameOf(c)}
                          {c.is_active === false && (
                            <small>ausgeschieden</small>
                          )}
                        </td>
                        <td>
                          {(kind === "leih"
                            ? py?.agency_name
                            : py?.sub_company) || "–"}
                        </td>
                        <td className="r">{fmtH(mins)}</td>
                        <td className="r">
                          {fmtMoney(
                            (r != null ? hours(mins) * r : 0) + extSum,
                            cur,
                          )}
                        </td>
                        <td className="r">
                          <button
                            type="button"
                            className="st-link"
                            onClick={() => pickPerson(c.id)}
                          >
                            Nachweis öffnen →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <>
                <div className="st-split">
                  <div>
                    <span>Stunden im Zeitraum</span>
                    <b>{fmtH(minutes)} Std.</b>
                    <small>
                      {rows.length === 1
                        ? "1 Eintrag"
                        : `${rows.length} Einträge`}
                    </small>
                  </div>
                  {rate != null && (
                    <div>
                      <span>Betrag netto</span>
                      <b>{fmtMoney(hours(minutes) * rate, cur)}</b>
                      <small>
                        {fmtH(minutes)} Std. × {fmtMoney(rate, cur)}
                      </small>
                    </div>
                  )}
                  {kind === "sub" && (
                    <div>
                      <span>Fremdleistungen</span>
                      <b>
                        {fmtMoney(
                          ext.reduce((s, x) => s + Number(x.amount_net), 0),
                          cur,
                        )}
                      </b>
                      <small>{ext.length} Rechnung(en)</small>
                    </div>
                  )}
                </div>
                {rows.length === 0 ? (
                  <p className="st-empty">
                    Im Zeitraum sind keine Stunden erfasst. Stunden für Personen
                    ohne App tragen Sie mit „+ Stunden nachtragen“ ein.
                  </p>
                ) : (
                  <table className="st-table">
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Auftrag</th>
                        <th>Zeit</th>
                        <th className="r">Pause</th>
                        <th className="r">Stunden</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byWeek(rows).map((w) => (
                        <Fragment key={w.key}>
                          {w.rows.map((r, i) => (
                            <tr key={`${w.key}-${i}`}>
                              <td>{deDate(r.day)}</td>
                              <td>
                                {r.order}
                                {r.source !== "self" && (
                                  <small>{SOURCE_LABELS[r.source]}</small>
                                )}
                              </td>
                              <td>
                                {r.from}–{r.to}
                              </td>
                              <td className="r">
                                {r.breakMin ? `${r.breakMin} min` : "–"}
                              </td>
                              <td className="r">{fmtH(r.minutes)}</td>
                            </tr>
                          ))}
                          {byWeek(rows).length > 1 && (
                            <tr className="st-week">
                              <td colSpan={4}>Summe {w.label}</td>
                              <td className="r">{fmtH(w.minutes)}</td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
                {ext.length > 0 && (
                  <table className="st-table">
                    <thead>
                      <tr>
                        <th>Rechnung</th>
                        <th>Auftrag</th>
                        <th>Leistung</th>
                        <th className="r">Netto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ext.map((x) => (
                        <tr key={x.id}>
                          <td>
                            {x.invoice_no || "–"}
                            <small>
                              {x.invoice_date
                                ? new Date(
                                    `${x.invoice_date}T12:00:00`,
                                  ).toLocaleDateString("de-DE")
                                : ""}
                            </small>
                          </td>
                          <td>{x.orderTitle}</td>
                          <td>{x.description || "–"}</td>
                          <td className="r">
                            {fmtMoney(Number(x.amount_net), cur)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="st-small">
                  {kind === "leih"
                    ? "Das PDF enthält Unterschriftsfelder für Sie und die Zeitarbeitsfirma – damit prüfen Sie deren Rechnung."
                    : "Das PDF dient zum Abgleich mit der Rechnung des Subunternehmers. Fremdleistungen tragen Sie am Auftrag ein (Auftrag bearbeiten → Stunden & Kosten)."}
                </p>
              </>
            )}
          </>
        )}
      </div>

      {dialog && (
        <ManualTimeDialog
          people={people}
          orders={orders.filter(
            (o) => !["abgerechnet", "storniert"].includes(o.status),
          )}
          defaultUserId={typeof personId === "number" ? personId : undefined}
          onSaved={async (text) => {
            setDialog(false);
            setMsg(text);
            await load();
          }}
          onClose={() => setDialog(false)}
        />
      )}
    </section>
  );
}
