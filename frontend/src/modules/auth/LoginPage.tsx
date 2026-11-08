import { useState } from "react";
import { supabase } from "../../lib/supabase";
import AuthLegal from "./AuthLegal";
import PasswordInput from "./PasswordInput";
import { loginErrorText, resetErrorText, type AuthMessage } from "./messages";
import "./auth.css";

type Props = {
  initialMessage?: AuthMessage;
  onRegister: () => void;
  onHome: () => void;
  onImpressum: () => void;
  onDatenschutz: () => void;
  onAgb: () => void;
};

const RESET_REDIRECT = "https://maler-saas.com/?reset-password=true";

export default function LoginPage({ initialMessage = null, onRegister, onHome, onImpressum, onDatenschutz, onAgb }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"login" | "reset" | null>(null);
  const [message, setMessage] = useState<AuthMessage>(initialMessage);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setMessage(null);
    setBusy("login");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage({ text: loginErrorText(error), tone: "error" });
        return;
      }
      setPassword("");
      setMessage({ text: "Anmeldung erfolgreich – einen Moment …", tone: "success" });
    } catch (err) {
      setMessage({ text: loginErrorText(err as { message?: string }), tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const forgot = async () => {
    if (busy) return;
    const mail = email.trim();
    if (!mail) {
      setMessage({ text: "Bitte geben Sie zuerst oben Ihre E-Mail-Adresse ein.", tone: "info" });
      document.getElementById("au-email")?.focus();
      return;
    }
    setMessage(null);
    setBusy("reset");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: RESET_REDIRECT });
      if (error) {
        setMessage({ text: resetErrorText(error), tone: "error" });
        return;
      }
      // bewusst neutral: verrät nicht, ob es ein Konto mit dieser Adresse gibt
      setMessage({
        text: "Falls ein Konto mit dieser E-Mail-Adresse besteht, haben wir Ihnen einen Link zum Zurücksetzen geschickt. Bitte schauen Sie auch im Spam-Ordner nach.",
        tone: "success",
      });
    } catch (err) {
      setMessage({ text: resetErrorText(err as { message?: string }), tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="au-page">
      <div className="au-wrap">
        <button type="button" className="au-home" onClick={onHome}>← Zur Startseite</button>
        <div className="au-card">
          <div className="au-brand">
            <img src="/images/logo.png" alt="" className="au-logo" />
            <h1>MalerSaaS</h1>
            <p>Melden Sie sich an, um Ihr Dashboard zu öffnen.</p>
          </div>

          <form onSubmit={login} className="au-form" noValidate={false}>
            <label className="au-field" htmlFor="au-email">
              <span>E-Mail</span>
              <input
                id="au-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
              />
            </label>

            <div className="au-field">
              <div className="au-label-row">
                <label htmlFor="au-password">Passwort</label>
                <button type="button" className="au-link" onClick={forgot} disabled={busy !== null}>
                  {busy === "reset" ? "Wird gesendet …" : "Passwort vergessen?"}
                </button>
              </div>
              <PasswordInput id="au-password" value={password} onChange={setPassword} autoComplete="current-password" required />
            </div>

            {message && (
              <div className={`au-msg ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
                {message.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary au-submit" disabled={busy !== null}>
              {busy === "login" ? "Wird angemeldet …" : "Einloggen"}
            </button>
          </form>

          <p className="au-register">
            Noch kein Konto?{" "}
            <button type="button" className="au-link strong" onClick={onRegister}>
              14 Tage kostenlos testen
            </button>
          </p>
        </div>
        <AuthLegal onImpressum={onImpressum} onDatenschutz={onDatenschutz} onAgb={onAgb} />
      </div>
    </div>
  );
}
