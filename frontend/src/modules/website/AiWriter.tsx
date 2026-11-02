import { useState } from "react";
import type { AiKind } from "./api";
import { aiWrite } from "./api";

type Field = { key: string; label: string; list?: boolean; faq?: boolean };

const FIELDS: Record<AiKind, Field[]> = {
  service: [
    { key: "text", label: "Kurztext (Karte)" },
    { key: "details", label: "Ausführlicher Text" },
    { key: "included", label: "Das ist enthalten", list: true },
    { key: "faq", label: "Häufige Fragen", faq: true },
  ],
  about: [
    { key: "about_title", label: "Überschrift" },
    { key: "about_text", label: "Text „Über uns“" },
  ],
  seo: [
    { key: "hero_title", label: "Überschrift der Startseite" },
    { key: "hero_subtitle", label: "Text darunter" },
    { key: "seo_title", label: "Titel bei Google" },
    { key: "seo_description", label: "Beschreibung bei Google" },
  ],
};

const HINTS: Record<AiKind, string> = {
  service:
    "z. B.: nur mineralische Silikatfarben, eigenes Gerüst, viele Altbauten und Fachwerkhäuser, Farbmuster direkt an der Fassade, Arbeiten nur bei passendem Wetter",
  about:
    "z. B.: Meisterbetrieb seit 1998 in zweiter Generation, 8 Mitarbeiter, 2 Azubis, feste Teams, Inhaber Herbert Prinz ist selbst auf jeder Baustelle, Wert auf Sauberkeit",
  seo: "z. B.: Schwerpunkte Fassaden und Altbausanierung, Privat- und Gewerbekunden, kostenlose Besichtigung",
};

/**
 * KI-Schreibhilfe: Stichworte eingeben → Vorschlag ansehen → übernehmen.
 * Der Vorschlag wird erst gespeichert, wenn der Betrieb ihn übernimmt und anschließend auf „Speichern“ klickt.
 */
export default function AiWriter({
  kind,
  service,
  onApply,
  label = "✨ Mit KI schreiben",
}: {
  kind: AiKind;
  service?: { title: string; text?: string };
  onApply: (result: Record<string, unknown>) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await aiWrite(kind, keywords, service);
      setResult(r.result);
      setUsage({ used: r.used, limit: r.limit });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setResult(null);
    setError("");
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary btn-small ws-ai-btn" onClick={() => setOpen(true)} disabled={kind === "service" && !service?.title.trim()}>
        {label}
      </button>
    );
  }

  return (
    <div className="ws-ai" role="group" aria-label="KI-Schreibhilfe">
      <div className="ws-ai-head">
        <strong>✨ KI-Schreibhilfe</strong>
        <button type="button" className="tk-icon-btn" onClick={close} aria-label="Schließen">
          ×
        </button>
      </div>
      <label className="tk-field">
        <span>Was macht Ihren Betrieb {kind === "service" ? `bei „${service?.title}“ ` : ""}aus? Stichworte genügen.</span>
        <textarea rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} maxLength={1200} placeholder={HINTS[kind]} />
        <small className="tk-muted">
          Je konkreter, desto besser. Die KI nutzt nur Ihre Angaben und Firmendaten und erfindet keine Fakten – bitte den Vorschlag trotzdem prüfen.
        </small>
      </label>
      <div className="ws-row">
        <button type="button" className="btn btn-primary btn-small" onClick={run} disabled={busy}>
          {busy ? "KI schreibt … (ca. 10–20 Sek.)" : result ? "Neuen Vorschlag schreiben" : "Vorschlag schreiben"}
        </button>
        {usage && (
          <span className="tk-muted">
            {usage.used} von {usage.limit} KI-Texten in diesem Monat genutzt
          </span>
        )}
      </div>
      {error && <div className="tk-notice tk-notice-error">{error}</div>}

      {result && (
        <div className="ws-ai-result">
          {FIELDS[kind].map((f) => {
            const v = result[f.key];
            if (f.faq) {
              const list = (Array.isArray(v) ? v : []) as { q: string; a: string }[];
              return list.length ? (
                <div key={f.key} className="ws-ai-field">
                  <span className="ws-label">{f.label}</span>
                  {list.map((x, i) => (
                    <p key={i}>
                      <strong>{x.q}</strong>
                      <br />
                      {x.a}
                    </p>
                  ))}
                </div>
              ) : null;
            }
            if (f.list) {
              const list = (Array.isArray(v) ? v : []) as string[];
              return list.length ? (
                <div key={f.key} className="ws-ai-field">
                  <span className="ws-label">{f.label}</span>
                  <ul>
                    {list.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null;
            }
            return v ? (
              <div key={f.key} className="ws-ai-field">
                <span className="ws-label">{f.label}</span>
                <p className="ws-ai-text">{String(v)}</p>
              </div>
            ) : null;
          })}
          <div className="ws-row">
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => {
                onApply(result);
                close();
              }}
            >
              Übernehmen
            </button>
            <span className="tk-muted">Ersetzt die bisherigen Texte in diesen Feldern. Danach unten auf „Änderungen speichern“ klicken.</span>
          </div>
        </div>
      )}
    </div>
  );
}
