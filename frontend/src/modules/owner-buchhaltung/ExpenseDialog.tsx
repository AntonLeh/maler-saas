import { useState } from "react";
import * as api from "./api";
import { CATEGORY_LABELS, EXPENSE_LABELS } from "./logic";
import type { Expense, ExpenseTreatment } from "./logic";

type Props = {
  expense: Expense | null; // null = neu
  onClose: () => void;
  onSaved: () => void;
};

const EU = ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"];

const parse = (s: string) => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const show = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "" : String(Math.round(n * 100) / 100).replace(".", ","));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Steuerart aus dem Land vorschlagen */
const guessTreatment = (country: string, hasIva: boolean): ExpenseTreatment => {
  const c = country.toUpperCase();
  if (!c || c === "ES") return hasIva ? "es_iva" : "sin_iva";
  if (EU.includes(c)) return "eu_isp";
  return "non_eu_isp";
};

export default function ExpenseDialog({ expense, onClose, onSaved }: Props) {
  const [f, setF] = useState({
    issue_date: expense?.issue_date ?? new Date().toISOString().slice(0, 10),
    supplier: expense?.supplier ?? "",
    supplier_country: expense?.supplier_country ?? "",
    supplier_tax_id: expense?.supplier_tax_id ?? "",
    invoice_number: expense?.invoice_number ?? "",
    category: expense?.category ?? "software",
    treatment: (expense?.treatment ?? "es_iva") as ExpenseTreatment,
    currency: expense?.currency ?? "EUR",
    amount_original: show(expense?.amount_original),
    net: show(expense?.net),
    iva_rate: show(expense?.iva_rate ?? 21),
    iva: show(expense?.iva),
    total: show(expense?.total),
    iva_deductible: expense?.iva_deductible ?? true,
    irpf_deductible: expense?.irpf_deductible ?? true,
    note: expense?.note ?? "",
  });
  const [filePath, setFilePath] = useState<string | null>(expense?.file_path ?? null);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState<"" | "upload" | "scan" | "rate" | "save">("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  // Netto/IVA/Gesamt zusammenhalten
  const recalcFromNet = (netS: string, rateS = f.iva_rate, treatment = f.treatment) => {
    const net = parse(netS);
    const rate = parse(rateS);
    if (!Number.isFinite(net)) return setF((p) => ({ ...p, net: netS }));
    const iva = treatment === "es_iva" && Number.isFinite(rate) ? r2((net * rate) / 100) : 0;
    setF((p) => ({ ...p, net: netS, iva: show(iva), total: show(r2(net + iva)) }));
  };
  const recalcFromTotal = (totS: string) => {
    const tot = parse(totS);
    const rate = parse(f.iva_rate);
    if (!Number.isFinite(tot)) return setF((p) => ({ ...p, total: totS }));
    if (f.treatment === "es_iva" && Number.isFinite(rate)) {
      const net = r2(tot / (1 + rate / 100));
      setF((p) => ({ ...p, total: totS, net: show(net), iva: show(r2(tot - net)) }));
    } else if (f.treatment === "sin_iva") {
      setF((p) => ({ ...p, total: totS, net: p.net || totS }));
    } else {
      setF((p) => ({ ...p, total: totS, net: totS, iva: "0" }));
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setInfo("");
    setBusy("upload");
    try {
      const path = await api.uploadReceipt(file);
      setFilePath(path);
      setFileName(file.name);
      setBusy("scan");
      try {
        const d = await api.scanReceipt(path);
        const country = (d.supplier_country || "").toUpperCase();
        const treatment = d.treatment ?? guessTreatment(country, (d.tax_amount ?? 0) > 0);
        const currency = d.currency || "EUR";
        const gross = d.gross_amount ?? (d.net_amount != null ? d.net_amount + (d.tax_amount ?? 0) : null);
        setF((p) => ({
          ...p,
          issue_date: d.issue_date || p.issue_date,
          supplier: d.supplier || p.supplier,
          supplier_country: country || p.supplier_country,
          supplier_tax_id: d.supplier_tax_id || p.supplier_tax_id,
          invoice_number: d.invoice_number || p.invoice_number,
          category: d.category || p.category,
          treatment,
          currency,
          amount_original: currency !== "EUR" ? show(gross) : "",
          net: currency === "EUR" ? show(d.net_amount ?? gross) : "",
          iva_rate: show(d.tax_rate ?? (treatment === "es_iva" ? 21 : 21)),
          iva: currency === "EUR" ? show(treatment === "es_iva" ? d.tax_amount ?? 0 : 0) : "",
          total: currency === "EUR" ? show(gross) : "",
          note: d.note || p.note,
        }));
        setInfo(
          currency !== "EUR"
            ? `Beleg in ${currency} erkannt – bitte „In Euro umrechnen“ tippen oder den Euro-Betrag laut Kontoauszug eintragen.`
            : "Beleg ausgelesen – bitte kurz prüfen."
        );
      } catch (err) {
        setInfo(`Beleg gespeichert. ${(err as Error).message} Bitte die Angaben selbst eintragen.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const convert = async () => {
    const amt = parse(f.amount_original);
    if (!Number.isFinite(amt)) return setError("Bitte zuerst den Betrag in Originalwährung eintragen.");
    setBusy("rate");
    setError("");
    try {
      const r = await api.rateToEur(f.currency.toUpperCase(), f.issue_date);
      const eur = r2(amt * r.rate);
      setInfo(`EZB-Kurs vom ${new Date(r.date).toLocaleDateString("de-DE")}: 1 ${f.currency} = ${r.rate} €.`);
      if (f.treatment === "es_iva") recalcFromTotal(show(eur));
      else setF((p) => ({ ...p, net: show(eur), iva: "0", total: show(eur) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const net = parse(f.net);
    const iva = f.treatment === "es_iva" ? parse(f.iva || "0") : 0;
    const total = parse(f.total || String(net + iva));
    const rate = parse(f.iva_rate || "21");
    if (!f.supplier.trim()) return setError("Bitte den Lieferanten eintragen.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.issue_date)) return setError("Bitte ein gültiges Datum eintragen.");
    if (!Number.isFinite(net)) return setError("Bitte den Nettobetrag in Euro eintragen.");
    if (!Number.isFinite(iva) || !Number.isFinite(total)) return setError("Bitte IVA und Gesamtbetrag prüfen.");
    if ((f.treatment === "eu_isp" || f.treatment === "non_eu_isp") && f.supplier_country.toUpperCase() === "ES")
      return setError("Ein spanischer Lieferant ist keine Steuerumkehr – bitte „Spanien mit IVA“ oder „Ohne IVA“ wählen.");
    setBusy("save");
    try {
      await api.saveExpense(expense?.id ?? null, {
        issue_date: f.issue_date,
        supplier: f.supplier.trim(),
        supplier_country: f.supplier_country.trim().toUpperCase() || null,
        supplier_tax_id: f.supplier_tax_id.trim() || null,
        invoice_number: f.invoice_number.trim() || null,
        category: f.category,
        treatment: f.treatment,
        currency: f.currency.trim().toUpperCase() || "EUR",
        amount_original: f.amount_original ? parse(f.amount_original) : null,
        net: r2(net),
        iva_rate: Number.isFinite(rate) ? rate : 21,
        iva: r2(iva),
        total: r2(total),
        iva_deductible: f.treatment === "es_iva" ? f.iva_deductible : true,
        irpf_deductible: f.irpf_deductible,
        note: f.note.trim() || null,
        file_path: filePath,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy("");
    }
  };

  const isp = f.treatment === "eu_isp" || f.treatment === "non_eu_isp";

  return (
    <div className="ob-modal" role="dialog" aria-modal="true" onClick={() => !busy && onClose()}>
      <form className="ob-dialog" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h3>{expense ? "Ausgabe bearbeiten" : "Neue Ausgabe"}</h3>

        <label className="ob-file">
          <input type="file" accept="image/*,application/pdf" onChange={(e) => pickFile(e.target.files?.[0])} disabled={!!busy} />
          <span>
            {busy === "upload" ? "Lädt hoch …" : busy === "scan" ? "KI liest den Beleg …" : filePath ? `📎 ${fileName || "Beleg gespeichert"} – anderen wählen` : "📷 Beleg hochladen (Foto oder PDF) – die KI liest ihn aus"}
          </span>
        </label>
        {info && <p className="ob-msg ok">{info}</p>}

        <div className="ob-form">
          <div className="ob-field">
            <label>Rechnungsdatum *</label>
            <input type="date" value={f.issue_date} onChange={(e) => set("issue_date", e.target.value)} />
          </div>
          <div className="ob-field">
            <label>Lieferant *</label>
            <input value={f.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="z. B. Vercel Inc." />
          </div>
          <div className="ob-field">
            <label>Land (ISO)</label>
            <input
              value={f.supplier_country}
              maxLength={2}
              onChange={(e) => {
                const c = e.target.value.toUpperCase();
                setF((p) => ({ ...p, supplier_country: c, treatment: c.length === 2 ? guessTreatment(c, parse(p.iva) > 0) : p.treatment }));
              }}
              placeholder="ES, IE, US …"
            />
          </div>
          <div className="ob-field">
            <label>NIF / USt-IdNr. des Lieferanten</label>
            <input value={f.supplier_tax_id} onChange={(e) => set("supplier_tax_id", e.target.value)} placeholder="z. B. IE3206488LH" />
          </div>
          <div className="ob-field">
            <label>Rechnungsnummer</label>
            <input value={f.invoice_number} onChange={(e) => set("invoice_number", e.target.value)} />
          </div>
          <div className="ob-field">
            <label>Kategorie</label>
            <select value={f.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="ob-field full">
            <label>Steuerart</label>
            <div className="ob-seg">
              {(Object.keys(EXPENSE_LABELS) as ExpenseTreatment[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={f.treatment === t ? "on" : ""}
                  onClick={() => {
                    setF((p) => ({ ...p, treatment: t }));
                    recalcFromNet(f.net, f.iva_rate, t);
                  }}
                >
                  {EXPENSE_LABELS[t]}
                </button>
              ))}
            </div>
            <small>
              {isp
                ? "Steuerumkehr: Sie schulden 21 % IVA und ziehen sie im selben Quartal wieder ab – es kostet nichts, muss aber im Modelo 303 stehen."
                : f.treatment === "sin_iva"
                  ? "Z. B. Cuota de autónomos, Bankgebühren, Versicherungen oder Rechnungen mit ausländischer MwSt (nicht abziehbar)."
                  : "Spanische Rechnung mit IVA – die IVA wird als Vorsteuer abgezogen."}
            </small>
          </div>

          {(f.currency.toUpperCase() !== "EUR" || f.amount_original) && (
            <div className="ob-field full ob-fx">
              <label>Originalbetrag</label>
              <div>
                <input value={f.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} style={{ width: 70 }} />
                <input value={f.amount_original} inputMode="decimal" onChange={(e) => set("amount_original", e.target.value)} placeholder="Betrag" />
                <button type="button" className="btn btn-secondary" onClick={convert} disabled={!!busy}>
                  {busy === "rate" ? "…" : "In Euro umrechnen"}
                </button>
              </div>
            </div>
          )}

          <div className="ob-field">
            <label>
              Netto (EUR) *
              {f.currency.toUpperCase() === "EUR" && !f.amount_original && (
                <button type="button" className="ob-linkbtn" onClick={() => set("currency", "USD")}>
                  Rechnung in Fremdwährung?
                </button>
              )}
            </label>
            <input value={f.net} inputMode="decimal" onChange={(e) => recalcFromNet(e.target.value)} />
          </div>
          {f.treatment === "es_iva" ? (
            <>
              <div className="ob-field">
                <label>IVA-Satz %</label>
                <select value={f.iva_rate} onChange={(e) => recalcFromNet(f.net, e.target.value)}>
                  {["21", "10", "4", "0"].map((r) => (
                    <option key={r} value={r}>
                      {r} %
                    </option>
                  ))}
                </select>
              </div>
              <div className="ob-field">
                <label>IVA (EUR)</label>
                <input value={f.iva} inputMode="decimal" onChange={(e) => set("iva", e.target.value)} />
              </div>
            </>
          ) : isp ? (
            <div className="ob-field">
              <label>IVA Steuerumkehr</label>
              <input value={`${show(r2((parse(f.net) || 0) * 0.21))} € (21 %)`} readOnly />
            </div>
          ) : null}
          <div className="ob-field">
            <label>Gesamt (EUR)</label>
            <input value={f.total} inputMode="decimal" onChange={(e) => recalcFromTotal(e.target.value)} />
          </div>

          <div className="ob-field full ob-checks">
            {f.treatment === "es_iva" && (
              <label>
                <input type="checkbox" checked={f.iva_deductible} onChange={(e) => set("iva_deductible", e.target.checked)} /> IVA ist abziehbar
              </label>
            )}
            <label>
              <input type="checkbox" checked={f.irpf_deductible} onChange={(e) => set("irpf_deductible", e.target.checked)} /> Betriebsausgabe für die IRPF
            </label>
          </div>
          <div className="ob-field full">
            <label>Notiz</label>
            <input value={f.note} onChange={(e) => set("note", e.target.value)} />
          </div>
        </div>

        {error && <p className="ob-msg err">{error}</p>}
        <div className="ob-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={!!busy}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={!!busy}>
            {busy === "save" ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
