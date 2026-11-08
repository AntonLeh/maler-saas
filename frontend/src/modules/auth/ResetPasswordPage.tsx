import { useState } from "react";
import { supabase } from "../../lib/supabase";
import AuthLegal from "./AuthLegal";
import PasswordInput from "./PasswordInput";
import { MIN_PASSWORD_LENGTH, passwordProblem, recoveryLinkError, resetErrorText, type AuthMessage } from "./messages";
import "./auth.css";

type Props = {
  onDone: (message: string) => void; // nach erfolgreichem Speichern → Login
  onCancel: () => void;
  onImpressum: () => void;
  onDatenschutz: () => void;
  onAgb: () => void;
};

export default function ResetPasswordPage({ onDone, onCancel, onImpressum, onDatenschutz, onAgb }: Props) {
  const [linkError] = useState(() => recoveryLinkError(window.location.hash, window.location.search));
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<AuthMessage>(linkError ? { text: linkError, tone: "error" } : null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = passwordProblem(pw, pw2);
    if (problem) {
      setMessage({ text: problem, tone: "error" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setMessage({ text: resetErrorText(error), tone: "error" });
        return;
      }
      // Adresse bereinigen, sonst öffnet sich nach dem Abmelden wieder diese Seite
      window.history.replaceState({}, document.title, window.location.pathname);
      await supabase.auth.signOut();
      onDone("Ihr Passwort wurde geändert. Bitte melden Sie sich mit dem neuen Passwort an.");
    } catch (err) {
      setMessage({ text: resetErrorText(err as { message?: string }), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="au-page">
      <div className="au-wrap">
        <div className="au-card">
          <div className="au-brand">
            <img src="/images/logo.png" alt="" className="au-logo" />
            <h1>Neues Passwort</h1>
            <p>Bitte vergeben Sie ein neues Passwort (mindestens {MIN_PASSWORD_LENGTH} Zeichen).</p>
          </div>

          {linkError ? (
            <>
              <div className="au-msg error" role="alert">{linkError}</div>
              <button type="button" className="btn btn-primary au-submit au-gap" onClick={onCancel}>
                Neuen Link anfordern
              </button>
            </>
          ) : (
            <form onSubmit={save} className="au-form">
              {/* verstecktes Benutzerfeld: hilft Passwort-Managern, das neue Passwort richtig zu speichern */}
              <input type="text" autoComplete="username" hidden readOnly value="" />
              <div className="au-field">
                <label htmlFor="au-new">Neues Passwort</label>
                <PasswordInput id="au-new" value={pw} onChange={setPw} autoComplete="new-password" required autoFocus />
                {pw.length > 0 && pw.length < MIN_PASSWORD_LENGTH && (
                  <small className="au-hint">Noch {MIN_PASSWORD_LENGTH - pw.length} Zeichen</small>
                )}
              </div>
              <div className="au-field">
                <label htmlFor="au-new2">Passwort wiederholen</label>
                <PasswordInput id="au-new2" value={pw2} onChange={setPw2} autoComplete="new-password" required />
              </div>

              {message && (
                <div className={`au-msg ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
                  {message.text}
                </div>
              )}

              <button type="submit" className="btn btn-primary au-submit" disabled={busy}>
                {busy ? "Wird gespeichert …" : "Passwort speichern"}
              </button>
              <button type="button" className="au-link au-center" onClick={onCancel} disabled={busy}>
                Abbrechen
              </button>
            </form>
          )}
        </div>
        <AuthLegal onImpressum={onImpressum} onDatenschutz={onDatenschutz} onAgb={onAgb} />
      </div>
    </div>
  );
}
