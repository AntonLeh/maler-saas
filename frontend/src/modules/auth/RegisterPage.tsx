import { useState } from "react";
import { COUNTRIES, COUNTRY_PRESET } from "../land/logic";
import type { Country } from "../land/logic";
import { getAttribution } from "../../lib/attribution";
import { supabase } from "../../lib/supabase";
import { LEGAL_VERSIONS } from "../../lib/legalVersions";
import AuthLegal from "./AuthLegal";
import PasswordInput from "./PasswordInput";
import { MIN_PASSWORD_LENGTH, cleanEmail, passwordProblem, signupErrorText, type AuthMessage } from "./messages";
import "./auth.css";

type Props = {
  onBackToLogin: () => void;
  onOpenAgb: () => void;
  onOpenDatenschutz: () => void;
  onOpenImpressum: () => void;
};

export default function RegisterPage({ onBackToLogin, onOpenAgb, onOpenDatenschutz, onOpenImpressum }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState<Country | "">("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<AuthMessage>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setMessage(null);
    const mail = cleanEmail(email);
    if (!companyName.trim() || !firstName.trim() || !lastName.trim() || !mail) {
      setMessage({ text: "Bitte füllen Sie alle Pflichtfelder aus.", tone: "error" });
      return;
    }
    if (!country) {
      setMessage({ text: "Bitte wählen Sie das Land Ihres Betriebs – davon hängen Währung und Mehrwertsteuer ab.", tone: "error" });
      return;
    }
    const pwProblem = passwordProblem(password, passwordRepeat);
    if (pwProblem) {
      setMessage({ text: pwProblem, tone: "error" });
      return;
    }
    if (!isBusiness) {
      setMessage({ text: "MalerSaaS richtet sich ausschließlich an Unternehmen. Bitte bestätigen Sie, dass Sie als Unternehmer handeln.", tone: "error" });
      return;
    }
    if (!acceptTerms) {
      setMessage({ text: "Bitte akzeptieren Sie die AGB und den Auftragsverarbeitungsvertrag.", tone: "error" });
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          data: {
            signup_type: "company",
            company_name: companyName.trim(),
            // Land: Währung und Mehrwertsteuer werden danach automatisch passend gesetzt
            country,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim(),
            // Nachweis: welche Fassung von AGB, AVV und Datenschutzhinweisen galt und dass als Unternehmer gehandelt wird
            // (Zeitpunkt = Anlage des Zugangs, siehe legal_acceptances() in der Datenbank)
            legal_accepted: { ...LEGAL_VERSIONS, unternehmer: true },
            // Herkunft (Werbe-Link), falls vorhanden – für die Erfolgsmessung im Owner-Bereich
            ...(getAttribution() ? { signup_origin: getAttribution() } : {}),
          },
        },
      });
      if (error) {
        setMessage({ text: signupErrorText(error), tone: "error" });
        return;
      }
      // Immer dieselbe Bestätigung – verrät nicht, ob die Adresse schon registriert ist
      setPassword("");
      setPasswordRepeat("");
      setSentTo(mail);
    } catch (err) {
      setMessage({ text: signupErrorText(err as { message?: string }), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="au-page">
        <div className="au-wrap">
          <div className="au-card">
            <div className="au-brand">
              <div className="au-done" aria-hidden>✉️</div>
              <h1>Fast geschafft!</h1>
              <p>
                Wir haben Ihnen eine E-Mail an <strong>{sentTo}</strong> geschickt. Klicken Sie auf den Link darin, um Ihre
                E-Mail-Adresse zu bestätigen – danach können Sie sich anmelden und Ihre 14 Tage kostenlos testen.
              </p>
            </div>
            <ul className="au-tips">
              <li>Keine E-Mail da? Bitte schauen Sie auch im Spam- oder Werbe-Ordner nach.</li>
              <li>Haben Sie schon ein Konto mit dieser Adresse? Dann melden Sie sich einfach an oder nutzen „Passwort vergessen?“.</li>
            </ul>
            <button type="button" className="btn btn-primary au-submit au-gap" onClick={onBackToLogin}>
              Zur Anmeldung
            </button>
          </div>
          <AuthLegal onImpressum={onOpenImpressum} onDatenschutz={onOpenDatenschutz} onAgb={onOpenAgb} />
        </div>
      </div>
    );
  }

  return (
    <div className="au-page">
      <div className="au-wrap au-wide">
        <button type="button" className="au-home" onClick={onBackToLogin}>← Zur Anmeldung</button>
        <div className="au-card">
          <div className="au-brand">
            <img src="/images/logo.png" alt="" className="au-logo" />
            <h1>Firma registrieren</h1>
            <p>Legen Sie Ihren Malerbetrieb bei MalerSaaS an.</p>
            <div className="au-badges">
              <span>✓ 14 Tage kostenlos</span>
              <span>✓ keine Kreditkarte nötig</span>
              <span>✓ endet automatisch</span>
            </div>
          </div>

          <form onSubmit={submit} className="au-form">
            <label className="au-field" htmlFor="rg-company">
              <span>Firmenname *</span>
              <input id="rg-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" required autoFocus />
            </label>

            <label className="au-field" htmlFor="rg-country">
              <span>Land des Betriebs *</span>
              <select id="rg-country" value={country} onChange={(e) => setCountry(e.target.value as Country)} required>
                <option value="" disabled>
                  Bitte wählen …
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c} ({COUNTRY_PRESET[c].currency}, {COUNTRY_PRESET[c].tax.toLocaleString("de-DE")} % MwSt.)
                  </option>
                ))}
              </select>
            </label>

            <div className="au-row">
              <label className="au-field" htmlFor="rg-first">
                <span>Vorname *</span>
                <input id="rg-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
              </label>
              <label className="au-field" htmlFor="rg-last">
                <span>Nachname *</span>
                <input id="rg-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
              </label>
            </div>

            <div className="au-row">
              <label className="au-field" htmlFor="rg-email">
                <span>E-Mail *</span>
                <input
                  id="rg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </label>
              <label className="au-field" htmlFor="rg-phone">
                <span>Telefon</span>
                <input id="rg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
              </label>
            </div>

            <div className="au-row">
              <div className="au-field">
                <label htmlFor="rg-pw">Passwort *</label>
                <PasswordInput id="rg-pw" value={password} onChange={setPassword} autoComplete="new-password" required />
                <small className={password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? "au-hint" : "au-note"}>
                  {password.length > 0 && password.length < MIN_PASSWORD_LENGTH
                    ? `Noch ${MIN_PASSWORD_LENGTH - password.length} Zeichen`
                    : `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
                </small>
              </div>
              <div className="au-field">
                <label htmlFor="rg-pw2">Passwort wiederholen *</label>
                <PasswordInput id="rg-pw2" value={passwordRepeat} onChange={setPasswordRepeat} autoComplete="new-password" required />
                {passwordRepeat.length > 0 && passwordRepeat !== password && <small className="au-hint">Stimmt noch nicht überein</small>}
              </div>
            </div>

            <label className="au-check">
              <input type="checkbox" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} />
              <span>Ich handle als Unternehmer (§ 14 BGB) bzw. für ein Unternehmen. *</span>
            </label>

            <label className="au-check">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              <span>
                Ich akzeptiere die{" "}
                <button type="button" className="au-link" onClick={onOpenAgb}>AGB</button> und den{" "}
                <a className="au-link" href="/avv" target="_blank" rel="noopener noreferrer">Auftragsverarbeitungsvertrag</a>. *
              </span>
            </label>
            <p className="au-note">
              Hinweise zur Verarbeitung Ihrer Daten finden Sie in unseren{" "}
              <button type="button" className="au-link" onClick={onOpenDatenschutz}>Datenschutzhinweisen</button>.
            </p>

            {message && (
              <div className={`au-msg ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
                {message.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary au-submit" disabled={busy}>
              {busy ? "Wird registriert …" : "Kostenlos registrieren"}
            </button>
            <p className="au-note au-center-text">* Pflichtfeld</p>
          </form>

          <p className="au-register">
            Schon ein Konto?{" "}
            <button type="button" className="au-link strong" onClick={onBackToLogin}>Anmelden</button>
          </p>
        </div>
        <AuthLegal onImpressum={onOpenImpressum} onDatenschutz={onOpenDatenschutz} onAgb={onOpenAgb} />
      </div>
    </div>
  );
}
