import { useEffect, useState } from "react";
import * as api from "./api";
import { countryCode } from "./types";
import { periodRange } from "./vat";
import type { TaxMethod } from "./vat";
import { ACCOUNT_LABELS, DEFAULT_ACCOUNTS, defaultSettings, sameFiscalYear } from "./datev";
import type { DatevAccounts, DatevSettings, Skr } from "./datev";
import { buildPackage, datevFile, downloadBlob, loadAllInvoices, loadCustomers, loadExpensesRange, safeName } from "./paket";

type Kind = "month" | "quarter" | "year";
const now = new Date();
const prevMonth = () => {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const defaultValue = (k: Kind) =>
  k === "year" ? String(now.getFullYear() - (now.getMonth() < 3 ? 1 : 0)) : k === "quarter" ? `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}` : prevMonth();
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const normalize = (raw: Record<string, unknown> | null): DatevSettings => {
  const d = defaultSettings();
  if (!raw) return d;
  const skr: Skr = raw.skr === "SKR04" ? "SKR04" : "SKR03";
  return {
    berater: String(raw.berater ?? ""),
    mandant: String(raw.mandant ?? ""),
    skr,
    wjStartMonth: Math.min(12, Math.max(1, Number(raw.wjStartMonth) || 1)),
    accounts: { ...DEFAULT_ACCOUNTS[skr], ...((raw.accounts as Partial<DatevAccounts>) ?? {}) },
  };
};

/** Buchhaltung → Steuerberater: ZIP-Paket für jeden Berater + DATEV-Datei (Deutschland) */
export default function SteuerberaterPage({ tenantId, country, currencySymbol }: { tenantId: number; country?: string | null; currencySymbol?: string | null }) {
  const cc = countryCode(country);
  const [kind, setKind] = useState<Kind>("month");
  const [value, setValue] = useState(defaultValue("month"));
  const [method, setMethod] = useState<TaxMethod>("soll");
  const [settings, setSettings] = useState<DatevSettings>(defaultSettings());
  const [saved, setSaved] = useState<DatevSettings>(defaultSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const period = periodRange(kind, value);
  const datevReady = cc === "DE" && /^\d{4,7}$/.test(saved.berater) && Number(saved.berater) >= 1001 && /^\d{1,5}$/.test(saved.mandant);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.loadTaxMethod(tenantId), api.loadDatevSettings(tenantId)]).then(([m, raw]) => {
      if (cancelled) return;
      setMethod(m);
      const s = normalize(raw);
      setSettings(s);
      setSaved(s);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const fiscalProblem = datevReady && !sameFiscalYear(period.from, period.to, saved.wjStartMonth);

  const pack = async () => {
    setError("");
    setSuccess("");
    setBusy("Wird vorbereitet …");
    try {
      const { blob, warnings } = await buildPackage({
        tenantId,
        from: period.from,
        to: period.to,
        label: period.label,
        country: cc,
        method,
        datev: datevReady && !fiscalProblem ? saved : null,
        currencySymbol: currencySymbol || "€",
        onProgress: setBusy,
      });
      downloadBlob(blob, `Steuerberater-Paket_${safeName(period.label)}.zip`);
      setSuccess(`Paket für ${period.label} wurde heruntergeladen.${warnings.length ? ` Hinweise: ${warnings.join(" ")}` : ""}`);
    } catch (e) {
      setError((e as Error).message || "Das Paket konnte nicht erstellt werden.");
    } finally {
      setBusy("");
    }
  };

  const datevOnly = async () => {
    setError("");
    setSuccess("");
    setBusy("DATEV-Datei wird erstellt …");
    try {
      const [invoices, names, expenses] = await Promise.all([loadAllInvoices(tenantId), loadCustomers(tenantId), loadExpensesRange(tenantId, period.from, period.to)]);
      const bytes = datevFile(invoices, names, expenses, period.from, period.to, saved);
      downloadBlob(new Blob([bytes as BlobPart], { type: "text/csv;charset=windows-1252" }), `EXTF_Buchungsstapel_${period.from}_${period.to}.csv`);
      setSuccess("DATEV-Datei wurde heruntergeladen.");
    } catch (e) {
      setError((e as Error).message || "Die DATEV-Datei konnte nicht erstellt werden.");
    } finally {
      setBusy("");
    }
  };

  const saveSettings = async () => {
    setError("");
    if (settings.berater && (!/^\d{4,7}$/.test(settings.berater) || Number(settings.berater) < 1001)) return setError("Die Beraternummer hat 4 bis 7 Ziffern (ab 1001).");
    if (settings.mandant && !/^\d{1,5}$/.test(settings.mandant)) return setError("Die Mandantennummer hat 1 bis 5 Ziffern.");
    const bad = (Object.keys(settings.accounts) as (keyof DatevAccounts)[]).find((k) => !/^\d{4,9}$/.test(settings.accounts[k]));
    if (bad) return setError(`Bitte eine gültige Kontonummer für „${ACCOUNT_LABELS[bad]}“ eintragen (4–9 Ziffern).`);
    try {
      await api.saveDatevSettings(tenantId, settings);
      setSaved(settings);
      setSuccess("DATEV-Einstellungen gespeichert.");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="stb">
      {error && <div className="tk-notice tk-notice-error">{error}</div>}
      {success && <div className="tk-notice tk-notice-success">{success}</div>}

      <section className="ust-box">
        <h3>Steuerberater-Paket</h3>
        <p className="tk-muted bl-small">
          Eine ZIP-Datei mit allem, was Ihr Steuerberater bzw. Treuhänder für den Zeitraum braucht: Rechnungsausgangsbuch und Belegliste (für Excel), alle
          Rechnungs-PDFs und Belegdateien, die Umsatzsteuer-Übersicht{cc === "DE" ? " und – wenn eingerichtet – die DATEV-Datei" : ""}. Funktioniert mit jedem
          Buchhaltungsprogramm.
        </p>
        <div className="bl-toolbar">
          <label className="tk-field">
            <span>Zeitraum</span>
            <select
              value={kind}
              onChange={(e) => {
                const k = e.target.value as Kind;
                setKind(k);
                setValue(defaultValue(k));
              }}
            >
              <option value="month">Monat</option>
              <option value="quarter">Quartal</option>
              <option value="year">Jahr</option>
            </select>
          </label>
          <label className="tk-field">
            <span>{kind === "month" ? "Monat" : kind === "quarter" ? "Quartal" : "Jahr"}</span>
            {kind === "month" ? (
              <input type="month" value={value} onChange={(e) => e.target.value && setValue(e.target.value)} />
            ) : (
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                {kind === "quarter"
                  ? years.flatMap((y) => [4, 3, 2, 1].map((q) => `${y}-Q${q}`)).map((v) => (
                      <option key={v} value={v}>
                        {periodRange("quarter", v).label}
                      </option>
                    ))
                  : years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
              </select>
            )}
          </label>
        </div>
        <div className="stb-actions">
          <button type="button" className="btn btn-primary" disabled={!!busy} onClick={pack}>
            {busy ? busy : `Paket ${period.label} herunterladen (ZIP)`}
          </button>
          {datevReady && (
            <button type="button" className="btn btn-secondary" disabled={!!busy || fiscalProblem} onClick={datevOnly}>
              Nur DATEV-Datei
            </button>
          )}
        </div>
        {fiscalProblem && <p className="bl-hint">Der Zeitraum geht über zwei Wirtschaftsjahre – die DATEV-Datei wird dafür nicht erstellt (bitte kürzeren Zeitraum wählen).</p>}
        {cc === "DE" && !datevReady && (
          <p className="tk-muted bl-small">
            Tipp: Tragen Sie unten Berater- und Mandantennummer ein, dann enthält das Paket zusätzlich eine DATEV-Datei, die Ihr Steuerberater direkt einlesen
            kann.
          </p>
        )}
        {cc !== "DE" && (
          <p className="tk-muted bl-small">
            {cc === "AT"
              ? "In Österreich nutzen Steuerberater BMD, RZL oder DATEV Österreich mit eigenen Kontenplänen – die CSV-Dateien im Paket lassen sich dort importieren."
              : "Schweizer Treuhänder (Abacus, Bexio, Sage …) übernehmen die CSV-Dateien und Belege aus dem Paket."}
          </p>
        )}
      </section>

      {cc === "DE" && (
        <section className="ust-box op-box">
          <div className="stb-head">
            <h3>DATEV-Export einrichten</h3>
            <button type="button" className="bl-link" onClick={() => setShowSettings((s) => !s)}>
              {showSettings ? "ausblenden" : datevReady ? "Einstellungen ändern" : "einrichten"}
            </button>
          </div>
          {datevReady && !showSettings && (
            <p className="tk-muted bl-small">
              Berater {saved.berater} · Mandant {saved.mandant} · {saved.skr} · Wirtschaftsjahr ab {MONTHS[saved.wjStartMonth - 1]}
            </p>
          )}
          {showSettings && (
            <div className="stb-form">
              <p className="bl-hint">
                Diese Angaben bekommen Sie von Ihrem Steuerberater. Die Kontenzuordnung ist mit üblichen Standardkonten vorbelegt – bitte einmal mit dem
                Steuerberater abstimmen.
              </p>
              <div className="tk-field-pair">
                <label className="tk-field">
                  <span>Beraternummer</span>
                  <input inputMode="numeric" value={settings.berater} onChange={(e) => setSettings({ ...settings, berater: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
                </label>
                <label className="tk-field">
                  <span>Mandantennummer</span>
                  <input inputMode="numeric" value={settings.mandant} onChange={(e) => setSettings({ ...settings, mandant: e.target.value.replace(/\D/g, "").slice(0, 5) })} />
                </label>
              </div>
              <div className="tk-field-pair">
                <label className="tk-field">
                  <span>Kontenrahmen</span>
                  <select
                    value={settings.skr}
                    onChange={(e) => {
                      const skr = e.target.value as Skr;
                      if (window.confirm(`Kontenzuordnung auf die Standardkonten von ${skr} zurücksetzen?`)) setSettings({ ...settings, skr, accounts: { ...DEFAULT_ACCOUNTS[skr] } });
                      else setSettings({ ...settings, skr });
                    }}
                  >
                    <option value="SKR03">SKR03</option>
                    <option value="SKR04">SKR04</option>
                  </select>
                </label>
                <label className="tk-field">
                  <span>Wirtschaftsjahr beginnt im</span>
                  <select value={settings.wjStartMonth} onChange={(e) => setSettings({ ...settings, wjStartMonth: Number(e.target.value) })}>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <table className="ust-table stb-accounts">
                <thead>
                  <tr>
                    <th>Buchung</th>
                    <th>Konto</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(ACCOUNT_LABELS) as (keyof DatevAccounts)[]).map((k) => (
                    <tr key={k}>
                      <td>{ACCOUNT_LABELS[k]}</td>
                      <td>
                        <input
                          inputMode="numeric"
                          value={settings.accounts[k]}
                          onChange={(e) => setSettings({ ...settings, accounts: { ...settings.accounts, [k]: e.target.value.replace(/\D/g, "").slice(0, 9) } })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tk-muted bl-small">
                Vorsteuer wird über die Steuerschlüssel 9 (19 %) bzw. 8 (7 %) gebucht, Erlöse über Automatikkonten. Barzahlungen gehen auf die Kasse, alle
                anderen Belege auf den Sammelkreditor.
              </p>
              <div className="ws-row ws-bk-save">
                <button type="button" className="btn btn-secondary" onClick={() => setSettings({ ...settings, accounts: { ...DEFAULT_ACCOUNTS[settings.skr] } })}>
                  Standardkonten
                </button>
                <button type="button" className="btn btn-primary" disabled={!dirty} onClick={saveSettings}>
                  Speichern
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
