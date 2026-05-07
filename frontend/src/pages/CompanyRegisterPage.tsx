import { useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  onBackToLogin: () => void;
  onOpenAgb: () => void;
  onOpenDatenschutz: () => void;
};

export default function CompanyRegisterPage({
  onBackToLogin,
  onOpenAgb,
  onOpenDatenschutz,
}: Props) {
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");

    if (password !== passwordRepeat) {
  setMessage("Passwörter stimmen nicht überein.");
  return;
}

    if (!acceptTerms) {
  setMessage("Bitte akzeptiere die AGB und Datenschutzbestimmungen.");
  return;
}

setLoading(true);

const { data: emailAvailable, error: emailCheckError } = await supabase.rpc(
  "check_email_available",
  {
    p_email: email,
  }
);

if (emailCheckError) {
  setMessage("E-Mail-Adresse konnte nicht geprüft werden.");
  setLoading(false);
  return;
}

if (emailAvailable === false) {
  setMessage("Diese E-Mail-Adresse ist bereits registriert.");
  setLoading(false);
  return;
}

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
  data: {
    signup_type: "company",
    company_name: companyName,
    first_name: firstName,
    last_name: lastName,
    phone: phone,
  },
},
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        "Registrierung erfolgreich. Bitte E-Mail bestätigen und anschließend einloggen."
      );
    }

    setLoading(false);
  };

  return (
    <div className="auth-wrapper">
      <div className="card" style={{ maxWidth: 550, margin: "50px auto" }}>
        <h1>Firma registrieren</h1>
        <p>Neue Malerfirma für MalerSaaS anlegen</p>

        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Firmenname"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Vorname"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Nachname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Passwort wiederholen"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            required
          />

        <label className="terms-checkbox">
  <input
    type="checkbox"
    checked={acceptTerms}
    onChange={(e) => setAcceptTerms(e.target.checked)}
  />

  <span>
    Ich akzeptiere die{" "}
    <button type="button" className="link-button" onClick={onOpenAgb}>
      AGB
    </button>{" "}
    und die{" "}
    <button type="button" className="link-button" onClick={onOpenDatenschutz}>
      Datenschutzbestimmungen
    </button>
  </span>
</label>

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ width: "100%", marginTop: 20 }}
          >
            {loading ? "Registrierung läuft..." : "Firma registrieren"}
          </button>
        </form>

        {message && (
          <p
            style={{
              marginTop: 20,
              color: message.includes("erfolgreich") ? "green" : "red",
            }}
          >
            {message}
          </p>
        )}

        <button
          onClick={onBackToLogin}
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: 15 }}
        >
          Zurück zum Login
        </button>
      </div>
    </div>
  );
}