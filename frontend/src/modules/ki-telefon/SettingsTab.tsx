import { useState } from "react";
import type { AiPhoneSettings, WeekAvailability } from "./types";
import { TIMEZONES, WEEKDAYS } from "./types";

type Props = {
  settings: AiPhoneSettings;
  saving: boolean;
  onSave: (values: Partial<AiPhoneSettings>) => void;
};

const KI_HINT = /\b(ki|künstliche|digital|automatisch|virtuell)/i;

export default function SettingsTab({ settings, saving, onSave }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [companyName, setCompanyName] = useState(settings.company_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(settings.phone_number ?? "");
  const [greeting, setGreeting] = useState(settings.greeting ?? "");
  const [instructions, setInstructions] = useState(settings.assistant_instructions ?? "");
  const [timezone, setTimezone] = useState(settings.timezone);
  const [duration, setDuration] = useState(settings.visit_duration_minutes);
  const [buffer, setBuffer] = useState(settings.buffer_minutes);
  const [notice, setNotice] = useState(settings.min_notice_hours);
  const [horizon, setHorizon] = useState(settings.booking_horizon_days);
  const [step, setStep] = useState(settings.slot_step_minutes);
  const [availability, setAvailability] = useState<WeekAvailability>(() => {
    const copy: WeekAvailability = {};
    for (const d of WEEKDAYS) copy[d.key] = [...(settings.availability?.[d.key] ?? [])].map((w) => [w[0], w[1]]);
    return copy;
  });
  const [error, setError] = useState("");

  const greetingMissingHint = greeting.trim() !== "" && !KI_HINT.test(greeting);

  const updateWindow = (day: string, idx: number, pos: 0 | 1, value: string) =>
    setAvailability((prev) => {
      const next = { ...prev, [day]: prev[day].map((w) => [w[0], w[1]] as [string, string]) };
      next[day][idx][pos] = value;
      return next;
    });

  const addWindow = (day: string) =>
    setAvailability((prev) => ({
      ...prev,
      [day]: [...prev[day], prev[day].length === 0 ? ["09:00", "12:00"] : ["13:00", "17:00"]],
    }));

  const removeWindow = (day: string, idx: number) =>
    setAvailability((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== idx) }));

  const submit = () => {
    setError("");
    for (const d of WEEKDAYS) {
      for (const [from, to] of availability[d.key]) {
        if (!from || !to || from >= to) {
          return setError(`${d.label}: Bitte gültige Zeiten eintragen (Beginn vor Ende).`);
        }
      }
    }
    if (greetingMissingHint) {
      return setError(
        "Die Begrüßung muss klar sagen, dass der Anrufer mit einer KI spricht (z. B. „digitaler KI-Assistent“). Das ist seit August 2026 Pflicht."
      );
    }
    if (enabled && !Object.values(availability).some((w) => w.length > 0)) {
      return setError("Bitte mindestens ein Zeitfenster für Besichtigungen eintragen.");
    }
    onSave({
      enabled,
      company_name: companyName.trim() || null,
      phone_number: phoneNumber.trim() || null,
      greeting: greeting.trim() || null,
      assistant_instructions: instructions.trim() || null,
      timezone,
      visit_duration_minutes: duration,
      buffer_minutes: buffer,
      min_notice_hours: notice,
      booking_horizon_days: horizon,
      slot_step_minutes: step,
      availability,
    });
  };

  const num = (value: string, min: number, max: number) => Math.min(max, Math.max(min, Number(value) || min));

  return (
    <div className="kt-settings">
      {error && <div className="tk-notice tk-notice-error">{error}</div>}

      <section className="kt-panel">
        <label className="kt-switch">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="kt-switch-track" aria-hidden="true" />
          <span>
            <strong>KI-Telefon {enabled ? "eingeschaltet" : "ausgeschaltet"}</strong>
            <span className="tk-muted">Ausgeschaltet nimmt die KI keine Termine oder Rückrufe an.</span>
          </span>
        </label>
      </section>

      <section className="kt-panel">
        <h3>Begrüßung & Verhalten</h3>
        <div className="tk-form">
          <label className="tk-field">
            <span>Firmenname am Telefon</span>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="z. B. Malerbetrieb Müller" />
          </label>
          <label className="tk-field">
            <span>Nummer der KI (nur zur Info)</span>
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+49 …" />
          </label>
          <label className="tk-field tk-span-2">
            <span>Begrüßung</span>
            <textarea
              rows={2}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Leer lassen für: „Guten Tag, Sie sprechen mit dem digitalen KI-Assistenten von … Wie kann ich Ihnen helfen?“"
            />
            {greetingMissingHint && (
              <span className="kt-warn">Bitte den Hinweis auf die KI in der Begrüßung behalten.</span>
            )}
          </label>
          <label className="tk-field tk-span-2">
            <span>Zusätzliche Hinweise für die KI</span>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={"z. B.\n– Wir arbeiten im Umkreis von 30 km um Musterstadt.\n– Fassaden machen wir nur von April bis Oktober.\n– Notfälle bitte als Rückruf aufnehmen."}
            />
          </label>
        </div>
      </section>

      <section className="kt-panel">
        <h3>Besichtigungstermine</h3>
        <div className="kt-grid-3">
          <label className="tk-field">
            <span>Dauer (Minuten)</span>
            <input type="number" min={15} max={480} step={15} value={duration} onChange={(e) => setDuration(num(e.target.value, 15, 480))} />
          </label>
          <label className="tk-field">
            <span>Puffer davor/danach (Min.)</span>
            <input type="number" min={0} max={240} step={15} value={buffer} onChange={(e) => setBuffer(num(e.target.value, 0, 240))} />
          </label>
          <label className="tk-field">
            <span>Raster (Minuten)</span>
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
            <input type="number" min={1} max={90} value={horizon} onChange={(e) => setHorizon(num(e.target.value, 1, 90))} />
          </label>
          <label className="tk-field">
            <span>Zeitzone</span>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h4 className="kt-subhead">Wann darf die KI Besichtigungen vergeben?</h4>
        <p className="tk-muted">
          Bereits eingetragene Termine im Terminkalender werden automatisch freigehalten (plus Puffer).
        </p>
        <div className="kt-week">
          {WEEKDAYS.map((d) => (
            <div key={d.key} className="kt-day">
              <strong className="kt-day-name">{d.label}</strong>
              <div className="kt-day-windows">
                {availability[d.key].length === 0 && <span className="tk-muted">keine Besichtigungen</span>}
                {availability[d.key].map((w, i) => (
                  <span key={i} className="kt-window">
                    <input
                      type="time"
                      value={w[0]}
                      onChange={(e) => updateWindow(d.key, i, 0, e.target.value)}
                      aria-label={`${d.label} von`}
                    />
                    <span>–</span>
                    <input
                      type="time"
                      value={w[1]}
                      onChange={(e) => updateWindow(d.key, i, 1, e.target.value)}
                      aria-label={`${d.label} bis`}
                    />
                    <button type="button" className="tk-icon-btn kt-small-icon" onClick={() => removeWindow(d.key, i)} aria-label="Zeitfenster entfernen">
                      ×
                    </button>
                  </span>
                ))}
                {availability[d.key].length < 3 && (
                  <button type="button" className="tk-add-slot kt-add" onClick={() => addWindow(d.key)}>
                    + Zeitfenster
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="kt-save-bar">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? "Speichert…" : "Einstellungen speichern"}
        </button>
      </div>
    </div>
  );
}
