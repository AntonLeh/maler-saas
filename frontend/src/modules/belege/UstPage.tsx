import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import { countryCode } from "./types";
import type { TaxMethod, VatExpense, VatInvoice } from "./vat";
import { computeVat, periodRange } from "./vat";

type Kind = "month" | "quarter" | "half" | "year";

const now = new Date();
const defaultValue = (k: Kind) =>
  k === "year"
    ? String(now.getFullYear())
    : k === "half"
    ? `${now.getFullYear()}-H${now.getMonth() < 6 ? 1 : 2}`
    : k === "quarter" ? `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}` : now.toLocaleDateString("sv-SE").slice(0, 7);

/** Buchhaltung → Umsatzsteuer: Umsatzsteuer minus Vorsteuer je Zeitraum, mit den amtlichen Kennzahlen (DE ELSTER, AT U30, CH MWST-Abrechnung) */
export default function UstPage({ tenantId, country, currencySymbol }: { tenantId: number; country?: string | null; currencySymbol?: string | null }) {
  const cc = countryCode(country);
  const startKind: Kind = cc === "CH" ? "quarter" : "month";
  const [kind, setKind] = useState<Kind>(startKind);
  const [value, setValue] = useState(defaultValue(startKind));
  const [report, setReport] = useState<api.VatReportSettings>({ chMethod: "effective", saldoRate: 5.3, smallBusiness: false });
  const [rateInput, setRateInput] = useState("5,3");
  const [method, setMethod] = useState<TaxMethod>("soll");
  const [invoices, setInvoices] = useState<VatInvoice[] | null>(null);
  const [expenses, setExpenses] = useState<VatExpense[] | null>(null);
  const [error, setError] = useState("");
  const [show, setShow] = useState<"" | "invoices" | "expenses">("");
  const period = periodRange(kind, value);

  const fmt = (n: number) =>
    currencySymbol && currencySymbol !== "€"
      ? `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`
      : n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.loadVatInvoices(tenantId), api.loadTaxMethod(tenantId), api.loadVatReportSettings(tenantId)])
      .then(([inv, m, rep]) => {
        if (cancelled) return;
        setInvoices(inv);
        setMethod(m);
        setReport(rep);
        setRateInput(rep.saldoRate.toLocaleString("de-DE"));
        if (cc === "CH" && rep.chMethod === "saldo") {
          setKind("half");
          setValue(defaultValue("half"));
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;
    api
      .loadVatExpenses(tenantId, period.from, period.to)
      .then((ex) => !cancelled && setExpenses(ex))
      .catch((e) => {
        if (cancelled) return;
        setExpenses([]);
        setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, period.from, period.to]);

  const result = useMemo(
    () => (invoices && expenses ? computeVat(invoices, expenses, period.from, period.to, method, cc, report) : null),
    [invoices, expenses, period.from, period.to, method, cc, report]
  );

  const changeMethod = async (m: TaxMethod) => {
    setMethod(m);
    setError("");
    try {
      await api.saveTaxMethod(tenantId, m);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const changeReport = async (next: { chMethod: "effective" | "saldo"; saldoRate: number }) => {
    setReport((r) => ({ ...r, ...next }));
    setError("");
    try {
      await api.saveVatReportSettings(tenantId, next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const invById = new Map((invoices ?? []).map((i) => [i.id, i]));

  return (
    <div className="ust">
      {error && <div className="tk-notice tk-notice-error">{error}</div>}

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
            {cc === "CH" && <option value="half">Halbjahr</option>}
            <option value="year">Jahr</option>
          </select>
        </label>
        <label className="tk-field">
          <span>{kind === "month" ? "Monat" : kind === "quarter" ? "Quartal" : kind === "half" ? "Halbjahr" : "Jahr"}</span>
          {kind === "month" ? (
            <input type="month" value={value} onChange={(e) => e.target.value && setValue(e.target.value)} />
          ) : (
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              {kind === "quarter" || kind === "half"
                ? years
                    .flatMap((y) => (kind === "half" ? [2, 1].map((h) => `${y}-H${h}`) : [4, 3, 2, 1].map((q) => `${y}-Q${q}`)))
                    .map((v) => (
                      <option key={v} value={v}>
                        {periodRange(kind, v).label}
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
        <label className="tk-field">
          <span>Versteuerung</span>
          <select value={method} onChange={(e) => changeMethod(e.target.value as TaxMethod)}>
            <option value="soll">{cc === "CH" ? "Vereinbart (nach Rechnungsdatum)" : "Soll (nach Rechnungsdatum)"}</option>
            <option value="ist">{cc === "CH" ? "Vereinnahmt (nach Zahlungseingang)" : "Ist (nach Zahlungseingang)"}</option>
          </select>
        </label>
        {cc === "CH" && !report.smallBusiness && (
          <label className="tk-field">
            <span>Abrechnungsmethode</span>
            <select
              value={report.chMethod}
              onChange={(e) => {
                const m = e.target.value as "effective" | "saldo";
                changeReport({ chMethod: m, saldoRate: report.saldoRate });
                const k: Kind = m === "saldo" ? "half" : "quarter";
                setKind(k);
                setValue(defaultValue(k));
              }}
            >
              <option value="effective">Effektive Methode (vierteljährlich)</option>
              <option value="saldo">Saldosteuersatz (halbjährlich)</option>
            </select>
          </label>
        )}
        {cc === "CH" && !report.smallBusiness && report.chMethod === "saldo" && (
          <label className="tk-field">
            <span>Bewilligter Saldosteuersatz (%)</span>
            <input
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              onBlur={() => {
                const v = Number(rateInput.replace(",", "."));
                if (Number.isFinite(v) && v > 0 && v < 10) changeReport({ chMethod: "saldo", saldoRate: v });
                else setRateInput(report.saldoRate.toLocaleString("de-DE"));
              }}
              style={{ maxWidth: 90 }}
            />
          </label>
        )}
      </div>

      {!result ? (
        <p className="tk-muted">Wird berechnet …</p>
      ) : (
        <>
          <div className={`ust-result ${result.balance > 0 ? "pay" : result.balance < 0 ? "refund" : ""}`}>
            <span>{period.label}</span>
            <strong>
              {result.balance > 0
                ? cc === "CH"
                  ? "An die ESTV: "
                  : "An das Finanzamt: "
                : result.balance < 0
                ? cc === "CH"
                  ? "Guthaben bei der ESTV: "
                  : "Erstattung vom Finanzamt: "
                : "Keine Zahllast: "}
              {fmt(Math.abs(result.balance))}
            </strong>
            <small>
              {result.saldo
                ? `Umsatz inkl. MWST ${fmt(result.saldo.grossSales)} × Saldosteuersatz ${result.saldo.rate.toLocaleString("de-DE")} %`
                : `${cc === "CH" ? "MWST" : "Umsatzsteuer"} ${fmt(result.salesTax)} − Vorsteuer ${fmt(result.inputTax)}`}
            </small>
          </div>

          <div className="ust-grid">
            <section className="ust-box">
              <h3>{cc === "CH" ? "MWST aus Rechnungen" : "Umsatzsteuer aus Rechnungen"}</h3>
              <table className="ust-table">
                <thead>
                  <tr>
                    <th>Steuersatz</th>
                    <th>Netto</th>
                    <th>Steuer</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sales.length === 0 && result.reverseChargeNet === 0 && (
                    <tr>
                      <td colSpan={3} className="tk-muted">
                        Keine Rechnungen in diesem Zeitraum.
                      </td>
                    </tr>
                  )}
                  {result.sales.map((l) => (
                    <tr key={l.key}>
                      <td>
                        {l.label} <span className="tk-muted">({l.count})</span>
                      </td>
                      <td>{fmt(l.net)}</td>
                      <td>{fmt(l.tax)}</td>
                    </tr>
                  ))}
                  {result.reverseChargeNet !== 0 && (
                    <tr>
                      <td>{cc === "AT" ? "§ 19 Abs. 1a (Steuer schuldet Kunde)" : "§ 13b (Steuer schuldet Kunde)"}</td>
                      <td>{fmt(result.reverseChargeNet)}</td>
                      <td>–</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Summe</td>
                    <td>{fmt(result.salesNet + result.reverseChargeNet)}</td>
                    <td>{fmt(result.salesTax)}</td>
                  </tr>
                </tfoot>
              </table>
              <button type="button" className="bl-link" onClick={() => setShow(show === "invoices" ? "" : "invoices")}>
                {show === "invoices" ? "Rechnungen ausblenden" : `Rechnungen anzeigen (${result.invoiceIds.length})`}
              </button>
              {show === "invoices" && (
                <ul className="ust-detail">
                  {result.invoiceIds.map((id) => {
                    const i = invById.get(id)!;
                    const storno = i.document_type === "cancellation";
                    return (
                      <li key={id}>
                        <span>
                          {i.invoice_number}
                          {storno ? " (Storno)" : i.invoice_type === "partial" ? " (Abschlag)" : ""}
                        </span>
                        <span className="tk-muted">
                          {new Date(`${String(method === "ist" && !storno && i.paid_at ? i.paid_at : i.invoice_date).slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE")}
                        </span>
                        <span>{fmt((storno ? -1 : 1) * Math.abs(Number(i.subtotal)))} netto</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="ust-box">
              <h3>Vorsteuer aus Belegen{result.saldo ? " (beim Saldosteuersatz nicht abziehbar)" : ""}</h3>
              <table className="ust-table">
                <thead>
                  <tr>
                    <th>Steuersatz</th>
                    <th>Netto</th>
                    <th>Vorsteuer</th>
                  </tr>
                </thead>
                <tbody>
                  {result.inputs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="tk-muted">
                        Keine Belege in diesem Zeitraum.
                      </td>
                    </tr>
                  )}
                  {result.inputs.map((l) => (
                    <tr key={l.key}>
                      <td>
                        {l.label} <span className="tk-muted">({l.count})</span>
                      </td>
                      <td>{fmt(l.net)}</td>
                      <td>{fmt(l.tax)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Summe</td>
                    <td>{fmt(result.inputNet)}</td>
                    <td>{fmt(result.inputTax)}</td>
                  </tr>
                </tfoot>
              </table>
              {result.foreignTax > 0 && (
                <p className="tk-muted bl-small">Nicht abgezogen: {fmt(result.foreignTax)} ausländische Umsatzsteuer (z. B. aus Rechnungen ausländischer Anbieter).</p>
              )}
              <button type="button" className="bl-link" onClick={() => setShow(show === "expenses" ? "" : "expenses")}>
                {show === "expenses" ? "Belege ausblenden" : `Belege anzeigen (${result.expenseIds.length})`}
              </button>
              {show === "expenses" && (
                <ul className="ust-detail">
                  {(expenses ?? [])
                    .filter((e) => result.expenseIds.includes(e.id))
                    .map((e) => (
                      <li key={e.id}>
                        <span>{e.supplier}</span>
                        <span className="tk-muted">{new Date(`${e.receipt_date}T12:00:00`).toLocaleDateString("de-DE")}</span>
                        <span>
                          {fmt(Number(e.tax_amount))} {e.tax_rate === null ? "(gemischt)" : `(${Number(e.tax_rate).toLocaleString("de-DE")} %)`}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>

          {result.form && (
            <section className="ust-box ust-elster">
              <h3>{result.form.title}</h3>
              {result.form.rows.length > 0 && (
                <table className="ust-table">
                  <tbody>
                    {result.form.rows.map((e, idx) => (
                      <tr key={idx} style={e.strong ? { fontWeight: 700 } : undefined}>
                        <td className="ust-kz">{e.kz ? `${result.form!.codeLabel} ${e.kz}` : ""}</td>
                        <td>{e.label}</td>
                        <td>{e.wholeEuro ? `${Math.trunc(e.value).toLocaleString("de-DE")} €` : fmt(e.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="tk-muted bl-small">{result.form.note}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
