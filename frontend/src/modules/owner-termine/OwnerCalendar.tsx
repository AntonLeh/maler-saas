// Owner: Terminkalender (Monat · Woche · Liste), Steuerfristen, Abo-Link fürs Handy
import { useEffect, useMemo, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import { loadContacts } from "../owner-kontakte/api";
import * as api from "./api";
import * as L from "./logic";
import type { Appointment, Occurrence } from "./logic";
import AppointmentDialog from "./AppointmentDialog";
import "./ot.css";

type View = "month" | "week" | "list";
type ContactOption = { id: number; organisation: string; city: string | null };
type Panel = { type: "edit"; appt: Appointment | null; date?: Date } | { type: "feed" } | { type: "tax" } | null;

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function readView(): View {
  try {
    const v = localStorage.getItem("ot-view");
    return v === "week" || v === "list" ? v : "month";
  } catch {
    return "month";
  }
}

export default function OwnerCalendar({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [view, setViewState] = useState<View>(readView);
  const [cursor, setCursor] = useState(() => L.startOfDay(new Date()));
  const [panel, setPanel] = useState<Panel>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [taxYear, setTaxYear] = useState(new Date().getMonth() >= 10 ? new Date().getFullYear() + 1 : new Date().getFullYear());
  const [withReceipts, setWithReceipts] = useState(true);
  const [busy, setBusy] = useState(false);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem("ot-view", v);
    } catch {
      /* egal */
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      setList(await api.loadAppointments());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    loadContacts()
      .then((c) => setContacts(c.filter((x) => !x.blocked).map((x) => ({ id: x.id, organisation: x.organisation, city: x.city }))))
      .catch(() => setContacts([]));
  }, []);

  const today = L.startOfDay(new Date());
  const range = useMemo(() => {
    if (view === "month") {
      const g = L.monthGrid(cursor);
      return { from: g[0], to: L.addDays(g[41], 1) };
    }
    if (view === "week") {
      const s = L.weekStart(cursor);
      return { from: s, to: L.addDays(s, 7) };
    }
    return { from: today, to: L.addMonths(today, 6) };
  }, [view, cursor, today.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const occ = useMemo(() => L.expand(list, range.from, range.to), [list, range]);
  const contactName = (id: number | null) => (id ? contacts.find((c) => c.id === id)?.organisation ?? "" : "");

  const move = (dir: number) => {
    if (view === "month") setCursor(L.addMonths(new Date(cursor.getFullYear(), cursor.getMonth(), 1), dir));
    else if (view === "week") setCursor(L.addDays(cursor, 7 * dir));
    else setCursor(today);
  };

  const heading =
    view === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === "week"
        ? (() => {
            const s = L.weekStart(cursor);
            const e = L.addDays(s, 6);
            return `${s.toLocaleDateString("de-DE", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}`;
          })()
        : "Nächste 6 Monate";

  const openNew = (date?: Date) => setPanel({ type: "edit", appt: null, date: date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0) : undefined });
  const openOcc = (o: Occurrence) => setPanel({ type: "edit", appt: o.appt });

  // ---------- Abo-Link ----------
  const openFeed = async () => {
    setPanel({ type: "feed" });
    try {
      setToken(await api.loadFeedToken());
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const newToken = async () => {
    if (token && !(await showConfirm("Neuen Link erzeugen? Der bisherige Link funktioniert danach nicht mehr – Sie müssen den Kalender im Handy neu abonnieren.", { confirmLabel: "Neuer Link" })))
      return;
    try {
      setToken(await api.createFeedToken());
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Link kopiert.");
    } catch {
      setMsg("Kopieren nicht möglich – bitte den Link markieren und kopieren.");
    }
  };

  // ---------- Steuerfristen ----------
  const taxList = L.taxDeadlines(taxYear);
  const taxExists = (d: Date) => list.some((a) => a.kind === "steuer" && L.sameDay(new Date(a.starts_at), d));
  const receiptsExist = list.some((a) => a.kind === "gestoria" && a.recur === "monthly");
  const addTax = async () => {
    const rows: Partial<Appointment>[] = taxList
      .filter((t) => !taxExists(t.date))
      .map((t) => ({ title: t.title, kind: "steuer", all_day: true, starts_at: t.date.toISOString(), ends_at: t.date.toISOString(), notes: t.notes, recur: "none" }));
    if (withReceipts && !receiptsExist) {
      const n = new Date();
      const r = L.receiptReminder(n.getFullYear(), n.getDate() > 5 ? n.getMonth() + 1 : n.getMonth());
      rows.push({ title: r.title, kind: "gestoria", all_day: true, starts_at: r.date.toISOString(), ends_at: r.date.toISOString(), notes: r.notes, recur: "monthly" });
    }
    if (!rows.length) return setMsg("Diese Fristen sind schon eingetragen.");
    setBusy(true);
    try {
      const n = await api.insertMany(rows);
      setMsg(`${n} Termine eingetragen.`);
      setPanel(null);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const chip = (o: Occurrence, compact = false) => {
    const k = L.KINDS[o.appt.kind] ?? L.KINDS.sonstiges;
    return (
      <button
        key={o.key}
        type="button"
        className={`ot-chip${o.appt.all_day ? " allday" : ""}`}
        style={o.appt.all_day ? { background: k.color, color: "#fff" } : { background: k.bg, color: k.color, borderLeftColor: k.color }}
        onClick={(e) => {
          e.stopPropagation();
          openOcc(o);
        }}
        title={`${L.timeLabel(o)} · ${o.appt.title}`}
      >
        {!o.appt.all_day && !compact && <b>{L.hm(o.start)}</b>} {o.appt.title}
      </button>
    );
  };

  const feed = token ? api.feedUrl(token) : "";

  return (
    <section className="single-page-section ot-root">
      <div className="card form-page-card ot-main">
        <div className="ot-top">
          <div>
            <h2>Meine Termine</h2>
            <p>Innungen, Vorführungen, Gestoría, Steuer-Fristen – nur für Sie sichtbar.</p>
          </div>
          <div className="ot-actions">
            <button type="button" className="btn btn-primary" onClick={() => openNew()}>
              + Termin
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPanel({ type: "tax" })}>
              🧾 Steuerfristen
            </button>
            <button type="button" className="btn btn-secondary" onClick={openFeed}>
              📱 Aufs Handy
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        {error && <p className="ot-msg err">{error}</p>}
        {msg && (
          <p className="ot-msg ok" onClick={() => setMsg("")}>
            {msg}
          </p>
        )}

        {panel?.type === "edit" && (
          <AppointmentDialog
            key={panel.appt?.id ?? `neu-${panel.date?.getTime() ?? 0}`}
            appt={panel.appt}
            defaults={{ date: panel.date }}
            contacts={contacts}
            onSaved={(a) => {
              setList((p) => (p.some((x) => x.id === a.id) ? p.map((x) => (x.id === a.id ? a : x)) : [...p, a]));
              setPanel(null);
              setMsg("Termin gespeichert.");
            }}
            onDeleted={(id) => {
              setList((p) => p.filter((x) => x.id !== id));
              setPanel(null);
            }}
            onClose={() => setPanel(null)}
          />
        )}

        {panel?.type === "feed" && (
          <div className="ot-dialog">
            <div className="ot-dialog-head">
              <h3>📱 Termine aufs Handy</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setPanel(null)}>
                Schließen
              </button>
            </div>
            <p className="ot-small">
              Mit diesem privaten Link abonniert Ihr Handy-Kalender Ihre Termine. Neue und geänderte Termine erscheinen dort automatisch (je nach Kalender nach einigen Minuten bis
              wenigen Stunden), mit der normalen Erinnerung Ihres Handys. Den Link bitte niemandem weitergeben.
            </p>
            {!token ? (
              <button type="button" className="btn btn-primary" onClick={newToken}>
                Privaten Abo-Link erstellen
              </button>
            ) : (
              <>
                <div className="ot-feed">
                  <input readOnly value={feed} onFocus={(e) => e.target.select()} />
                  <button type="button" className="btn btn-primary" onClick={() => copy(feed)}>
                    Kopieren
                  </button>
                </div>
                <div className="ot-howto">
                  <div>
                    <h4>iPhone</h4>
                    <ol>
                      <li>
                        <a href={feed.replace(/^https:/, "webcal:")}>Hier tippen</a> (auf dem iPhone) → „Abonnieren“.
                      </li>
                      <li>Oder: Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → „Kalenderabo hinzufügen“ → Link einfügen.</li>
                    </ol>
                  </div>
                  <div>
                    <h4>Android / Google Kalender</h4>
                    <ol>
                      <li>Am Computer calendar.google.com öffnen.</li>
                      <li>Links bei „Weitere Kalender“ auf „+“ → „Per URL“ → Link einfügen → „Kalender hinzufügen“.</li>
                      <li>Der Kalender erscheint danach auch in der Google-Kalender-App auf dem Handy.</li>
                    </ol>
                  </div>
                </div>
                <p className="ot-small">
                  Hinweis: Der Abo-Kalender ist nur zum Ansehen. Termine legen Sie hier im Dashboard an. Google aktualisiert Abos nur alle paar Stunden, das iPhone je nach Einstellung
                  (Einstellungen → Kalender → Accounts → Abrufen).{" "}
                  <button type="button" className="ot-link" onClick={newToken}>
                    Neuen Link erzeugen
                  </button>{" "}
                  (z. B. wenn der Link in falsche Hände geraten ist).
                </p>
              </>
            )}
          </div>
        )}

        {panel?.type === "tax" && (
          <div className="ot-dialog">
            <div className="ot-dialog-head">
              <h3>🧾 Steuerfristen Spanien (Autónomo)</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setPanel(null)}>
                Schließen
              </button>
            </div>
            <div className="ot-row">
              <label className="ot-field inline">
                Jahr
                <select value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))}>
                  {[0, 1, 2].map((d) => (
                    <option key={d} value={new Date().getFullYear() + d}>
                      {new Date().getFullYear() + d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="ot-tax">
              {taxList.map((t) => (
                <li key={t.title}>
                  <b>{t.date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</b>
                  <span>{t.title}</span>
                  {taxExists(t.date) && <em>✓ schon eingetragen</em>}
                </li>
              ))}
            </ul>
            <label className="ot-check">
              <input type="checkbox" checked={withReceipts} disabled={receiptsExist} onChange={(e) => setWithReceipts(e.target.checked)} />
              Zusätzlich jeden Monat am 5.: „Belege des Vormonats an Gestoría“ {receiptsExist && "(schon eingetragen)"}
            </label>
            <p className="ot-small">
              Fristen: 1.–20. April, Juli, Oktober und 1.–30. Januar. Fällt der letzte Tag aufs Wochenende, gilt der nächste Werktag. Bei Lastschrift (domiciliación) endet die Frist 5 Tage
              früher. Feiertage und Änderungen bitte mit der Gestoría abgleichen.
            </p>
            <button type="button" className="btn btn-primary" onClick={addTax} disabled={busy}>
              {busy ? "Trägt ein …" : "In den Kalender eintragen"}
            </button>
          </div>
        )}

        <div className="ot-bar">
          <div className="ot-nav">
            <button type="button" className="btn btn-secondary" onClick={() => move(-1)} disabled={view === "list"} aria-label="Zurück">
              ‹
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setCursor(L.startOfDay(new Date()))}>
              Heute
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => move(1)} disabled={view === "list"} aria-label="Weiter">
              ›
            </button>
            <h3>{heading}</h3>
          </div>
          <div className="ot-seg">
            {(
              [
                ["month", "Monat"],
                ["week", "Woche"],
                ["list", "Liste"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" className={view === k ? "on" : ""} onClick={() => setView(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="ot-empty">Lädt …</p>
        ) : view === "month" ? (
          <div className="ot-month">
            {L.WEEKDAYS.map((d) => (
              <div key={d} className="ot-wd">
                {d}
              </div>
            ))}
            {L.monthGrid(cursor).map((d) => {
              const items = L.onDay(occ, d);
              const other = d.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={d.toISOString()}
                  className={`ot-day${other ? " other" : ""}${L.sameDay(d, today) ? " today" : ""}${d.getDay() === 0 || d.getDay() === 6 ? " we" : ""}`}
                  onClick={() => {
                    // Handy: Tag mit Terminen → Wochenansicht (Balken sind zum Antippen zu klein)
                    if (items.length && window.matchMedia("(max-width: 640px)").matches) {
                      setCursor(d);
                      setView("week");
                    } else openNew(d);
                  }}
                >
                  <span className="ot-num">{d.getDate()}</span>
                  {items.slice(0, 3).map((o) => chip(o))}
                  {items.length > 3 && (
                    <button
                      type="button"
                      className="ot-more"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCursor(d);
                        setView("week");
                      }}
                    >
                      +{items.length - 3} weitere
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : view === "week" ? (
          <div className="ot-week">
            {Array.from({ length: 7 }, (_, i) => L.addDays(L.weekStart(cursor), i)).map((d) => {
              const items = L.onDay(occ, d);
              return (
                <div key={d.toISOString()} className={`ot-wcol${L.sameDay(d, today) ? " today" : ""}`}>
                  <div className="ot-whead">
                    <span>{L.WEEKDAYS[(d.getDay() + 6) % 7]}</span>
                    <b>{d.getDate()}.</b>
                    <button type="button" className="ot-add" onClick={() => openNew(d)} aria-label="Termin an diesem Tag">
                      +
                    </button>
                  </div>
                  {items.length === 0 && <p className="ot-none">–</p>}
                  {items.map((o) => {
                    const k = L.KINDS[o.appt.kind] ?? L.KINDS.sonstiges;
                    return (
                      <button key={o.key} type="button" className="ot-wcard" style={{ borderLeftColor: k.color }} onClick={() => openOcc(o)}>
                        <small style={{ color: k.color }}>{L.timeLabel(o)}</small>
                        <b>{o.appt.title}</b>
                        {o.appt.location && <span>📍 {o.appt.location}</span>}
                        {o.appt.contact_id && <span>👥 {contactName(o.appt.contact_id)}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : occ.length === 0 ? (
          <div className="ot-empty">Keine Termine in den nächsten 6 Monaten. Mit „+ Termin“ legen Sie den ersten an, mit „🧾 Steuerfristen“ die Fristen fürs Jahr.</div>
        ) : (
          <div className="ot-list">
            {Object.entries(
              occ.reduce<Record<string, Occurrence[]>>((acc, o) => {
                (acc[L.ymd(o.start)] ??= []).push(o);
                return acc;
              }, {})
            ).map(([day, items]) => (
              <div key={day} className="ot-lday">
                <h4 className={day === L.ymd(today) ? "today" : ""}>
                  {L.parseLocal(day, "12:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  {day === L.ymd(today) && " · heute"}
                </h4>
                {items.map((o) => {
                  const k = L.KINDS[o.appt.kind] ?? L.KINDS.sonstiges;
                  return (
                    <button key={o.key} type="button" className="ot-lrow" onClick={() => openOcc(o)}>
                      <span className="ot-time">{L.timeLabel(o)}</span>
                      <span className="ot-dot" style={{ background: k.color }} />
                      <span className="ot-ltext">
                        <b>{o.appt.title}</b>
                        <small>
                          {k.label}
                          {o.appt.location ? ` · ${o.appt.location}` : ""}
                          {o.appt.contact_id ? ` · ${contactName(o.appt.contact_id)}` : ""}
                          {o.appt.recur !== "none" ? ` · ${L.RECUR_LABELS[o.appt.recur]}` : ""}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="ot-legend">
          {(Object.keys(L.KINDS) as L.Kind[]).map((k) => (
            <span key={k}>
              <i style={{ background: L.KINDS[k].color }} />
              {L.KINDS[k].label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
