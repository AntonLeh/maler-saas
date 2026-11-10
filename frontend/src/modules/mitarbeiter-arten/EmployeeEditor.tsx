// Mitarbeiter anlegen / bearbeiten: Person, Beschäftigungsart, Rolle & App-Zugang, Vergütung, Kosten-Stundensatz
import { useEffect, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import type { Person } from "./api";
import * as L from "./logic";
import type { EmploymentType, Pay } from "./logic";
import "./ea.css";

const PM = 3;
const EMP = 4;

type Props = {
  tenantId: number;
  person: Person | null; // null = neu
  currencySymbol: string;
  onSaved: (message: string) => void;
  onBack: () => void;
};

const num = (v: string): number | null => {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const str = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export default function EmployeeEditor({ tenantId, person, currencySymbol: cur, onSaved, onBack }: Props) {
  const isNew = !person;
  const isStaffRole = isNew || person.role_id === PM || person.role_id === EMP; // Chef/Admin: nur Stammdaten
  const [first, setFirst] = useState(person?.first_name ?? "");
  const [last, setLast] = useState(person?.last_name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [roleId, setRoleId] = useState(person?.role_id ?? EMP);
  const [type, setType] = useState<EmploymentType>((person?.employment_type as EmploymentType) || "gewerblich");
  const hadAccess = person ? person.app_access !== false : true;
  const [access, setAccess] = useState(hadAccess);
  const [password, setPassword] = useState("");
  const [pay, setPay] = useState<Pay>(L.EMPTY_PAY);
  const [manualRate, setManualRate] = useState(str(person?.hourly_rate));
  const [payReady, setPayReady] = useState(isNew);
  const [payAvailable, setPayAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Bei neuen Personen ohne App wird kein Login gebraucht → Passwort nur bei Zugang

  useEffect(() => {
    if (!person) return;
    let cancel = false;
    api.loadPay(person.id).then((r) => {
      if (cancel) return;
      // Bisher nur „Stundensatz intern“ → als selbst festgelegter Satz übernehmen
      setPay(r.available && (r.pay.hourly_wage != null || r.pay.monthly_salary != null || r.pay.agency_rate != null || r.pay.sub_rate != null || r.pay.rate_manual) ? r.pay : { ...r.pay, rate_manual: person.hourly_rate != null });
      setPayAvailable(r.available);
      setPayReady(true);
    });
    return () => {
      cancel = true;
    };
  }, [person]);

  const info = L.EMPLOYMENT[type];
  const setP = (patch: Partial<Pay>) => setPay((p) => ({ ...p, ...patch }));
  const computed = L.costRate(type, pay);
  const rate = pay.rate_manual || !isStaffRole ? num(manualRate) : computed;

  const pickType = (t: EmploymentType) => {
    setType(t);
    // Leiharbeiter und Subunternehmer brauchen meist keinen App-Zugang – nur bei neuen Personen vorschlagen
    if (isNew && !L.EMPLOYMENT[t].own) setAccess(false);
    if (isNew && L.EMPLOYMENT[t].own) setAccess(true);
    if (!L.EMPLOYMENT[t].own) setRoleId(EMP);
  };

  const validate = (): string | null => {
    if (!first.trim() || !last.trim()) return "Bitte Vor- und Nachname eintragen.";
    const mail = email.trim();
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(mail)) return "Die E-Mail-Adresse ist ungültig.";
    if (isStaffRole && access) {
      if (!mail) return "Für den App-Zugang wird eine E-Mail-Adresse benötigt (damit meldet sich die Person an).";
      const needsPw = isNew || (!hadAccess && !person?.auth_user_id);
      if (needsPw && password.length < 8) return "Bitte ein Passwort mit mindestens 8 Zeichen für die Anmeldung vergeben.";
      if (password && password.length < 8) return "Das Passwort muss mindestens 8 Zeichen lang sein.";
    }
    if (type === "sub" && !pay.sub_company?.trim()) return "Bitte die Firma des Subunternehmers eintragen.";
    if (type === "leiharbeit" && !pay.agency_name?.trim()) return "Bitte die Zeitarbeitsfirma eintragen.";
    if (pay.rate_manual && manualRate.trim() && num(manualRate) == null) return "Der Kosten-Stundensatz ist keine Zahl.";
    return null;
  };

  const save = async () => {
    const v = validate();
    if (v) return setError(v);
    setError("");
    const cleaned = L.cleanPay(type, pay);
    setBusy(true);
    try {
      if (isNew) {
        const created = await api.createPerson({
          first_name: first.trim(),
          last_name: last.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password: access ? password : "",
          role_id: roleId,
          hourly_rate: rate,
          employment_type: type,
          app_access: access,
        });
        let note = "";
        try {
          await api.savePay(created.id, tenantId, cleaned);
        } catch (e) {
          note = ` Hinweis: ${(e as Error).message}`;
        }
        onSaved(`${first.trim()} ${last.trim()} wurde angelegt${access ? " – mit App-Zugang" : " – ohne App-Zugang"}.${note}`);
        return;
      }

      // Bearbeiten
      if (!isStaffRole) {
        await api.updatePerson(person.id, tenantId, { first_name: first.trim(), last_name: last.trim(), phone: phone.trim() || null, hourly_rate: rate });
        onSaved("Änderungen gespeichert.");
        return;
      }
      if (hadAccess && !access) {
        const ok = await showConfirm(`App-Zugang für ${first} ${last} abschalten? Die Person kann sich danach nicht mehr anmelden. Zeiten und Daten bleiben erhalten.`, {
          confirmLabel: "Zugang abschalten",
          danger: true,
        });
        if (!ok) return;
      }
      const values: Partial<Person> = {
        first_name: first.trim(),
        last_name: last.trim(),
        phone: phone.trim() || null,
        role_id: roleId,
        hourly_rate: rate,
      };
      // Anmelde-E-Mail nur ändern, wenn kein Login besteht (sonst passt sie nicht mehr zum Login)
      if (!(hadAccess && access)) values.email = email.trim().toLowerCase() || null;
      if (person.employment_type !== undefined || type !== "gewerblich") values.employment_type = type;
      await api.updatePerson(person.id, tenantId, values);
      if (!hadAccess && access) await api.grantAccess(person.id, email.trim().toLowerCase(), password);
      if (hadAccess && !access) await api.revokeAccess(person.id);
      if (payAvailable) await api.savePay(person.id, tenantId, cleaned);
      onSaved(`Änderungen für ${first.trim()} ${last.trim()} gespeichert.`);
    } catch (e) {
      setError((e as Error).message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number | null) => (n == null ? "–" : `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`);
  const numField = (label: string, value: number | null, onChange: (n: number | null) => void, opts: { suffix?: string; placeholder?: string; step?: string } = {}) => (
    <label className="ea-field">
      <span>{label}</span>
      <div className="ea-suffix">
        <input inputMode="decimal" value={str(value)} placeholder={opts.placeholder} onChange={(e) => onChange(num(e.target.value))} />
        {opts.suffix && <em>{opts.suffix}</em>}
      </div>
    </label>
  );
  const txt = (label: string, value: string | null, onChange: (s: string) => void, placeholder = "", type2 = "text") => (
    <label className="ea-field">
      <span>{label}</span>
      <input type={type2} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );

  const leih = type === "leiharbeit" ? L.leihHint(pay) : null;

  return (
    <section className="single-page-section ea-root">
      <div className="card form-page-card">
        <div className="page-topbar">
          <div>
            <h2>{isNew ? "Mitarbeiter anlegen" : "Mitarbeiter bearbeiten"}</h2>
            <p>{isNew ? "Festangestellte, Azubis, Aushilfen, Leiharbeiter und Subunternehmer erfassen." : `${person.first_name ?? ""} ${person.last_name ?? ""}`}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Zurück
          </button>
        </div>

        {error && <p className="ea-msg err">{error}</p>}
        {!payAvailable && <p className="ea-msg warn">Für Beschäftigungsart und Vergütung fehlt noch das Datenbank-Update (SQL „Mitarbeiter-Arten“). Name, Rolle und Stundensatz können Sie trotzdem speichern.</p>}

        <div className="ea-block">
          <h3>Person</h3>
          <div className="ea-grid">
            {txt("Vorname *", first, setFirst)}
            {txt("Nachname *", last, setLast)}
            {txt(`E-Mail${isStaffRole && access ? " * (Anmeldung)" : ""}`, email, setEmail, "", "email")}
            {txt("Telefon", phone, setPhone)}
          </div>
          {!isNew && hadAccess && access && isStaffRole && <p className="ea-small">Die Anmelde-E-Mail lässt sich hier nicht ändern. Dafür den App-Zugang aus- und mit der neuen E-Mail wieder einschalten.</p>}
        </div>

        {isStaffRole && (
          <>
            <div className="ea-block">
              <h3>Beschäftigungsart</h3>
              <div className="ea-types">
                {L.EMPLOYMENT_ORDER.map((k) => (
                  <button key={k} type="button" className={type === k ? "on" : ""} style={type === k ? { borderColor: L.EMPLOYMENT[k].color, background: L.EMPLOYMENT[k].bg } : undefined} onClick={() => pickType(k)}>
                    <b style={{ color: L.EMPLOYMENT[k].color }}>{L.EMPLOYMENT[k].label}</b>
                    <small>{L.EMPLOYMENT[k].hint}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="ea-block">
              <h3>Rolle und App-Zugang</h3>
              <div className="ea-grid">
                <label className="ea-field">
                  <span>Rolle in der App</span>
                  <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
                    <option value={PM}>Projektleiter – plant Aufträge, sieht das Team</option>
                    <option value={EMP}>Mitarbeiter – sieht seine eigenen Aufträge</option>
                  </select>
                </label>
                <div className="ea-field">
                  <span>Zugang zur App</span>
                  <div className="ea-seg">
                    <button type="button" className={access ? "on" : ""} onClick={() => setAccess(true)}>
                      Ja, mit Anmeldung
                    </button>
                    <button type="button" className={!access ? "on" : ""} onClick={() => setAccess(false)}>
                      Nein
                    </button>
                  </div>
                </div>
                {access && (isNew || (!hadAccess && !person?.auth_user_id)) && txt("Passwort für die Anmeldung * (mind. 8 Zeichen)", password, setPassword, "", "password")}
                {access && !isNew && !hadAccess && person?.auth_user_id && txt("Neues Passwort (optional)", password, setPassword, "leer lassen = bisheriges Passwort", "password")}
              </div>
              <p className="ea-small">
                {access
                  ? "Die Person meldet sich mit E-Mail und Passwort an, erfasst Zeiten, Fotos und Material. Zählt zur Mitarbeiterzahl Ihres Tarifs."
                  : "Ohne Anmeldung – zählt nicht zur Mitarbeiterzahl Ihres Tarifs. Sie können die Person trotzdem Aufträgen zuteilen und ihre Kosten erfassen."}
              </p>
            </div>

            <div className="ea-block">
              <h3>{info.own ? "Vergütung" : type === "leiharbeit" ? "Zeitarbeitsfirma" : "Subunternehmer"}</h3>
              {!payReady ? (
                <p className="ea-small">Lädt …</p>
              ) : info.own ? (
                <>
                  <div className="ea-seg">
                    <button type="button" className={pay.pay_type === "stunde" ? "on" : ""} onClick={() => setP({ pay_type: "stunde" })}>
                      Stundenlohn
                    </button>
                    <button type="button" className={pay.pay_type === "monat" ? "on" : ""} onClick={() => setP({ pay_type: "monat" })}>
                      Monatsgehalt / Festgehalt
                    </button>
                  </div>
                  <div className="ea-grid">
                    {pay.pay_type === "stunde"
                      ? numField("Stundenlohn brutto", pay.hourly_wage, (n) => setP({ hourly_wage: n }), { suffix: `${cur}/Std.`, placeholder: "z. B. 18,50" })
                      : numField("Monatsgehalt brutto", pay.monthly_salary, (n) => setP({ monthly_salary: n }), { suffix: `${cur}/Monat`, placeholder: "z. B. 4000" })}
                    {numField("Wochenstunden (Soll)", pay.weekly_hours, (n) => setP({ weekly_hours: n }), { suffix: "Std./Woche", placeholder: "40" })}
                    {numField(pay.pay_type === "monat" ? "Zuschlag Arbeitgeberanteile" : "Zuschlag Lohnnebenkosten", pay.overhead_pct, (n) => setP({ overhead_pct: n }), {
                      suffix: "%",
                      placeholder: `${L.defaultOverhead(type, pay.pay_type)} (Vorschlag)`,
                    })}
                    {type === "azubi" && (
                      <label className="ea-field">
                        <span>Ausbildungsjahr</span>
                        <select value={pay.training_year ?? ""} onChange={(e) => setP({ training_year: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">–</option>
                          {[1, 2, 3, 4].map((y) => (
                            <option key={y} value={y}>
                              {y}. Lehrjahr
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <p className="ea-small">
                    {pay.pay_type === "monat"
                      ? "Der Zuschlag deckt die Arbeitgeberanteile (Sozialversicherung u. a.). Stunden außerhalb von Aufträgen (Büro, Planung) zählen zu den allgemeinen Kosten."
                      : "Der Zuschlag deckt Sozialversicherung, Urlaub, Feiertage und Krankheit. Ihr Steuerberater kennt Ihren genauen Wert."}
                  </p>
                  {type === "minijob" && <p className={`ea-msg ${(L.minijobHint(pay) ?? "").startsWith("Achtung") ? "err" : "info"}`}>{L.minijobHint(pay)}</p>}
                </>
              ) : type === "leiharbeit" ? (
                <>
                  <div className="ea-grid">
                    {txt("Zeitarbeitsfirma *", pay.agency_name, (s) => setP({ agency_name: s }), "z. B. Muster Personal GmbH")}
                    {numField("Verrechnungssatz (netto)", pay.agency_rate, (n) => setP({ agency_rate: n }), { suffix: `${cur}/Std.`, placeholder: "z. B. 38,00" })}
                    {txt("Einsatzbeginn in Ihrem Betrieb", pay.assignment_start, (s) => setP({ assignment_start: s || null }), "", "date")}
                  </div>
                  {leih && <p className={`ea-msg ${leih.warn ? "err" : "info"}`}>{leih.text}</p>}
                  <p className="ea-small">Der Verrechnungssatz ist der Betrag, den die Zeitarbeitsfirma Ihnen je Stunde berechnet. Lohn und Sozialabgaben zahlt die Zeitarbeitsfirma.</p>
                </>
              ) : (
                <>
                  <div className="ea-grid">
                    {txt("Firma *", pay.sub_company, (s) => setP({ sub_company: s }), "z. B. Malerbetrieb Huber")}
                    {txt("USt-IdNr. / Steuernummer", pay.sub_vat_id, (s) => setP({ sub_vat_id: s }))}
                    {txt("Straße", pay.sub_street, (s) => setP({ sub_street: s }))}
                    {txt("PLZ", pay.sub_zip, (s) => setP({ sub_zip: s }))}
                    {txt("Ort", pay.sub_city, (s) => setP({ sub_city: s }))}
                  </div>
                  <div className="ea-field">
                    <span>Abrechnung</span>
                    <div className="ea-seg">
                      {(Object.keys(L.SUB_BILLING) as L.SubBilling[]).map((b) => (
                        <button key={b} type="button" className={pay.sub_billing === b ? "on" : ""} onClick={() => setP({ sub_billing: b })}>
                          {L.SUB_BILLING[b]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {pay.sub_billing === "stunde" && <div className="ea-grid">{numField("Stundensatz (netto)", pay.sub_rate, (n) => setP({ sub_rate: n }), { suffix: `${cur}/Std.` })}</div>}
                  <p className="ea-small">
                    Bei Bauleistungen gilt in Deutschland meist die Umkehr der Steuerschuld (§ 13b UStG): Der Subunternehmer rechnet ohne Umsatzsteuer ab. Lassen Sie sich außerdem
                    die Freistellungsbescheinigung (§ 48b EStG) geben – ohne sie müssen 15 % Bauabzugsteuer einbehalten werden.
                  </p>
                </>
              )}
            </div>
          </>
        )}

        <div className="ea-block ea-rate">
          <h3>Kosten-Stundensatz</h3>
          <div className="ea-rate-row">
            <div>
              <b>{fmt(rate)}</b>
              <small>{pay.rate_manual ? "selbst festgelegt" : isStaffRole ? L.costExplain(type, pay, cur) : "für Zeitauswertung und Nachkalkulation"}</small>
            </div>
            {isStaffRole && (
              <label className="ea-check">
                <input
                  type="checkbox"
                  checked={pay.rate_manual}
                  onChange={(e) => {
                    setP({ rate_manual: e.target.checked });
                    if (e.target.checked && !manualRate && computed != null) setManualRate(str(computed));
                  }}
                />
                selbst festlegen
              </label>
            )}
            {(pay.rate_manual || !isStaffRole) && (
              <div className="ea-suffix ea-rate-input">
                <input inputMode="decimal" value={manualRate} onChange={(e) => setManualRate(e.target.value)} placeholder="z. B. 32,00" />
                <em>{cur}/Std.</em>
              </div>
            )}
          </div>
          <p className="ea-small">Mit diesem Satz werden die Stunden in der Zeitauswertung und in der Nachkalkulation der Aufträge gerechnet.</p>
        </div>

        {isStaffRole && (
          <div className="ea-block">
            <label className="ea-field">
              <span>Interne Notiz (nur für Sie)</span>
              <textarea rows={2} value={pay.notes ?? ""} onChange={(e) => setP({ notes: e.target.value })} />
            </label>
          </div>
        )}

        <div className="ea-actions">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !payReady}>
            {busy ? "Speichert …" : isNew ? "Mitarbeiter anlegen" : "Änderungen speichern"}
          </button>
        </div>
        <p className="ea-small">Vergütung und Notiz sieht nur der Inhaber bzw. Admin – nicht die Mitarbeiter.</p>
      </div>
    </section>
  );
}
