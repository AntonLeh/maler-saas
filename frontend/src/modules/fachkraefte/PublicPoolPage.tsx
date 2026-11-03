import { useEffect, useRef, useState } from "react";
import SeoMeta from "../../components/SeoMeta";
import DatenschutzPage from "../../pages/DatenschutzPage";
import ImpressumPage from "../../pages/ImpressumPage";
import ProfileForm from "./ProfileForm";
import * as api from "./api";
import type { PoolContactForWorker, PoolProfile } from "./types";
import { EMPTY_PROFILE } from "./types";
import "./fachkraefte.css";

/**
 * Öffentliche Seiten des Fachkräfte-Pools auf maler-saas.com:
 *   /fachkraefte           Infos + Anmeldung
 *   /fachkraefte/profil    eigenes Profil (Link aus der E-Mail)
 *   /fachkraefte/anfrage   Kontaktanfrage eines Betriebs beantworten (Link aus der E-Mail)
 */
export default function PublicPoolPage() {
  const [legal, setLegal] = useState<"" | "impressum" | "datenschutz">("");
  const path = window.location.pathname.replace(/\/+$/, "");
  const params = new URLSearchParams(window.location.search);

  if (legal === "impressum") return <ImpressumPage onBack={() => setLegal("")} />;
  if (legal === "datenschutz") return <DatenschutzPage onBack={() => setLegal("")} />;

  return (
    <div className="fk-page">
      <SeoMeta
        title="Fachkräfte-Pool für Maler: Arbeit im Malerhandwerk finden | MalerSaaS"
        description="Maler, Helfer und Subunternehmer: Tragen Sie sich kostenlos in den Fachkräfte-Pool ein. Malerbetriebe in Ihrer Nähe finden Sie – Ihre Kontaktdaten erhalten sie nur mit Ihrer Zustimmung."
        canonical="https://maler-saas.com/fachkraefte"
      />
      <header className="fk-top">
        <a href="/fachkraefte" className="fk-brand">
          <img src="/images/logo.png" alt="" />
          <span>
            <strong>MalerSaaS</strong> Fachkräfte-Pool
          </span>
        </a>
        <nav className="fk-top-nav">
          <a className="fk-top-link" href="/fachkraefte#zugang">
            Mein Profil
          </a>
          <a className="fk-top-link" href="/">
            Für Malerbetriebe
          </a>
        </nav>
      </header>
      <main className="fk-main">
        {path === "/fachkraefte/profil" ? (
          <ProfileView token={params.get("t") ?? ""} noch={params.get("noch") === "1"} onPrivacy={() => setLegal("datenschutz")} />
        ) : path === "/fachkraefte/anfrage" ? (
          <ContactView token={params.get("t") ?? ""} hint={params.get("antwort")} />
        ) : (
          <SignupView onPrivacy={() => setLegal("datenschutz")} />
        )}
      </main>
      <footer className="fk-foot">
        <button type="button" onClick={() => setLegal("impressum")}>
          Impressum
        </button>
        <button type="button" onClick={() => setLegal("datenschutz")}>
          Datenschutz
        </button>
        <span>Ortsdaten © OpenStreetMap-Mitwirkende</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------
// Anmeldung
// ---------------------------------------------------------------------
function SignupView({ onPrivacy }: { onPrivacy: () => void }) {
  const [p, setP] = useState<PoolProfile>(EMPTY_PROFILE);
  const [consent, setConsent] = useState(false);
  const [honey, setHoney] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const started = useRef(Date.now());
  const formRef = useRef<HTMLDivElement | null>(null);
  // Sprungmarke (#zugang, #anmelden) nach dem Aufbau der Seite anspringen
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const submit = async () => {
    setError("");
    if (!p.role) return setError("Bitte angeben, was Sie sind.");
    if (!p.wants.length) return setError("Bitte angeben, was Sie suchen.");
    if (!/^\d{5}$/.test(p.plz)) return setError("Bitte Ihre Postleitzahl (5 Ziffern) angeben.");
    if (p.first_name.trim().length < 2 || p.last_name.trim().length < 2) return setError("Bitte Vor- und Nachnamen angeben.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(p.email.trim())) return setError("Bitte eine gültige E-Mail-Adresse angeben.");
    if (!consent) return setError("Bitte der Verarbeitung Ihrer Angaben zustimmen.");
    setBusy(true);
    try {
      await api.signup(p, { consent, website: honey, t: started.current });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="fk-card fk-done">
        <div className="fk-done-icon" aria-hidden="true">
          ✉️
        </div>
        <h1>Fast geschafft!</h1>
        <p>
          Wir haben Ihnen eine E-Mail an <strong>{p.email}</strong> geschickt. Bitte klicken Sie dort auf <strong>„Anmeldung bestätigen“</strong> – erst
          dann ist Ihr Profil für Malerbetriebe sichtbar.
        </p>
        <p>
          <strong>Wichtig:</strong> Der Knopf in dieser E-Mail ist gleichzeitig Ihr <strong>persönlicher Zugang zu Ihrem Profil</strong> – ein Passwort
          brauchen Sie nicht. Bitte heben Sie die E-Mail auf.
        </p>
        <p className="fk-muted">Keine E-Mail bekommen? Schauen Sie bitte auch im Spam-Ordner nach.</p>
      </section>
    );
  }

  return (
    <>
      <section className="fk-hero">
        <h1>Arbeit im Malerhandwerk finden – kostenlos</h1>
        <p className="fk-lead">
          Sie sind Maler/in, Helfer/in oder Subunternehmer und suchen eine neue Stelle, Aushilfsjobs oder Aufträge? Tragen Sie sich in zwei Minuten ein.
          Malerbetriebe in Ihrer Nähe finden Sie – und Sie entscheiden selbst, wer Ihre Kontaktdaten bekommt.
        </p>
        <ul className="fk-points">
          <li>
            <strong>100 % kostenlos</strong> – jetzt und später
          </li>
          <li>
            <strong>Anonym</strong> – Betriebe sehen weder Namen noch Telefonnummer
          </li>
          <li>
            <strong>Sie entscheiden</strong> – Kontakt nur mit Ihrer Zustimmung
          </li>
        </ul>
        <button type="button" className="fk-btn" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}>
          Jetzt eintragen
        </button>
      </section>

      <section className="fk-steps">
        <div>
          <span>1</span>
          <h3>Eintragen</h3>
          <p>Ein paar Angaben zu Ihnen, Ihrem Wohnort und was Sie suchen. Kein Lebenslauf nötig.</p>
        </div>
        <div>
          <span>2</span>
          <h3>Gefunden werden</h3>
          <p>Malerbetriebe, die mit MalerSaaS arbeiten, sehen Ihr anonymes Profil, wenn Sie in der Nähe wohnen.</p>
        </div>
        <div>
          <span>3</span>
          <h3>Selbst entscheiden</h3>
          <p>Möchte ein Betrieb Sie kennenlernen, bekommen Sie eine E-Mail. Mit einem Klick geben Sie Ihre Kontaktdaten frei – oder nicht.</p>
        </div>
      </section>

      <section className="fk-card" ref={formRef} id="anmelden">
        <h2>Kostenlos eintragen</h2>
        <ProfileForm value={p} onChange={setP} signup />
        <div className="fk-hp" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
          </label>
        </div>
        <label className="fk-check fk-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Ich bin einverstanden, dass MalerSaaS meine Angaben speichert und mein Profil <strong>ohne Namen und Kontaktdaten</strong> Malerbetrieben zeigt,
            die MalerSaaS nutzen. Name, E-Mail und Telefon erhält ein Betrieb nur, wenn ich seiner Anfrage zustimme. Ich kann mein Profil jederzeit
            löschen. Mehr in der{" "}
            <button type="button" className="fk-link" onClick={onPrivacy}>
              Datenschutzerklärung
            </button>
            .
          </span>
        </label>
        {error && (
          <div className="fk-error" role="alert">
            {error}
          </div>
        )}
        <button type="button" className="fk-btn fk-btn-wide" onClick={submit} disabled={busy}>
          {busy ? "Wird gesendet …" : "Kostenlos eintragen"}
        </button>
      </section>

      <section className="fk-card" id="zugang">
        <h2>Schon eingetragen?</h2>
        <AccessLinkForm intro="Ein Passwort gibt es nicht: Ihr Zugang ist der Link aus unserer E-Mail. Haben Sie die E-Mail nicht mehr, schicken wir Ihnen hier einen neuen Link." />
      </section>

      <section className="fk-faq">
        <h2>Häufige Fragen</h2>
        <details>
          <summary>Kostet das etwas?</summary>
          <p>Nein. Die Eintragung und die Vermittlung sind für Fachkräfte komplett kostenlos.</p>
        </details>
        <details>
          <summary>Wer sieht meine Daten?</summary>
          <p>
            Malerbetriebe, die MalerSaaS nutzen, sehen nur: was Sie sind und suchen, Ihren ungefähren Ort (nur den Ortsnamen und die Entfernung, nicht
            Ihre Adresse), ab wann Sie verfügbar sind und was Sie sonst freiwillig angeben. Name, E-Mail und Telefonnummer bekommt ein Betrieb erst,
            wenn Sie seiner Anfrage zustimmen.
          </p>
        </details>
        <details>
          <summary>Wie lösche ich mein Profil?</summary>
          <p>
            Über den Link in Ihrer Bestätigungs-E-Mail kommen Sie jederzeit zu Ihrem Profil. Dort können Sie es pausieren oder sofort löschen. Profile,
            die 90 Tage nicht bestätigt werden, blenden wir automatisch aus und löschen sie nach 12 Monaten.
          </p>
        </details>
        <details>
          <summary>Ich bin selbstständig – was muss ich beachten?</summary>
          <p>
            Maler und Lackierer ist ein zulassungspflichtiges Handwerk: Für eigene Aufträge brauchen Sie in der Regel eine Eintragung in der
            Handwerksrolle. Arbeiten Sie dauerhaft nur für einen Betrieb, kann außerdem Scheinselbstständigkeit vorliegen. MalerSaaS stellt nur den
            Kontakt her – Vertrag und Bedingungen vereinbaren Sie direkt mit dem Betrieb.
          </p>
        </details>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------
// Eigenes Profil (Link aus der E-Mail)
// ---------------------------------------------------------------------
function ProfileView({ token, noch, onPrivacy }: { token: string; noch: boolean; onPrivacy: () => void }) {
  const [p, setP] = useState<PoolProfile | null>(null);
  const [saved, setSaved] = useState<PoolProfile | null>(null);
  const [contacts, setContacts] = useState<PoolContactForWorker[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .loadProfile(token, noch)
      .then((r) => {
        if (cancelled) return;
        setP(r.profile);
        setSaved(r.profile);
        setContacts(r.contacts);
        if (noch) setNotice("Danke! Ihr Profil bleibt weitere 90 Tage sichtbar.");
        // eine neue Anmeldung erkennen wir daran, dass noch keine Anfrage da ist und das Profil gerade erst erstellt wurde
        else if (!r.contacts.length) setFirstVisit(true);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [token, noch]);

  const run = async (fn: () => Promise<{ profile: PoolProfile; contacts: PoolContactForWorker[] }>, msg: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fn();
      setP(r.profile);
      setSaved(r.profile);
      setContacts(r.contacts);
      setNotice(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (deleted) {
    return (
      <section className="fk-card fk-done">
        <h1>Ihr Profil ist gelöscht.</h1>
        <p>Alle Ihre Angaben und Kontaktanfragen wurden entfernt. Sie können sich jederzeit wieder eintragen.</p>
        <a className="fk-btn" href="/fachkraefte">
          Zur Startseite des Pools
        </a>
      </section>
    );
  }
  if (!p) {
    return (
      <section className="fk-card fk-done">
        {error ? (
          <>
            <h1>Link nicht gültig</h1>
            <p>{error}</p>
            <AccessLinkForm intro="Wir schicken Ihnen gerne einen neuen Zugangslink:" />
          </>
        ) : (
          <p>Profil wird geladen …</p>
        )}
      </section>
    );
  }

  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  return (
    <>
      <section className={`fk-card fk-status ${p.status}`}>
        {firstVisit && p.status === "active" && <p className="fk-ok">✓ Ihre E-Mail-Adresse ist bestätigt.</p>}
        <h1>Ihr Profil im Fachkräfte-Pool</h1>
        {p.status === "active" ? (
          <p>
            <strong>● Sichtbar</strong> für Malerbetriebe im Umkreis von {p.radius_km} km um {p.ort || p.plz} – ohne Namen und Kontaktdaten. Sichtbar bis{" "}
            {p.visible_until ? new Date(`${p.visible_until}T12:00:00`).toLocaleDateString("de-DE") : "–"}; vorher fragen wir per E-Mail nach, ob Sie noch suchen.
          </p>
        ) : (
          <p>
            <strong>○ Pausiert</strong> – Betriebe sehen Ihr Profil gerade nicht.
          </p>
        )}
        {notice && (
          <p className="fk-ok" role="status">
            {notice}
          </p>
        )}
        {error && (
          <div className="fk-error" role="alert">
            {error}
          </div>
        )}
        <div className="fk-row">
          {p.status === "active" ? (
            <button type="button" className="fk-btn fk-btn-ghost" disabled={busy} onClick={() => run(() => api.setStatus(token, "paused"), "Ihr Profil ist pausiert.")}>
              Pausieren
            </button>
          ) : (
            <button type="button" className="fk-btn" disabled={busy} onClick={() => run(() => api.setStatus(token, "active"), "Ihr Profil ist wieder sichtbar.")}>
              Wieder sichtbar machen
            </button>
          )}
          <button
            type="button"
            className="fk-link fk-danger"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Profil endgültig löschen? Das lässt sich nicht rückgängig machen.")) return;
              setBusy(true);
              try {
                await api.deleteProfile(token);
                setDeleted(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Profil löschen
          </button>
        </div>
        <p className="fk-muted fk-small">Ihr Zugang ist der Link aus unserer neuesten E-Mail – ein Passwort gibt es nicht. Tipp: Setzen Sie sich ein Lesezeichen auf diese Seite. Link verloren? Unter maler-saas.com/fachkraefte → „Mein Profil“ schicken wir Ihnen einen neuen.</p>
      </section>

      <section className="fk-card">
        <h2>Kontaktanfragen</h2>
        {contacts.length === 0 ? (
          <p className="fk-muted">Noch keine. Sobald ein Betrieb Sie kennenlernen möchte, bekommen Sie eine E-Mail.</p>
        ) : (
          <ul className="fk-list">
            {contacts.map((c) => (
              <li key={c.id}>
                <strong>{c.company}</strong>
                {c.city ? ` · ${c.city}` : ""}
                <span className={`fk-badge ${c.status}`}>{c.status === "offen" ? "wartet auf Ihre Antwort" : c.status === "angenommen" ? "Kontaktdaten freigegeben" : "abgelehnt"}</span>
                {c.message && <p>{c.message}</p>}
                {c.status === "offen" && <p className="fk-muted fk-small">Antworten Sie über die Buttons in der E-Mail des Betriebs.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="fk-card">
        <h2>Angaben ändern</h2>
        <ProfileForm value={p} onChange={setP} signup={false} />
        <div className="fk-row fk-save">
          {dirty && <span className="fk-muted">Ungespeicherte Änderungen</span>}
          <button type="button" className="fk-btn" disabled={busy || !dirty} onClick={() => run(() => api.updateProfile(token, p), "Ihre Änderungen sind gespeichert.")}>
            Änderungen speichern
          </button>
        </div>
        <p className="fk-muted fk-small">
          Ihre Angaben verarbeiten wir wie in der{" "}
          <button type="button" className="fk-link" onClick={onPrivacy}>
            Datenschutzerklärung
          </button>{" "}
          beschrieben.
        </p>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------
// Kontaktanfrage beantworten
// ---------------------------------------------------------------------
function ContactView({ token, hint }: { token: string; hint: string | null }) {
  const [info, setInfo] = useState<{ status: string; message: string | null; created_at: string; company: string; city: string | null } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<"" | "angenommen" | "abgelehnt">("");

  useEffect(() => {
    let cancelled = false;
    api
      .getContact(token)
      .then((r) => !cancelled && setInfo(r))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const answer = async (accept: boolean) => {
    setBusy(true);
    setError("");
    try {
      const r = await api.answerContact(token, accept);
      setAnswered(r.status as "angenommen" | "abgelehnt");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return (
      <section className="fk-card fk-done">
        {error ? (
          <>
            <h1>Anfrage nicht gefunden</h1>
            <p>{error}</p>
          </>
        ) : (
          <p>Anfrage wird geladen …</p>
        )}
      </section>
    );
  }
  const status = answered || info.status;
  return (
    <section className="fk-card fk-done">
      <h1>Kontaktanfrage von {info.company}</h1>
      {info.city && <p className="fk-muted">{info.city}</p>}
      {info.message && <blockquote className="fk-quote">{info.message}</blockquote>}
      {status === "offen" ? (
        <>
          <p>
            Sollen wir <strong>{info.company}</strong> Ihren Namen, Ihre Telefonnummer und Ihre E-Mail-Adresse geben? Der Betrieb meldet sich dann direkt
            bei Ihnen.
          </p>
          {error && (
            <div className="fk-error" role="alert">
              {error}
            </div>
          )}
          <div className="fk-row fk-center">
            <button type="button" className={`fk-btn fk-btn-green${hint === "ja" ? " fk-focus" : ""}`} disabled={busy} onClick={() => answer(true)}>
              Ja, Kontaktdaten weitergeben
            </button>
            <button type="button" className={`fk-btn fk-btn-ghost${hint === "nein" ? " fk-focus" : ""}`} disabled={busy} onClick={() => answer(false)}>
              Nein, danke
            </button>
          </div>
          <p className="fk-muted fk-small">Ohne Ihre Zustimmung erfährt der Betrieb nichts über Sie.</p>
        </>
      ) : status === "angenommen" ? (
        <p className="fk-ok">✓ Erledigt – {info.company} hat Ihre Kontaktdaten erhalten und meldet sich bei Ihnen. Viel Erfolg!</p>
      ) : (
        <p className="fk-ok">Alles klar – {info.company} erhält keine Kontaktdaten von Ihnen.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Zugangslink per E-Mail anfordern (für bereits Eingetragene)
// ---------------------------------------------------------------------
function AccessLinkForm({ intro }: { intro?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.sendLink(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (sent) {
    return (
      <p className="fk-ok" role="status">
        Falls für {email} ein Profil besteht, ist der Zugangslink jetzt unterwegs. Bitte auch im Spam-Ordner nachsehen.
      </p>
    );
  }
  return (
    <form className="fk-access" onSubmit={submit}>
      {intro && <p className="fk-muted">{intro}</p>}
      <div className="fk-row">
        <label className="fk-field fk-grow">
          <span>Ihre E-Mail-Adresse</span>
          <input type="email" required value={email} maxLength={160} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" className="fk-btn" disabled={busy}>
          {busy ? "Wird gesendet …" : "Zugangslink schicken"}
        </button>
      </div>
      {error && (
        <div className="fk-error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
