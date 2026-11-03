import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Website, WebsiteBooking } from "./types";
import { BOOKING_TIMEZONES, BOOKING_WEEKDAYS, DEFAULT_BOOKING } from "./types";

type Week = Record<string, [string, string][]>;
type Upcoming = { id: number; starts_at: string; contact_name: string | null; location: string | null; status: string };

const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));
const copyWeek = (w: Week | undefined): Week => {
  const out: Week = {};
  for (const d of BOOKING_WEEKDAYS) out[d.key] = [...(w?.[d.key] ?? [])].map((x) => [x[0], x[1]] as [string, string]);
  return out;
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Website → Termine: Online-Buchung von Besichtigungen einschalten und Zeiten festlegen.
 * Die Termine landen im Terminkalender (Quelle „Website“); belegte Zeiten werden automatisch freigehalten.
 */
export default function BookingTab({
  tenantId,
  website,
  saving,
  onSave,
}: {
  tenantId: number;
  website: Website;
  saving: boolean;
  onSave: (values: Partial<Website>) => void;
}) {
  const b: WebsiteBooking = { ...DEFAULT_BOOKING, ...(website.booking ?? {}) };
  const [enabled, setEnabled] = useState(b.enabled);
  const [duration, setDuration] = useState(b.visit_duration_minutes);
  const [buffer, setBuffer] = useState(b.buffer_minutes);
  const [notice, setNotice] = useState(b.min_notice_hours);
  const [horizon, setHorizon] = useState(b.booking_horizon_days);
  const [step, setStep] = useState(b.slot_step_minutes);
  const [timezone, setTimezone] = useState(b.timezone);
  const [week, setWeek] = useState<Week>(() => copyWeek(b.availability));
  const [phoneSettings, setPhoneSettings] = useState<WebsiteBooking | null>(null);
  const [upcoming, setUpcoming] = useState<Upcoming[] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const supported = website.booking !== undefined;

  // KI-Telefon-Einstellungen (falls vorhanden) zum Übernehmen + kommende Online-Buchungen
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("ai_phone_settings")
      .select("timezone, visit_duration_minutes, buffer_minutes, min_notice_hours, booking_horizon_days, slot_step_minutes, availability")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then(({ data }) => !cancelled && data && setPhoneSettings({ ...DEFAULT_BOOKING, ...(data as Partial<WebsiteBooking>) }));
    supabase
      .from("appointments")
      .select("id, starts_at, contact_name, location, status")
      .eq("tenant_id", tenantId)
      .eq("source", "website")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10)
      .then(({ data }) => !cancelled && setUpcoming((data as Upcoming[]) ?? []));
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const takeFromPhone = () => {
    if (!phoneSettings) return;
    setDuration(phoneSettings.visit_duration_minutes);
    setBuffer(phoneSettings.buffer_minutes);
    setNotice(phoneSettings.min_notice_hours);
    setHorizon(Math.min(60, phoneSettings.booking_horizon_days));
    setStep(phoneSettings.slot_step_minutes);
    setTimezone(phoneSettings.timezone);
    setWeek(copyWeek(phoneSettings.availability));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const updateWindow = (day: string, idx: number, pos: 0 | 1, value: string) =>
    setWeek((prev) => {
      const next = { ...prev, [day]: prev[day].map((w) => [w[0], w[1]] as [string, string]) };
      next[day][idx][pos] = value;
      return next;
    });
  const addWindow = (day: string) =>
    setWeek((prev) => ({ ...prev, [day]: [...prev[day], prev[day].length === 0 ? ["09:00", "12:00"] : ["13:00", "17:00"]] }));
  const removeWindow = (day: string, idx: number) => setWeek((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== idx) }));

  const submit = () => {
    setError("");
    for (const d of BOOKING_WEEKDAYS) {
      for (const [from, to] of week[d.key]) {
        if (!from || !to || from >= to) return setError(`${d.label}: Bitte gültige Zeiten eintragen (Beginn vor Ende).`);
      }
    }
    if (enabled && !Object.values(week).some((w) => w.length > 0)) return setError("Bitte mindestens ein Zeitfenster eintragen.");
    onSave({
      booking: {
        enabled,
        visit_duration_minutes: duration,
        buffer_minutes: buffer,
        min_notice_hours: notice,
        booking_horizon_days: horizon,
        slot_step_minutes: step,
        timezone,
        availability: week,
      },
    });
  };

  if (!supported) {
    return (
      <div className="tk-notice tk-notice-info">
        Für die Online-Terminbuchung fehlt noch ein Datenbank-Update (20261103220000_website_terminbuchung.sql). Danach erscheint hier die Einstellung.
      </div>
    );
  }

  return (
    <div className="ws-stack">
      <section className="ws-panel">
        <h3>Besichtigungstermin online buchen</h3>
        <p className="tk-muted ws-dom-intro">
          Kunden wählen auf Ihrer Website selbst einen freien Termin für eine kostenlose Besichtigung. Der Termin steht sofort in Ihrem Terminkalender
          (mit 🌐 markiert), Sie bekommen eine E-Mail und der Kunde eine Bestätigung. Zeiten, die im Kalender schon belegt sind, werden automatisch
          freigehalten – auch Termine vom KI-Telefon.
        </p>
        <label className="tk-field ws-check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>
            <strong>Online-Buchung auf der Website anzeigen</strong>
          </span>
        </label>
        {enabled && !website.published && <p className="tk-muted">Hinweis: Buchen kann man erst, wenn die Website veröffentlicht ist.</p>}
      </section>

      <section className="ws-panel">
        <div className="ws-row ws-bk-head">
          <h3>Zeiten für Besichtigungen</h3>
          {phoneSettings && (
            <button type="button" className="btn btn-secondary btn-small" onClick={takeFromPhone}>
              {copied ? "Übernommen ✓ – bitte speichern" : "Vom KI-Telefon übernehmen"}
            </button>
          )}
        </div>
        <div className="ws-bk-grid">
          <label className="tk-field">
            <span>Dauer (Minuten)</span>
            <input type="number" min={15} max={480} step={15} value={duration} onChange={(e) => setDuration(num(e.target.value, 15, 480))} />
          </label>
          <label className="tk-field">
            <span>Puffer davor/danach (Min.)</span>
            <input type="number" min={0} max={240} step={15} value={buffer} onChange={(e) => setBuffer(num(e.target.value, 0, 240))} />
          </label>
          <label className="tk-field">
            <span>Startzeiten</span>
            <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
              {[15, 30, 60].map((n) => (
                <option key={n} value={n}>
                  alle {n} Minuten
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field">
            <span>Frühestens in (Stunden)</span>
            <input type="number" min={0} max={336} value={notice} onChange={(e) => setNotice(num(e.target.value, 0, 336))} />
          </label>
          <label className="tk-field">
            <span>Höchstens Tage im Voraus</span>
            <input type="number" min={1} max={60} value={horizon} onChange={(e) => setHorizon(num(e.target.value, 1, 60))} />
          </label>
          <label className="tk-field">
            <span>Zeitzone</span>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {BOOKING_TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h4 className="ws-bk-sub">An welchen Tagen und zu welchen Zeiten?</h4>
        <div className="ws-bk-week">
          {BOOKING_WEEKDAYS.map((d) => (
            <div key={d.key} className="ws-bk-day">
              <strong>{d.label}</strong>
              <div className="ws-bk-windows">
                {week[d.key].length === 0 && <span className="tk-muted">keine Besichtigungen</span>}
                {week[d.key].map((w, i) => (
                  <span key={i} className="ws-bk-window">
                    <input type="time" value={w[0]} onChange={(e) => updateWindow(d.key, i, 0, e.target.value)} aria-label={`${d.label} von`} />
                    <span>–</span>
                    <input type="time" value={w[1]} onChange={(e) => updateWindow(d.key, i, 1, e.target.value)} aria-label={`${d.label} bis`} />
                    <button type="button" className="tk-icon-btn ws-bk-x" onClick={() => removeWindow(d.key, i)} aria-label="Zeitfenster entfernen">
                      ×
                    </button>
                  </span>
                ))}
                {week[d.key].length < 3 && (
                  <button type="button" className="ws-link" onClick={() => addWindow(d.key)}>
                    + Zeitfenster
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {error && <div className="tk-notice tk-notice-error">{error}</div>}
        <div className="ws-row ws-bk-save">
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Speichert …" : "Einstellungen speichern"}
          </button>
        </div>
      </section>

      <section className="ws-panel">
        <h3>Nächste Online-Buchungen</h3>
        {upcoming === null ? (
          <p className="tk-muted">Wird geladen …</p>
        ) : upcoming.length === 0 ? (
          <p className="tk-muted">Noch keine. Gebuchte Termine finden Sie auch im Terminkalender.</p>
        ) : (
          <ul className="ws-bk-list">
            {upcoming.map((a) => (
              <li key={a.id} className={a.status === "abgesagt" ? "off" : ""}>
                <strong>{when(a.starts_at)}</strong>
                <span>{a.contact_name}</span>
                <span className="tk-muted">{a.location}</span>
                {a.status === "abgesagt" && <span className="tk-muted">abgesagt</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
