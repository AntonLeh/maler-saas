// Kontaktformular der Startseite → Funktion „contact-form“ (E-Mail an info@maler-saas.com)
import { useRef, useState } from "react";
import { supabaseUrl } from "../lib/supabase";

export default function ContactForm(props: { onOpenDatenschutz: () => void }) {
  const started = useRef(Date.now());
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", message: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || form.message.trim().length < 10) {
      setError("Bitte Name, E-Mail-Adresse und eine Nachricht (mindestens 10 Zeichen) angeben.");
      return;
    }
    if (!consent) {
      setError("Bitte bestätigen Sie den Hinweis zum Datenschutz.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/contact-form`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, elapsed: Date.now() - started.current }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || "Die Nachricht konnte nicht gesendet werden.");
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(`${err instanceof Error ? err.message : "Fehler"} Sie können uns auch direkt an info@maler-saas.com schreiben.`);
    }
  };

  if (state === "sent") {
    return (
      <div className="lp-form lp-form-done" role="status">
        <strong>Vielen Dank für Ihre Nachricht!</strong>
        <p>Wir melden uns so bald wie möglich bei Ihnen. Wir antworten an {form.email}.</p>
      </div>
    );
  }

  return (
    <form className="lp-form" onSubmit={submit} noValidate>
      <div className="lp-form-row">
        <label>
          Name *
          <input value={form.name} onChange={set("name")} autoComplete="name" maxLength={100} required />
        </label>
        <label>
          Firma
          <input value={form.company} onChange={set("company")} autoComplete="organization" maxLength={120} />
        </label>
      </div>
      <div className="lp-form-row">
        <label>
          E-Mail *
          <input type="email" value={form.email} onChange={set("email")} autoComplete="email" maxLength={200} required />
        </label>
        <label>
          Telefon
          <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" maxLength={40} />
        </label>
      </div>
      <label>
        Nachricht *
        <textarea value={form.message} onChange={set("message")} rows={5} maxLength={4000} required />
      </label>
      {/* Falle für Spam-Programme – für Menschen unsichtbar */}
      <label className="lp-hp" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </label>
      <label className="lp-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Ich bin einverstanden, dass meine Angaben zur Beantwortung meiner Anfrage verarbeitet werden. Mehr dazu in der{" "}
          <button type="button" onClick={props.onOpenDatenschutz}>
            Datenschutzerklärung
          </button>
          .
        </span>
      </label>
      {error && <p className="lp-form-error">{error}</p>}
      <button type="submit" className="landing-primary-btn" disabled={state === "sending"}>
        {state === "sending" ? "Wird gesendet …" : "Nachricht senden"}
      </button>
    </form>
  );
}
