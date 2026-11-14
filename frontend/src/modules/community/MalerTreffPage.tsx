// MalerTreff: öffentliche Seite maler-saas.com/malertreff – Vorstellung, Anmelden, Konto erstellen, danach die Community
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { passwordProblem, signupErrorText } from "../auth/messages";
import * as api from "./api";
import CommunityPage from "./CommunityPage";
import { RulesList } from "./Extras";
import { COMMUNITY_NAME, emptySignup, EXTERNAL_KINDS, validateSignup } from "./logic";
import type { Access, ExternalKind, SignupForm } from "./logic";
import "./cm.css";
import "./mt.css";

const RESET_REDIRECT = "https://maler-saas.com/?reset-password=true";
type Info = { signup_open: boolean; rules_version: string } | null;

export default function MalerTreffPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [info, setInfo] = useState<Info | undefined>(undefined);

  useEffect(() => {
    let cancel = false;
    void supabase.auth.getSession().then(({ data }) => !cancel && setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    void api.publicInfo().then((i) => !cancel && setInfo(i));
    return () => {
      cancel = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined || info === undefined) return <div className="mt-page"><p className="cm-muted mt-center">Lädt …</p></div>;
  return (
    <div className="mt-page">
      <header className="mt-head">
        <a href="/malertreff" className="mt-logo">
          💬 {COMMUNITY_NAME}
        </a>
        {session && (
          <button type="button" className="btn btn-secondary" onClick={() => supabase.auth.signOut()}>
            Abmelden
          </button>
        )}
      </header>
      {session ? <SignedIn session={session} /> : <SignedOut info={info} />}
      <footer className="mt-foot">
        <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a> · <a href="/">MalerSaaS</a>
      </footer>
    </div>
  );
}

/** Angemeldet: externe Mitglieder treten (einmalig, automatisch) bei, danach die Community */
function SignedIn({ session }: { session: Session }) {
  const [state, setState] = useState<{ access: Access | null; err: string | null } | undefined>(undefined);
  useEffect(() => {
    let cancel = false;
    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    void (async () => {
      let a = await api.loadAccess();
      let err: string | null = null;
      if (a?.enabled && a.external && !a.member && meta.signup_type === "community" && meta.community_rules === a.rules_version) {
        try {
          a = await api.join(a.rules_version);
        } catch (e) {
          err = (e as Error).message;
        }
      }
      if (!cancel) setState({ access: a, err });
    })();
    return () => {
      cancel = true;
    };
  }, [session.user.id, session.user.user_metadata]);

  if (state === undefined) return <p className="cm-muted mt-center">Lädt …</p>;
  const a = state.access;
  if (a && !a.enabled) {
    return (
      <div className="mt-card mt-narrow">
        <h2>Demnächst geht es los</h2>
        <p>
          {a.external
            ? "Ihr Konto ist angelegt. Der MalerTreff öffnet in Kürze – wir schicken Ihnen eine E-Mail, sobald es losgeht."
            : "Der MalerTreff ist für Ihren Betrieb noch nicht freigeschaltet."}
        </p>
        {!a.external && (
          <a className="btn btn-primary" href="/">
            Zu MalerSaaS
          </a>
        )}
      </div>
    );
  }
  return (
    <>
      {state.err && <p className="cm-msg err mt-narrow">{state.err}</p>}
      <CommunityPage
        onBack={a && !a.external ? () => (window.location.href = "/") : undefined}
        onAccountDeleted={async () => {
          await supabase.auth.signOut();
          window.location.href = "/malertreff?geloescht=1";
        }}
      />
    </>
  );
}

function SignedOut({ info }: { info: Info }) {
  const deleted = new URLSearchParams(window.location.search).has("geloescht");
  const [view, setView] = useState<"start" | "login" | "register">("start");
  const open = !!info?.signup_open;
  return (
    <>
      {deleted && <p className="cm-msg ok mt-narrow">Ihr Konto wurde gelöscht. Danke, dass Sie dabei waren.</p>}
      {view === "start" && <Landing open={open} onLogin={() => setView("login")} onRegister={() => setView("register")} />}
      {view === "login" && <Login onBack={() => setView("start")} onRegister={open ? () => setView("register") : undefined} />}
      {view === "register" && info && <Register rulesVersion={info.rules_version} onBack={() => setView("start")} onLogin={() => setView("login")} />}
    </>
  );
}

function Landing({ open, onLogin, onRegister }: { open: boolean; onLogin: () => void; onRegister: () => void }) {
  return (
    <>
      <section className="mt-hero">
        <h1>Die Community für Maler, Lackierer und verwandte Gewerke</h1>
        <p>Fachfragen stellen, Projekte zeigen, voneinander lernen – unter Kollegen aus Deutschland, Österreich und der Schweiz.</p>
        <div className="mt-hero-actions">
          {open ? (
            <button type="button" className="btn btn-primary" onClick={onRegister}>
              Kostenlos mitmachen
            </button>
          ) : (
            <span className="mt-soon">Die Anmeldung öffnet in Kürze</span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onLogin}>
            Anmelden
          </button>
        </div>
      </section>
      <section className="mt-grid">
        <div>
          <b>❓ Fragen stellen</b>
          <p>Untergrund, Material, Kalkulation, Personal – Kollegen antworten, die beste Antwort wird als Lösung markiert.</p>
        </div>
        <div>
          <b>📸 Projekte zeigen</b>
          <p>Zeigen Sie Ihre Arbeit mit Fotos und holen Sie sich Ideen für die nächste Baustelle.</p>
        </div>
        <div>
          <b>🛡️ Geprüft und moderiert</b>
          <p>Betriebe und Zulieferer weisen sich aus, Werbung ist gekennzeichnet, und es gelten klare Regeln.</p>
        </div>
      </section>
      <section className="mt-who">
        <h2>Wer mitmachen kann</h2>
        <div className="mt-grid">
          {EXTERNAL_KINDS.map((k) => (
            <div key={k.id}>
              <b>{k.title}</b>
              <p>{k.text}</p>
              <small>{k.proof ? `Nachweis: ${k.proof}` : "Bestätigung per E-Mail"}</small>
            </div>
          ))}
        </div>
        <p className="cm-small">
          Sie nutzen schon MalerSaaS? Dann finden Sie den MalerTreff direkt in Ihrem Dashboard – oder melden sich hier mit Ihrem MalerSaaS-Zugang an.
        </p>
      </section>
    </>
  );
}

function Login({ onBack, onRegister }: { onBack: () => void; onRegister?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setMsg({
        ok: false,
        text: /confirm/i.test(error.message) ? "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse (Link in der E-Mail)." : "E-Mail-Adresse oder Passwort stimmt nicht.",
      });
    }
  };
  const reset = async () => {
    if (!email.trim()) return setMsg({ ok: false, text: "Bitte zuerst Ihre E-Mail-Adresse eintragen." });
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: RESET_REDIRECT });
    setMsg({ ok: true, text: "Falls ein Konto existiert, haben wir Ihnen einen Link zum Zurücksetzen geschickt." });
  };
  return (
    <form className="mt-card mt-narrow" onSubmit={login}>
      <h2>Anmelden</h2>
      <label className="cm-field">
        <span>E-Mail</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="cm-field">
        <span>Passwort</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {msg && <p className={`cm-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      <div className="cm-actions left">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Anmelden …" : "Anmelden"}
        </button>
        <button type="button" className="cm-link" onClick={reset}>
          Passwort vergessen?
        </button>
      </div>
      <p className="cm-small">
        <button type="button" className="cm-link" onClick={onBack}>
          ← Zurück
        </button>
        {onRegister && (
          <>
            {" · Noch kein Konto? "}
            <button type="button" className="cm-link" onClick={onRegister}>
              Kostenlos mitmachen
            </button>
          </>
        )}
      </p>
    </form>
  );
}

function Register({ rulesVersion, onBack, onLogin }: { rulesVersion: string; onBack: () => void; onLogin: () => void }) {
  const [f, setF] = useState<SignupForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const set = (patch: Partial<SignupForm>) => setF((x) => (x ? { ...x, ...patch } : x));

  if (sent) {
    return (
      <div className="mt-card mt-narrow">
        <h2>Fast geschafft – bitte E-Mail bestätigen</h2>
        <p>
          Wir haben eine E-Mail an <b>{sent}</b> geschickt. Klicken Sie auf den Link darin, um Ihr Konto zu bestätigen. Danach geht es hier weiter.
        </p>
        <p className="cm-small">Keine E-Mail bekommen? Schauen Sie bitte auch im Spam-Ordner nach.</p>
        <button type="button" className="btn btn-secondary" onClick={onLogin}>
          Zur Anmeldung
        </button>
      </div>
    );
  }

  if (!f) {
    return (
      <div className="mt-card mt-narrow">
        <h2>Als was möchten Sie mitmachen?</h2>
        <div className="mt-kinds">
          {EXTERNAL_KINDS.map((k) => (
            <button type="button" key={k.id} onClick={() => setF(emptySignup(k.id as ExternalKind))}>
              <b>{k.title}</b>
              <span>{k.text}</span>
              <small>{k.proof ? `Nachweis nötig: ${k.proof}` : "Nur E-Mail-Bestätigung"}</small>
            </button>
          ))}
        </div>
        <p className="cm-small">
          <button type="button" className="cm-link" onClick={onBack}>
            ← Zurück
          </button>
          {" · Schon ein Konto? "}
          <button type="button" className="cm-link" onClick={onLogin}>
            Anmelden
          </button>
        </p>
      </div>
    );
  }

  const kind = EXTERNAL_KINDS.find((k) => k.id === f.kind)!;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateSignup(f) ?? passwordProblem(f.password, f.password2);
    if (problem) return setErr(problem);
    setBusy(true);
    setErr(null);
    try {
      await api.signupExternal(f, rulesVersion);
      setSent(f.email.trim());
    } catch (x) {
      setErr(signupErrorText(x as { message?: string }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-card mt-narrow" onSubmit={submit}>
      <h2>Konto erstellen: {kind.title}</h2>
      <div className="mt-two">
        <label className="cm-field">
          <span>Vorname</span>
          <input value={f.first_name} maxLength={40} onChange={(e) => set({ first_name: e.target.value })} autoComplete="given-name" />
        </label>
        <label className="cm-field">
          <span>Nachname</span>
          <input value={f.last_name} maxLength={40} onChange={(e) => set({ last_name: e.target.value })} autoComplete="family-name" />
        </label>
      </div>
      {f.kind === "privat" && <p className="cm-small">Im MalerTreff erscheinen Sie als „{f.first_name || "Vorname"} {(f.last_name || "N")[0]}.“ mit dem Hinweis „Privat“.</p>}
      {f.kind !== "privat" && (
        <label className="cm-field">
          <span>Firma</span>
          <input value={f.company} maxLength={120} onChange={(e) => set({ company: e.target.value })} autoComplete="organization" />
        </label>
      )}
      <div className="mt-two">
        <label className="cm-field">
          <span>{f.kind === "privat" ? "Interesse (freiwillig)" : "Gewerk / Sortiment (freiwillig)"}</span>
          <input
            value={f.trade}
            maxLength={80}
            onChange={(e) => set({ trade: e.target.value })}
            placeholder={f.kind === "privat" ? "z. B. Renovierung, Jobsuche" : f.kind === "zulieferer" ? "z. B. Farben & Lacke" : "z. B. Maler, Fassaden"}
          />
        </label>
        <label className="cm-field">
          <span>Region (freiwillig)</span>
          <input value={f.region} maxLength={80} onChange={(e) => set({ region: e.target.value })} placeholder="z. B. Oberbayern" />
        </label>
      </div>
      {f.kind === "zulieferer" && (
        <div className="mt-two">
          <label className="cm-field">
            <span>Website</span>
            <input value={f.website} maxLength={200} onChange={(e) => set({ website: e.target.value })} placeholder="https://…" />
          </label>
          <label className="cm-field">
            <span>Link zum Impressum</span>
            <input value={f.impressum_url} maxLength={200} onChange={(e) => set({ impressum_url: e.target.value })} placeholder="https://…/impressum" />
          </label>
        </div>
      )}
      <label className="cm-field">
        <span>E-Mail</span>
        <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
      </label>
      <div className="mt-two">
        <label className="cm-field">
          <span>Passwort</span>
          <input type="password" value={f.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
        </label>
        <label className="cm-field">
          <span>Passwort wiederholen</span>
          <input type="password" value={f.password2} onChange={(e) => set({ password2: e.target.value })} autoComplete="new-password" />
        </label>
      </div>
      {kind.proof && <p className="cm-small">Nach der Bestätigung Ihrer E-Mail laden Sie einmalig einen Nachweis hoch ({kind.proof}). Danach schalten wir Sie frei.</p>}
      <label className="cm-check">
        <input type="checkbox" checked={f.age16} onChange={(e) => set({ age16: e.target.checked })} />
        Ich bin mindestens 16 Jahre alt.
      </label>
      <label className="cm-check">
        <input type="checkbox" checked={f.rules} onChange={(e) => set({ rules: e.target.checked })} />
        <span>
          Ich akzeptiere die{" "}
          <button type="button" className="cm-link" onClick={() => setShowRules((v) => !v)}>
            Community-Regeln
          </button>
          .
        </span>
      </label>
      {showRules && <RulesList version={rulesVersion} />}
      <label className="cm-check">
        <input type="checkbox" checked={f.privacy} onChange={(e) => set({ privacy: e.target.checked })} />
        <span>
          Ich habe die{" "}
          <a href="/datenschutz" target="_blank" rel="noreferrer">
            Datenschutzhinweise
          </a>{" "}
          gelesen.
        </span>
      </label>
      {err && <p className="cm-msg err">{err}</p>}
      <div className="cm-actions left">
        <button type="button" className="btn btn-secondary" onClick={() => setF(null)}>
          Zurück
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Wird erstellt …" : "Konto erstellen"}
        </button>
      </div>
    </form>
  );
}
