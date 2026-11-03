import type { PoolProfile } from "./types";
import { RADII, ROLES, SKILLS, WANTS } from "./types";

/** Formular für Anmeldung und Bearbeitung des eigenen Profils */
export default function ProfileForm({
  value,
  onChange,
  signup,
}: {
  value: PoolProfile;
  onChange: (p: PoolProfile) => void;
  signup: boolean;
}) {
  const set = (patch: Partial<PoolProfile>) => onChange({ ...value, ...patch });
  const toggle = (key: "wants" | "skills", v: string) =>
    set({ [key]: value[key].includes(v) ? value[key].filter((x) => x !== v) : [...value[key], v] } as Partial<PoolProfile>);
  const sub = value.wants.includes("subunternehmer");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fk-form">
      <fieldset className="fk-fs">
        <legend>Was sind Sie? *</legend>
        <div className="fk-radios">
          {ROLES.map((r) => (
            <label key={r.value} className={`fk-radio${value.role === r.value ? " on" : ""}`}>
              <input type="radio" name="role" value={r.value} checked={value.role === r.value} onChange={() => set({ role: r.value })} />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="fk-fs">
        <legend>Was suchen Sie? * <small>(mehrere möglich)</small></legend>
        <div className="fk-chips">
          {WANTS.map((w) => (
            <label key={w.value} className={`fk-chip${value.wants.includes(w.value) ? " on" : ""}`}>
              <input type="checkbox" checked={value.wants.includes(w.value)} onChange={() => toggle("wants", w.value)} />
              <span>{w.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {sub && (
        <div className="fk-sub">
          <label className="fk-field">
            <span>Firmenname (falls vorhanden)</span>
            <input value={value.company_name} maxLength={100} onChange={(e) => set({ company_name: e.target.value })} />
          </label>
          <label className="fk-check">
            <input type="checkbox" checked={value.handwerksrolle} onChange={(e) => set({ handwerksrolle: e.target.checked })} />
            <span>Mein Betrieb ist in der Handwerksrolle eingetragen (Maler und Lackierer ist ein zulassungspflichtiges Handwerk)</span>
          </label>
        </div>
      )}

      <div className="fk-grid">
        <label className="fk-field">
          <span>Postleitzahl Ihres Wohnorts *</span>
          <input value={value.plz} inputMode="numeric" maxLength={5} autoComplete="postal-code" onChange={(e) => set({ plz: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="z. B. 54516" />
          {value.ort && <small>{value.ort}</small>}
        </label>
        <label className="fk-field">
          <span>So weit würde ich fahren</span>
          <select value={value.radius_km} onChange={(e) => set({ radius_km: Number(e.target.value) })}>
            {[...new Set([...RADII, value.radius_km])].sort((x, y) => x - y).map((r) => (
              <option key={r} value={r}>
                bis {r} km
              </option>
            ))}
          </select>
        </label>
        <div className="fk-field">
          <span>Verfügbar</span>
          <div className="fk-avail">
            <label className="fk-check">
              <input type="radio" name="avail" checked={value.available_from === "sofort"} onChange={() => set({ available_from: "sofort" })} /> sofort
            </label>
            <label className="fk-check">
              <input type="radio" name="avail" checked={value.available_from !== "sofort"} onChange={() => set({ available_from: value.available_from !== "sofort" ? value.available_from : today })} /> ab
            </label>
            <input type="date" min={today} aria-label="Verfügbar ab Datum" disabled={value.available_from === "sofort"} value={value.available_from === "sofort" ? "" : value.available_from} onChange={(e) => set({ available_from: e.target.value || "sofort" })} />
          </div>
        </div>
      </div>

      <fieldset className="fk-fs">
        <legend>Was können Sie besonders gut? <small>(optional)</small></legend>
        <div className="fk-chips">
          {SKILLS.map((s) => (
            <label key={s.value} className={`fk-chip small${value.skills.includes(s.value) ? " on" : ""}`}>
              <input type="checkbox" checked={value.skills.includes(s.value)} onChange={() => toggle("skills", s.value)} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="fk-grid two">
        <label className="fk-check">
          <input type="checkbox" checked={value.driving_license} onChange={(e) => set({ driving_license: e.target.checked })} />
          <span>Führerschein Klasse B</span>
        </label>
        <label className="fk-check">
          <input type="checkbox" checked={value.own_vehicle} onChange={(e) => set({ own_vehicle: e.target.checked })} />
          <span>Eigenes Auto</span>
        </label>
      </div>

      <label className="fk-field">
        <span>Sprachen <small>(optional)</small></span>
        <input value={value.languages} maxLength={120} onChange={(e) => set({ languages: e.target.value })} placeholder="z. B. Deutsch, Polnisch" />
      </label>
      <label className="fk-field">
        <span>Kurz über mich <small>(optional – bitte keine Kontaktdaten, die gibt es erst nach Ihrer Zustimmung)</small></span>
        <textarea rows={3} maxLength={600} value={value.note} onChange={(e) => set({ note: e.target.value })} placeholder="z. B. 8 Jahre Erfahrung, vor allem Fassaden und Altbau" />
      </label>

      <h3 className="fk-h3">Ihre Kontaktdaten</h3>
      <p className="fk-muted">Diese Angaben sieht kein Betrieb, solange Sie einer Kontaktanfrage nicht zugestimmt haben.</p>
      <div className="fk-grid two">
        <label className="fk-field">
          <span>Vorname *</span>
          <input value={value.first_name} maxLength={60} autoComplete="given-name" onChange={(e) => set({ first_name: e.target.value })} />
        </label>
        <label className="fk-field">
          <span>Nachname *</span>
          <input value={value.last_name} maxLength={60} autoComplete="family-name" onChange={(e) => set({ last_name: e.target.value })} />
        </label>
        {signup ? (
          <label className="fk-field">
            <span>E-Mail *</span>
            <input type="email" value={value.email} maxLength={160} autoComplete="email" onChange={(e) => set({ email: e.target.value })} />
          </label>
        ) : (
          <div className="fk-field">
            <span>E-Mail</span>
            <input value={value.email} disabled />
            <small>Andere Adresse? Profil löschen und neu anmelden.</small>
          </div>
        )}
        <label className="fk-field">
          <span>Telefon <small>(empfohlen)</small></span>
          <input type="tel" value={value.phone} maxLength={40} autoComplete="tel" onChange={(e) => set({ phone: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
