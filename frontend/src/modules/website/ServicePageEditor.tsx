import { useState } from "react";
import type { WebsiteFaq, WebsiteService } from "./types";
import { guessServiceIcon } from "./types";
import { processImage, uploadImage } from "./api";

type Suggestions = { details: string; included: string[]; faq: WebsiteFaq[] };
const cache = new Map<string, Suggestions>();

/** Vorschlagstexte kommen von der Website-Funktion, damit sie nur an einer Stelle gepflegt werden (frontend/api/site.ts) */
async function loadSuggestions(icon: string): Promise<Suggestions> {
  const hit = cache.get(icon);
  if (hit) return hit;
  const res = await fetch(`/api/site?action=vorschlaege&icon=${encodeURIComponent(icon)}`);
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) throw new Error("Vorschläge sind gerade nicht verfügbar.");
  const data = (await res.json()) as Suggestions;
  cache.set(icon, data);
  return data;
}

const MAX_INCLUDED = 12;
const MAX_FAQ = 8;

/** Inhalte der eigenen Seite einer Leistung: Bild, ausführlicher Text, „Das ist enthalten“, häufige Fragen */
export default function ServicePageEditor({
  service,
  tenantId,
  pageUrl,
  onChange,
  onError,
}: {
  service: WebsiteService;
  tenantId: number;
  pageUrl: string | null;
  onChange: (patch: Partial<WebsiteService>) => void;
  onError: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [loadingSug, setLoadingSug] = useState(false);
  const icon = service.icon || guessServiceIcon(service.title);
  const included = service.included ?? [];
  const faq = service.faq ?? [];
  const own = [service.details?.trim() ? "Text" : "", included.some((x) => x.trim()) ? "Enthalten" : "", faq.some((f) => f.q.trim()) ? "Fragen" : "", service.image ? "Bild" : ""].filter(Boolean);

  const withSuggestions = async (fn: (s: Suggestions) => void) => {
    setLoadingSug(true);
    try {
      fn(await loadSuggestions(icon));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoadingSug(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const img = await uploadImage(tenantId, await processImage(file, 2000), "leistung");
      onChange({ image: img.url });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const setFaq = (i: number, patch: Partial<WebsiteFaq>) => onChange({ faq: faq.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  return (
    <details className="ws-service-more">
      <summary>Eigene Seite für diese Leistung – {own.length ? `eigene Inhalte: ${own.join(", ")}` : "Standardinhalte"}</summary>

      <div className="ws-sp">
        <div className="ws-sp-block">
          <span className="ws-label">Bild oben auf der Seite</span>
          <div className="ws-hero-row">
            {service.image ? <img src={service.image} alt="" className="ws-hero-thumb" /> : <div className="ws-hero-thumb ws-hero-empty">kein Bild</div>}
            <div className="ws-hero-actions">
              <label className="btn btn-secondary btn-small">
                {uploading ? "Wird hochgeladen …" : service.image ? "Anderes Bild" : "Bild hochladen"}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {service.image && (
                <button type="button" className="ws-link" onClick={() => onChange({ image: undefined })}>
                  Bild entfernen
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="ws-sp-block">
          <div className="ws-sp-head">
            <span className="ws-label">Ausführlicher Text</span>
            {!service.details?.trim() && (
              <button type="button" className="ws-link" disabled={loadingSug} onClick={() => withSuggestions((s) => onChange({ details: s.details }))}>
                Standardtext zum Anpassen einfügen
              </button>
            )}
          </div>
          <textarea
            rows={6}
            value={service.details ?? ""}
            onChange={(e) => onChange({ details: e.target.value })}
            maxLength={3000}
            placeholder="Leer lassen für einen passenden Standardtext. Eigene Worte helfen bei Google am meisten: Was genau machen Sie, welche Materialien, was ist Ihnen wichtig? Leerzeile = neuer Absatz."
            aria-label="Ausführlicher Text"
          />
        </div>

        <div className="ws-sp-block">
          <div className="ws-sp-head">
            <span className="ws-label">Das ist enthalten (eine Zeile pro Punkt)</span>
            {!included.some((x) => x.trim()) && (
              <button type="button" className="ws-link" disabled={loadingSug} onClick={() => withSuggestions((s) => onChange({ included: s.included }))}>
                Vorschläge einfügen
              </button>
            )}
          </div>
          <textarea
            rows={5}
            value={included.join("\n")}
            onChange={(e) => onChange({ included: e.target.value.split("\n").slice(0, MAX_INCLUDED) })}
            placeholder={"Leer lassen für passende Vorschläge, z. B.\nKostenlose Besichtigung\nAbdecken von Böden und Möbeln"}
            aria-label="Das ist enthalten"
          />
        </div>

        <div className="ws-sp-block">
          <div className="ws-sp-head">
            <span className="ws-label">Häufige Fragen</span>
            {!faq.some((f) => f.q.trim()) && (
              <button type="button" className="ws-link" disabled={loadingSug} onClick={() => withSuggestions((s) => onChange({ faq: s.faq }))}>
                Vorschläge einfügen
              </button>
            )}
          </div>
          {faq.length === 0 && <p className="tk-muted ws-sp-hint">Ohne eigene Fragen erscheinen passende Standardfragen.</p>}
          {faq.map((f, i) => (
            <div key={i} className="ws-faq">
              <input value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} placeholder="Frage" maxLength={160} aria-label={`Frage ${i + 1}`} />
              <textarea rows={2} value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} placeholder="Antwort" maxLength={800} aria-label={`Antwort ${i + 1}`} />
              <button type="button" className="tk-icon-btn" onClick={() => onChange({ faq: faq.filter((_, j) => j !== i) })} aria-label={`Frage ${i + 1} entfernen`}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-small" disabled={faq.length >= MAX_FAQ} onClick={() => onChange({ faq: [...faq, { q: "", a: "" }] })}>
            + Frage hinzufügen
          </button>
        </div>

        {pageUrl && (
          <a className="ws-link" href={pageUrl} target="_blank" rel="noreferrer">
            Seite ansehen ↗ (zeigt den zuletzt gespeicherten Stand)
          </a>
        )}
      </div>
    </details>
  );
}
