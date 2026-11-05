import { useRef, useState } from "react";
import { Modal } from "../terminkalender/ui";
import * as api from "./api";
import type { Country, Expense, ExpenseCategory, ExpenseInput, OrderOption, PaymentMethod } from "./types";
import { CATEGORY_LABELS, COUNTRY_NAMES, PAYMENT_LABELS, TAX_RATES, isForeignRate, splitAmount } from "./types";

const money = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseAmount = (s: string) => Number(String(s).replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
const today = () => new Date().toLocaleDateString("sv-SE");

/** Beleg erfassen oder bearbeiten (Modal) */
export default function BelegForm({
  tenantId,
  country,
  aiAllowed,
  orders,
  expense,
  onClose,
  onSaved,
}: {
  tenantId: number;
  country: Country;
  aiAllowed: boolean;
  orders: OrderOption[];
  expense: Expense | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const rates = TAX_RATES[country];
  const editing = !!expense;
  const [file, setFile] = useState<{ path: string; name: string; type: string } | null>(
    expense?.file_path ? { path: expense.file_path, name: expense.file_name ?? "Beleg", type: expense.file_type ?? "" } : null
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [aiUsed, setAiUsed] = useState(expense?.ai_extracted ?? false);
  const [aiNote, setAiNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(expense?.receipt_date ?? today());
  const [supplier, setSupplier] = useState(expense?.supplier ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "material");
  const [gross, setGross] = useState(expense ? money(Number(expense.gross_amount)) : "");
  // vom Beleg erkannter Satz, der nicht zum Firmenland gehört (z. B. 21 % spanische IVA)
  const [extraRate, setExtraRate] = useState<number | null>(
    expense && expense.tax_rate !== null && !rates.some((r) => Math.abs(r - Number(expense.tax_rate)) < 0.01) ? Number(expense.tax_rate) : null
  );
  const [rate, setRate] = useState<string>(expense ? (expense.tax_rate === null ? "mixed" : String(Number(expense.tax_rate))) : String(rates[0]));
  const [mixedTax, setMixedTax] = useState(expense && expense.tax_rate === null ? money(Number(expense.tax_amount)) : "");
  const [paid, setPaid] = useState(expense?.paid ?? true);
  const [payment, setPayment] = useState<PaymentMethod | "">(expense?.payment_method ?? "");
  const [orderId, setOrderId] = useState(expense?.order_id ? String(expense.order_id) : "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rateValue = rate === "mixed" ? null : Number(rate);
  const foreignRate = rateValue !== null && isForeignRate(rateValue, country);
  const grossValue = parseAmount(gross);
  const { net, tax } = splitAmount(Number.isFinite(grossValue) ? grossValue : 0, rateValue, parseAmount(mixedTax) || 0);

  const applyAi = (d: Partial<ExpenseInput>) => {
    const filled: string[] = [];
    if (d.receipt_date) {
      setDate(d.receipt_date);
      filled.push("Datum");
    }
    if (d.supplier) {
      setSupplier(d.supplier);
      filled.push("Lieferant");
    }
    if (d.description) setDescription(d.description);
    if (d.category) setCategory(d.category);
    if (typeof d.gross_amount === "number") {
      setGross(money(d.gross_amount));
      filled.push("Betrag");
    }
    if (typeof d.tax_rate === "number") {
      const known = rates.find((r) => Math.abs(r - Number(d.tax_rate)) < 0.01);
      if (known !== undefined) setRate(String(known));
      else {
        setExtraRate(Number(d.tax_rate));
        setRate(String(Number(d.tax_rate)));
      }
      filled.push("Steuersatz");
    } else if (typeof d.tax_amount === "number") {
      setRate("mixed");
      setMixedTax(money(d.tax_amount));
      filled.push("Steuer");
    }
    if (d.payment_method) setPayment(d.payment_method);
    setAiUsed(true);
    setAiNote(filled.length ? `Von der KI ausgefüllt: ${filled.join(", ")}. Bitte kurz prüfen.` : "Die KI konnte nur wenig lesen – bitte die Angaben ergänzen.");
  };

  const runAi = async (path: string) => {
    setReading(true);
    setAiNote("");
    try {
      applyAi(await api.recognize(path));
    } catch (e) {
      setAiNote((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    setUploading(true);
    try {
      const up = await api.uploadReceipt(tenantId, f);
      setFile(up);
      setPreview(up.type.startsWith("image/") ? URL.createObjectURL(f) : null);
      if (aiAllowed) await runAi(up.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const openFile = async () => {
    if (!file) return;
    try {
      window.open(await api.receiptUrl(file.path), "_blank", "noopener");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const save = async () => {
    setError("");
    if (!date) return setError("Bitte das Belegdatum angeben.");
    if (date > today()) return setError("Das Belegdatum liegt in der Zukunft.");
    if (!supplier.trim()) return setError("Bitte den Lieferanten angeben.");
    if (gross.trim() === "" || !Number.isFinite(grossValue) || grossValue < 0) return setError("Bitte einen gültigen Betrag (brutto) angeben.");
    if (rateValue === null && (parseAmount(mixedTax) < 0 || parseAmount(mixedTax) > grossValue)) return setError("Der Steuerbetrag ist ungültig.");
    const values: ExpenseInput = {
      receipt_date: date,
      supplier: supplier.trim().slice(0, 120),
      description: description.trim().slice(0, 300) || null,
      category,
      gross_amount: Math.round(grossValue * 100) / 100,
      tax_rate: rateValue,
      tax_amount: rateValue === null ? Math.round((parseAmount(mixedTax) || 0) * 100) / 100 : 0,
      paid,
      payment_method: payment || null,
      order_id: orderId ? Number(orderId) : null,
      notes: notes.trim().slice(0, 1000) || null,
    };
    setSaving(true);
    try {
      if (editing && expense) await api.updateExpense(expense.id, values);
      else await api.createExpense(tenantId, { ...values, file_path: file?.path ?? null, file_name: file?.name ?? null, file_type: file?.type ?? null, ai_extracted: aiUsed });
      onSaved(editing ? "Beleg geändert." : "Beleg gespeichert.");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? "Beleg bearbeiten" : "Beleg erfassen"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || uploading || reading}>
            {saving ? "Speichert …" : "Speichern"}
          </button>
        </>
      }
    >
      <div className="bl-form">
        {error && <div className="tk-notice tk-notice-error">{error}</div>}

        {/* ---------- Datei ---------- */}
        <div className="bl-file">
          {file ? (
            <div className="bl-file-done">
              {preview ? <img src={preview} alt="Beleg" /> : <span className="bl-file-icon" aria-hidden="true">📄</span>}
              <div>
                <strong>{file.name}</strong>
                <button type="button" className="bl-link" onClick={openFile}>
                  Beleg ansehen
                </button>
                {!editing && aiAllowed && !reading && (
                  <button type="button" className="bl-link" onClick={() => runAi(file.path)}>
                    Erneut automatisch lesen
                  </button>
                )}
              </div>
            </div>
          ) : editing ? (
            <p className="tk-muted">Zu diesem Beleg wurde keine Datei hinterlegt.</p>
          ) : (
            <>
              <div className="bl-file-buttons">
                <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()} disabled={uploading}>
                  📷 Foto aufnehmen
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  Datei wählen (Foto/PDF)
                </button>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
              <p className="tk-muted bl-small">
                {aiAllowed
                  ? "Die KI liest Lieferant, Datum, Betrag und Steuersatz automatisch aus – Sie prüfen nur noch."
                  : "Tipp: Ab dem Tarif Business liest die KI die Angaben automatisch vom Beleg."}
              </p>
            </>
          )}
          {uploading && <p className="tk-muted">Wird hochgeladen …</p>}
          {reading && <p className="bl-ai-reading">KI liest den Beleg …</p>}
          {aiNote && !reading && <p className="bl-ai-note">{aiNote}</p>}
        </div>

        {/* ---------- Angaben ---------- */}
        <div className="tk-field-pair">
          <label className="tk-field">
            <span>Belegdatum *</span>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="tk-field">
            <span>Kategorie</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="tk-field">
          <span>Lieferant *</span>
          <input value={supplier} maxLength={120} onChange={(e) => setSupplier(e.target.value)} placeholder="z. B. Farben Meyer" />
        </label>
        <label className="tk-field">
          <span>Was wurde gekauft?</span>
          <input value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="z. B. Dispersionsfarbe, Abdeckfolie" />
        </label>
        <div className="tk-field-pair">
          <label className="tk-field">
            <span>Betrag brutto *</span>
            <input inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0,00" />
          </label>
          <label className="tk-field">
            <span>Steuersatz</span>
            <select value={rate} onChange={(e) => setRate(e.target.value)}>
              {rates.map((r) => (
                <option key={r} value={String(r)}>
                  {r.toLocaleString("de-DE")} %
                </option>
              ))}
              {extraRate !== null && (
                <option value={String(extraRate)}>{extraRate.toLocaleString("de-DE")} % (laut Beleg)</option>
              )}
              <option value="mixed">gemischt / Betrag eingeben</option>
            </select>
          </label>
        </div>
        {rate === "mixed" && (
          <label className="tk-field">
            <span>Steuerbetrag gesamt (laut Beleg)</span>
            <input inputMode="decimal" value={mixedTax} onChange={(e) => setMixedTax(e.target.value)} placeholder="0,00" />
          </label>
        )}
        <p className="bl-split">
          Netto <strong>{money(net)}</strong> · {foreignRate ? "Steuer" : "Vorsteuer"} <strong>{money(tax)}</strong>
        </p>
        {foreignRate && (
          <p className="bl-hint">
            {rateValue?.toLocaleString("de-DE")} % ist kein Steuersatz von {COUNTRY_NAMES[country]} – vermutlich ausländische Umsatzsteuer. Diese ist meist
            nicht als Vorsteuer abziehbar und zählt deshalb in der Übersicht nicht zur Vorsteuer. Bitte im Zweifel mit dem Steuerberater klären.
          </p>
        )}
        {gross.trim() !== "" && grossValue === 0 && (
          <p className="bl-hint">Beleg über 0,00 € – wird nur zur Aufbewahrung abgelegt und zählt in den Summen nicht mit.</p>
        )}
        <div className="tk-field-pair">
          <label className="tk-field">
            <span>Zahlungsart</span>
            <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod | "")}>
              <option value="">– nicht angegeben –</option>
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field bl-check">
            <span>Bezahlt?</span>
            <span className="bl-check-row">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> bereits bezahlt
            </span>
          </label>
        </div>
        <label className="tk-field">
          <span>Auftrag (optional)</span>
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">– keinem Auftrag zugeordnet –</option>
            {orders.map((o) => (
              <option key={o.id} value={String(o.id)}>
                #{o.id} · {o.title}
              </option>
            ))}
          </select>
        </label>
        <label className="tk-field">
          <span>Notiz</span>
          <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
