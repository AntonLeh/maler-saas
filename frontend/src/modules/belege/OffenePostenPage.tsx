import { useCallback, useEffect, useState } from "react";
import * as api from "./api";
import type { OpenInvoice } from "./api";
import type { Expense } from "./types";

const DAY = 86_400_000;
const todayIso = () => new Date().toLocaleDateString("sv-SE");
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE") : "–");
/** Tage überfällig (0 = noch nicht fällig bzw. heute fällig) */
const overdueDays = (due: string | null, today = todayIso()) =>
  due ? Math.max(0, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${due.slice(0, 10)}T12:00:00`)) / DAY)) : 0;

type Bucket = "notdue" | "d30" | "d60" | "older";
const bucketOf = (days: number): Bucket => (days === 0 ? "notdue" : days <= 30 ? "d30" : days <= 60 ? "d60" : "older");
const BUCKET_LABELS: Record<Bucket, string> = { notdue: "Noch nicht fällig", d30: "1–30 Tage überfällig", d60: "31–60 Tage überfällig", older: "über 60 Tage überfällig" };

/** Buchhaltung → Offene Posten: unbezahlte Kundenrechnungen und eigene offene Belege */
export default function OffenePostenPage({ tenantId, currencySymbol, onOpenInvoices }: { tenantId: number; currencySymbol?: string | null; onOpenInvoices?: () => void }) {
  const [invoices, setInvoices] = useState<OpenInvoice[] | null>(null);
  const [levels, setLevels] = useState<Map<number, number>>(new Map());
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const fmt = (n: number) =>
    currencySymbol && currencySymbol !== "€"
      ? `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`
      : n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  const fetchAll = useCallback(
    () => Promise.all([api.loadOpenInvoices(tenantId), api.loadReminderLevels(), api.loadCustomerNames(tenantId), api.loadUnpaidExpenses(tenantId)]),
    [tenantId]
  );

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(([inv, lv, nm, ex]) => {
        if (cancelled) return;
        setInvoices(inv);
        setLevels(lv);
        setNames(nm);
        setExpenses(ex);
      })
      .catch((e) => {
        if (cancelled) return;
        setInvoices([]);
        setExpenses([]);
        setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const reload = async () => {
    const [inv, lv, nm, ex] = await fetchAll();
    setInvoices(inv);
    setLevels(lv);
    setNames(nm);
    setExpenses(ex);
  };

  const payInvoice = async (i: OpenInvoice) => {
    if (!window.confirm(`Rechnung ${i.invoice_number} über ${fmt(Number(i.total_amount))} als bezahlt markieren?`)) return;
    setBusy(`i${i.id}`);
    setError("");
    try {
      await api.markInvoicePaid(i.id);
      setSuccess(`Rechnung ${i.invoice_number} ist als bezahlt markiert.`);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const payExpense = async (e: Expense) => {
    setBusy(`e${e.id}`);
    setError("");
    try {
      await api.updateExpense(e.id, { paid: true });
      setSuccess(`Beleg „${e.supplier}“ ist als bezahlt markiert.`);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!invoices || !expenses) return <p className="tk-muted">Wird geladen …</p>;

  const today = todayIso();
  const receivable = invoices.reduce((a, i) => a + Number(i.total_amount || 0), 0);
  const overdue = invoices.filter((i) => overdueDays(i.due_date, today) > 0);
  const overdueSum = overdue.reduce((a, i) => a + Number(i.total_amount || 0), 0);
  const payable = expenses.reduce((a, e) => a + Number(e.gross_amount || 0), 0);
  const buckets = (Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => {
    const list = invoices.filter((i) => bucketOf(overdueDays(i.due_date, today)) === b);
    return { b, count: list.length, sum: list.reduce((a, i) => a + Number(i.total_amount || 0), 0) };
  });

  return (
    <div className="op">
      {error && <div className="tk-notice tk-notice-error">{error}</div>}
      {success && <div className="tk-notice tk-notice-success">{success}</div>}

      <div className="bl-summary op-summary">
        <div>
          <span>Sie bekommen noch</span>
          <strong>{fmt(receivable)}</strong>
          <small className="tk-muted">{invoices.length} {invoices.length === 1 ? "offene Rechnung" : "offene Rechnungen"}</small>
        </div>
        <div className={overdueSum > 0 ? "warn" : ""}>
          <span>davon überfällig</span>
          <strong>{fmt(overdueSum)}</strong>
          <small className="tk-muted">{overdue.length} {overdue.length === 1 ? "Rechnung" : "Rechnungen"}</small>
        </div>
        <div>
          <span>Sie müssen noch zahlen</span>
          <strong>{fmt(payable)}</strong>
          <small className="tk-muted">{expenses.length} {expenses.length === 1 ? "offener Beleg" : "offene Belege"}</small>
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="op-buckets">
          {buckets.map((x) => (
            <div key={x.b} className={`op-bucket ${x.b}`}>
              <span>{BUCKET_LABELS[x.b]}</span>
              <strong>{fmt(x.sum)}</strong>
              <small>{x.count}</small>
            </div>
          ))}
        </div>
      )}

      <section className="ust-box">
        <h3>Offene Kundenrechnungen</h3>
        {invoices.length === 0 ? (
          <p className="tk-muted">Alle Rechnungen sind bezahlt. 🎉</p>
        ) : (
          <ul className="bl-list">
            {invoices.map((i) => {
              const days = overdueDays(i.due_date, today);
              const level = levels.get(i.id) ?? 0;
              return (
                <li key={i.id} className={`bl-item op-item ${bucketOf(days)}`}>
                  <div className="bl-item-main">
                    <span className="bl-date">
                      {i.invoice_number}
                      {i.invoice_type === "partial" ? " · Abschlag" : ""} · vom {fmtDate(i.invoice_date)}
                    </span>
                    <strong>{(i.customer_id && names.get(Number(i.customer_id))) || "Kunde"}</strong>
                    <span className="bl-tags">
                      <span className={`bl-tag op-due ${bucketOf(days)}`}>
                        {days > 0 ? `${days} Tage überfällig (fällig ${fmtDate(i.due_date)})` : `fällig ${fmtDate(i.due_date)}`}
                      </span>
                      {level > 0 && <span className="bl-tag void">{level}. Mahnung</span>}
                    </span>
                  </div>
                  <div className="bl-item-amount">
                    <strong>{fmt(Number(i.total_amount))}</strong>
                  </div>
                  <div className="bl-item-actions">
                    <button type="button" className="bl-link" disabled={busy === `i${i.id}`} onClick={() => payInvoice(i)}>
                      als bezahlt markieren
                    </button>
                    {days > 0 && onOpenInvoices && (
                      <button type="button" className="bl-link" onClick={onOpenInvoices}>
                        {level >= 3 ? "zu den Rechnungen" : "Mahnung erstellen"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="ust-box op-box">
        <h3>Offene Belege (selbst zu bezahlen)</h3>
        {expenses.length === 0 ? (
          <p className="tk-muted">Keine offenen Belege.</p>
        ) : (
          <ul className="bl-list">
            {expenses.map((e) => (
              <li key={e.id} className="bl-item">
                <div className="bl-item-main">
                  <span className="bl-date">Beleg vom {fmtDate(e.receipt_date)}</span>
                  <strong>{e.supplier}</strong>
                  {e.description && <span className="tk-muted">{e.description}</span>}
                </div>
                <div className="bl-item-amount">
                  <strong>{fmt(Number(e.gross_amount))}</strong>
                </div>
                <div className="bl-item-actions">
                  <button type="button" className="bl-link" disabled={busy === `e${e.id}`} onClick={() => payExpense(e)}>
                    als bezahlt markieren
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="tk-muted bl-small bl-foot">
        Offene Rechnungen: alle nicht bezahlten Rechnungen ohne Stornos; Abschläge, die in einer Schlussrechnung verrechnet wurden, zählen dort.
        Mahnungen erstellen Sie wie gewohnt unter „Rechnungen“.
      </p>
    </div>
  );
}
