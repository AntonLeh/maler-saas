import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { loadNumberRequest, refreshNumberRequest, submitNumberRequest } from "./api";
import { BUNDESLAENDER, NUMBER_DOC_KINDS } from "./types";
import type { AiPhoneNumber, NumberDocKind } from "./types";

type DocSlot = { file: File | null; kind: NumberDocKind };

function prettyNumber(e164: string) {
  return e164.startsWith("+49") ? `0${e164.slice(3)}` : e164;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Rufumleitung einrichten – kurze Anleitung */
function ForwardingHelp({ number }: { number: string }) {
  const n = prettyNumber(number);
  return (
    <details className="kt-forward" open>
      <summary>So leitest du Anrufe an die KI weiter</summary>
      <ol>
        <li>
          <strong>Handy (alle Netze):</strong> Für „bei Nichtannahme nach ca. 20 Sekunden“ wähle{" "}
          <code>**61*{n}**20#</code> und drücke die Anruftaste. Ausschalten: <code>##61#</code>.
        </li>
        <li>
          <strong>Wenn besetzt:</strong> <code>**67*{n}#</code> · <strong>Immer weiterleiten</strong> (z. B. Urlaub):{" "}
          <code>**21*{n}#</code>, ausschalten mit <code>##21#</code>.
        </li>
        <li>
          <strong>Festnetz mit Router (z. B. FRITZ!Box):</strong> Telefonie → Rufbehandlung → Rufumleitung → neue
          Rufumleitung: „bei Nichtannahme“ an <code>{n}</code>.
        </li>
        <li>Danach einmal von einem anderen Telefon die Firmennummer anrufen und nicht abheben – die KI sollte sich melden.</li>
      </ol>
      <p className="tk-muted">Hinweis: Bei manchen Anbietern kostet die Weiterleitung die üblichen Gesprächsgebühren ins deutsche Festnetz.</p>
    </details>
  );
}

export default function NumberPanel({
  tenantId,
  enabled,
  defaultCompany,
  defaultEmail,
}: {
  tenantId: number;
  enabled: boolean;
  defaultCompany: string;
  defaultEmail: string;
}) {
  const [row, setRow] = useState<AiPhoneNumber | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [f, setF] = useState({
    business_name: "",
    registration_number: "",
    rep_first_name: "",
    rep_last_name: "",
    rep_email: "",
    website: "",
    street: "",
    postal_code: "",
    city: "",
    region: "",
    area_code: "",
    document_issue_date: "",
  });
  const [docs, setDocs] = useState<DocSlot[]>([{ file: null, kind: "handelsregister" }]);
  const [confirmed, setConfirmed] = useState(false);

  const fill = useCallback(
    (r: AiPhoneNumber | null) => {
      setF({
        business_name: r?.business_name ?? defaultCompany ?? "",
        registration_number: r?.registration_number ?? "",
        rep_first_name: r?.rep_first_name ?? "",
        rep_last_name: r?.rep_last_name ?? "",
        rep_email: r?.rep_email ?? defaultEmail ?? "",
        website: r?.website ?? "",
        street: r?.street ?? "",
        postal_code: r?.postal_code ?? "",
        city: r?.city ?? "",
        region: r?.region ?? "",
        area_code: r?.area_code ? `0${r.area_code}` : "",
        document_issue_date: r?.document_issue_date ?? "",
      });
    },
    [defaultCompany, defaultEmail]
  );

  const refresh = useCallback(
    async (askTwilio: boolean) => {
      setError(null);
      try {
        const r = askTwilio ? (await refreshNumberRequest()).number : await loadNumberRequest(tenantId);
        setRow(r);
        return r;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [tenantId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await loadNumberRequest(tenantId);
      if (cancelled) return;
      setRow(r);
      fill(r);
      setLoaded(true);
      // Beim Öffnen einmal bei Twilio nachfragen, falls der Antrag läuft
      if (r && ["eingereicht", "freigegeben"].includes(r.status)) {
        const r2 = await refreshNumberRequest().catch(() => null);
        if (!cancelled && r2?.number) setRow(r2.number);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, fill]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const files = docs.filter((d) => d.file);
    if (!files.length) {
      setError("Bitte mindestens einen Nachweis hochladen.");
      return;
    }
    const big = files.find((d) => (d.file?.size ?? 0) > 5 * 1024 * 1024);
    if (big) {
      setError(`„${big.file?.name}“ ist größer als 5 MB.`);
      return;
    }
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => form.append(k, v));
    files.forEach((d, i) => {
      form.append(`doc_${i}`, d.file as File);
      form.append(`doc_kind_${i}`, d.kind);
    });
    setBusy(true);
    try {
      const res = await submitNumberRequest(form);
      setRow(res.number);
      setEditing(false);
    } catch (err) {
      const e2 = err as Error & { number?: AiPhoneNumber | null };
      if (e2.number) setRow(e2.number);
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  const status = row?.status ?? "neu";
  const showForm = enabled && (editing || !row || ["entwurf", "fehler", "abgelehnt"].includes(status));

  return (
    <section className="kt-panel kt-number">
      <h3>Telefonnummer</h3>

      {!enabled && <p className="tk-muted">Die Telefonnummer kann beantragt werden, sobald der KI-Assistent aktiviert ist.</p>}

      {enabled && status === "aktiv" && row?.phone_number && (
        <>
          <div className="kt-number-active">
            <span>Deine KI-Telefonnummer</span>
            <strong>{prettyNumber(row.phone_number)}</strong>
            <span className="tk-muted">aktiv seit {formatDate(row.activated_at)}</span>
          </div>
          <ForwardingHelp number={row.phone_number} />
        </>
      )}

      {enabled && status === "eingereicht" && (
        <div className="kt-number-wait">
          <p>
            <strong>Antrag eingereicht</strong> am {formatDate(row?.submitted_at ?? null)}. Die Unterlagen werden geprüft –
            das dauert meist 1–3 Werktage. Du bekommst eine E-Mail, sobald die Nummer bereit ist.
          </p>
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => refresh(true)}>
            Status prüfen
          </button>
        </div>
      )}

      {enabled && status === "freigegeben" && (
        <div className="kt-number-wait">
          <p>
            <strong>Unterlagen freigegeben.</strong> Deine Nummer mit der Vorwahl 0{row?.area_code} wird gerade eingerichtet.
          </p>
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => refresh(true)}>
            Status prüfen
          </button>
        </div>
      )}

      {enabled && status === "abgelehnt" && (
        <div className="tk-notice tk-notice-error">
          <span>
            Der Antrag wurde abgelehnt{row?.failure_reason ? `: ${row.failure_reason}` : "."} Bitte Angaben und Nachweis prüfen
            und erneut einreichen.
          </span>
        </div>
      )}

      {enabled && row?.last_error && status !== "aktiv" && (
        <div className="tk-notice tk-notice-error">
          <span>{row.last_error}</span>
        </div>
      )}

      {showForm && (
        <form className="kt-number-form" onSubmit={onSubmit}>
          <p>
            Damit deine Kunden eine vertraute <strong>Ortsnummer mit deiner Vorwahl</strong> sehen, müssen wir die Nummer auf
            deinen Betrieb anmelden. Das schreibt die Bundesnetzagentur vor. Die laufenden Kosten der Nummer sind im
            Business-Tarif enthalten.
          </p>
          <div className="tk-notice tk-notice-info">
            <span>
              Wichtig: Name und Adresse müssen <strong>genau so</strong> wie auf deinem Nachweis stehen, und die Adresse muss im
              Ortsnetz der gewünschten Vorwahl liegen.
            </span>
          </div>

          <h4>Betrieb</h4>
          <div className="tk-form">
            <label className="tk-field tk-span-2">
              <span>Firmenname laut Nachweis *</span>
              <input value={f.business_name} onChange={set("business_name")} required placeholder="z. B. Malerbetrieb Müller GmbH" />
            </label>
            <label className="tk-field">
              <span>Handelsregisternr. oder Steuernummer *</span>
              <input value={f.registration_number} onChange={set("registration_number")} required placeholder="HRB 12345 oder 12/345/67890" />
            </label>
            <label className="tk-field">
              <span>Webseite (optional)</span>
              <input value={f.website} onChange={set("website")} placeholder="https://…" />
            </label>
          </div>

          <h4>Betriebsadresse</h4>
          <div className="tk-form">
            <label className="tk-field tk-span-2">
              <span>Straße und Hausnummer *</span>
              <input value={f.street} onChange={set("street")} required />
            </label>
            <label className="tk-field">
              <span>PLZ *</span>
              <input value={f.postal_code} onChange={set("postal_code")} required inputMode="numeric" pattern="\d{5}" maxLength={5} />
            </label>
            <label className="tk-field">
              <span>Ort *</span>
              <input value={f.city} onChange={set("city")} required />
            </label>
            <label className="tk-field">
              <span>Bundesland *</span>
              <select value={f.region} onChange={set("region")} required>
                <option value="">Bitte wählen …</option>
                {BUNDESLAENDER.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="tk-field">
              <span>Gewünschte Ortsvorwahl *</span>
              <input value={f.area_code} onChange={set("area_code")} required placeholder="z. B. 06571" inputMode="tel" />
            </label>
          </div>

          <h4>Ansprechpartner</h4>
          <div className="tk-form">
            <label className="tk-field">
              <span>Vorname *</span>
              <input value={f.rep_first_name} onChange={set("rep_first_name")} required />
            </label>
            <label className="tk-field">
              <span>Nachname *</span>
              <input value={f.rep_last_name} onChange={set("rep_last_name")} required />
            </label>
            <label className="tk-field tk-span-2">
              <span>E-Mail *</span>
              <input type="email" value={f.rep_email} onChange={set("rep_email")} required />
            </label>
          </div>

          <h4>Nachweis</h4>
          <p className="tk-muted">
            Am einfachsten: ein aktueller <strong>Handelsregisterauszug</strong>. Ohne Handelsregister: die{" "}
            <strong>Gewerbeanmeldung</strong> und zusätzlich ein <strong>Schreiben vom Finanzamt</strong> mit deiner
            Steuernummer. PDF, JPG oder PNG, je max. 5 MB. Die Dateien werden nur an den Telefonanbieter weitergegeben und bei uns
            nicht gespeichert.
          </p>
          {docs.map((d, i) => (
            <div key={i} className="kt-doc-row">
              <select
                value={d.kind}
                onChange={(e) => setDocs((prev) => prev.map((x, j) => (j === i ? { ...x, kind: e.target.value as NumberDocKind } : x)))}
              >
                {NUMBER_DOC_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setDocs((prev) => prev.map((x, j) => (j === i ? { ...x, file } : x)));
                }}
              />
              {docs.length > 1 && (
                <button type="button" className="kt-link" onClick={() => setDocs((prev) => prev.filter((_, j) => j !== i))}>
                  entfernen
                </button>
              )}
            </div>
          ))}
          {docs.length < 3 && (
            <button
              type="button"
              className="kt-link"
              onClick={() => setDocs((prev) => [...prev, { file: null, kind: prev[0]?.kind === "gewerbe" ? "steuer" : "gewerbe" }])}
            >
              + weiteren Nachweis hinzufügen
            </button>
          )}
          {docs.some((d) => d.kind === "handelsregister") && (
            <label className="tk-field kt-issue-date">
              <span>Ausstellungsdatum des Handelsregisterauszugs</span>
              <input type="date" value={f.document_issue_date} onChange={set("document_issue_date")} />
            </label>
          )}

          <label className="kt-confirm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>
              Ich bestätige, dass die Angaben stimmen und ich berechtigt bin, für diesen Betrieb eine Telefonnummer zu beantragen.
              Die Angaben und Nachweise werden dafür an unseren Telefonanbieter (Twilio) übermittelt.
            </span>
          </label>

          {error && (
            <div className="tk-notice tk-notice-error">
              <span>{error}</span>
            </div>
          )}

          <div className="kt-number-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !confirmed}>
              {busy ? "Wird eingereicht … (bis zu 1 Min.)" : "Telefonnummer beantragen"}
            </button>
            {editing && (
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={busy}>
                Abbrechen
              </button>
            )}
          </div>
        </form>
      )}

      {!showForm && error && (
        <div className="tk-notice tk-notice-error">
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}
