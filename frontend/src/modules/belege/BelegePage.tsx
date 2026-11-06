import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import BelegForm from "./BelegForm";
import type { Expense, ExpenseCategory, ExpensePeriod, OrderOption } from "./types";
import { CATEGORY_LABELS, PAYMENT_LABELS, countryCode, isForeignRate } from "./types";
import "../terminkalender/terminkalender.css";
import "./belege.css";
import { showConfirm, showPrompt } from "../../lib/dialogs";

const money = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE");
const monthNow = () => new Date().toLocaleDateString("sv-SE").slice(0, 7);
const monthRange = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}`, year: y, month: m };
};
const monthLabel = (ym: string) => {
  const { year, month } = monthRange(ym);
  return new Date(year, month - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
};

/** Buchhaltung: Belege & Ausgaben erfassen (nur Admins) */
export default function BelegePage({
  tenantId,
  country,
  aiAllowed,
  currencySymbol,
  onBack,
  embedded = false,
}: {
  tenantId: number;
  country?: string | null;
  aiAllowed: boolean;
  currencySymbol?: string | null;
  onBack: () => void;
  embedded?: boolean;
}) {
  const cc = countryCode(country);
  const [month, setMonth] = useState(monthNow());
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [showVoided, setShowVoided] = useState(false);
  const [items, setItems] = useState<Expense[] | null>(null);
  const [periods, setPeriods] = useState<ExpensePeriod[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<{ expense: Expense | null } | null>(null);

  const fmt = useCallback(
    (n: number) => (currencySymbol && currencySymbol !== "€" ? `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}` : money(n)),
    [currencySymbol]
  );

  const load = useCallback(async () => {
    const { from, to } = monthRange(month);
    try {
      const [list, per] = await Promise.all([api.loadExpenses(tenantId, from, to), api.loadPeriods(tenantId)]);
      setItems(list);
      setPeriods(per);
    } catch (e) {
      setItems([]);
      setError((e as Error).message);
    }
  }, [tenantId, month]);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(month);
    Promise.all([api.loadExpenses(tenantId, from, to), api.loadPeriods(tenantId)])
      .then(([list, per]) => {
        if (cancelled) return;
        setItems(list);
        setPeriods(per);
      })
      .catch((e) => {
        if (cancelled) return;
        setItems([]);
        setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, month]);

  useEffect(() => {
    api.loadOrders(tenantId).then(setOrders).catch(() => setOrders([]));
  }, [tenantId]);

  const { year, month: m } = monthRange(month);
  const period = periods.find((p) => p.period_year === year && p.period_month === m) ?? null;
  const canLock = !period && month < monthNow();
  const visible = useMemo(() => (items ?? []).filter((e) => (showVoided || !e.voided) && (!category || e.category === category)), [items, showVoided, category]);
  const valid = visible.filter((e) => !e.voided);
  const sum = (k: "gross_amount" | "net_amount" | "tax_amount") => valid.reduce((a, e) => a + Number(e[k] || 0), 0);
  // Vorsteuer nur mit inländischen Sätzen (oder „gemischt“); ausländische USt getrennt
  const foreignTax = valid.filter((e) => isForeignRate(e.tax_rate, cc)).reduce((a, e) => a + Number(e.tax_amount || 0), 0);
  const inputTax = sum("tax_amount") - foreignTax;
  const openCount = valid.filter((e) => !e.paid).length;
  const orderTitle = (id: number | null) => (id ? orders.find((o) => o.id === id)?.title ?? `Auftrag #${id}` : "");

  const view = async (e: Expense) => {
    if (!e.file_path) return;
    try {
      window.open(await api.receiptUrl(e.file_path), "_blank", "noopener");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const voidIt = async (e: Expense) => {
    const reason = await showPrompt(
      `Belege werden nicht gelöscht (Aufbewahrungspflicht), sondern bleiben als „ungültig“ sichtbar und zählen nicht mehr mit.\n\nGrund:`,
      { title: `Beleg „${e.supplier}“ vom ${fmtDate(e.receipt_date)} als ungültig markieren?`, tone: "warning", defaultValue: "doppelt erfasst", confirmLabel: "Als ungültig markieren" }
    );
    if (reason === null) return;
    setError("");
    try {
      await api.voidExpense(e.id, reason.trim());
      setSuccess("Beleg als ungültig markiert.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const togglePaid = async (e: Expense) => {
    setError("");
    try {
      await api.updateExpense(e.id, { paid: !e.paid });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const lock = async () => {
    if (
      !await showConfirm(
        `${monthLabel(month)} abschließen?\n\nDanach können die Belege dieses Monats nicht mehr geändert werden und es lassen sich keine neuen Belege mit Datum in diesem Monat erfassen. Nur „bezahlt“ lässt sich noch umstellen.\n\nTipp: Erst abschließen, wenn alle Belege des Monats erfasst sind (z. B. vor der Weitergabe an den Steuerberater).`,
        { title: "Monat abschließen?", confirmLabel: "Ja, abschließen" }
      )
    )
      return;
    setError("");
    try {
      const n = await api.lockMonth(year, m);
      setSuccess(`${monthLabel(month)} ist abgeschlossen (${n} Belege gesperrt).`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const content = (
    <>
        {error && <div className="tk-notice tk-notice-error">{error}</div>}
        {success && <div className="tk-notice tk-notice-success">{success}</div>}

        <div className="bl-toolbar">
          <label className="tk-field">
            <span>Monat</span>
            <input type="month" value={month} max={monthNow()} onChange={(e) => {
                if (!e.target.value) return;
                setItems(null);
                setMonth(e.target.value);
              }} />
          </label>
          <label className="tk-field">
            <span>Kategorie</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory | "")}>
              <option value="">Alle</option>
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="bl-check-inline">
            <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Ungültige anzeigen
          </label>
          <button
            type="button"
            className="btn btn-primary bl-add"
            disabled={!!period}
            title={period ? "Der Monat ist abgeschlossen" : undefined}
            onClick={() => {
              setSuccess("");
              setForm({ expense: null });
            }}
          >
            + Beleg erfassen
          </button>
        </div>

        <div className="bl-summary">
          <div>
            <span>Belege</span>
            <strong>{valid.length}</strong>
          </div>
          <div>
            <span>Brutto</span>
            <strong>{fmt(sum("gross_amount"))}</strong>
          </div>
          <div>
            <span>Netto</span>
            <strong>{fmt(sum("net_amount"))}</strong>
          </div>
          <div>
            <span>Vorsteuer</span>
            <strong>{fmt(inputTax)}</strong>
            {foreignTax > 0 && <small className="tk-muted">+ {fmt(foreignTax)} ausländische USt</small>}
          </div>
          <div>
            <span>Noch zu bezahlen</span>
            <strong>{openCount}</strong>
          </div>
        </div>

        <div className="bl-period">
          {period ? (
            <span className="bl-locked">🔒 {monthLabel(month)} abgeschlossen am {new Date(period.locked_at).toLocaleDateString("de-DE")}</span>
          ) : canLock ? (
            <button type="button" className="btn btn-secondary" onClick={lock}>
              {monthLabel(month)} abschließen
            </button>
          ) : (
            <span className="tk-muted">Der laufende Monat kann erst nach Monatsende abgeschlossen werden.</span>
          )}
        </div>

        {items === null ? (
          <p className="tk-muted">Wird geladen …</p>
        ) : visible.length === 0 ? (
          <div className="bl-empty">
            <p>Für {monthLabel(month)} sind noch keine Belege erfasst.</p>
            {!period && (
              <button type="button" className="btn btn-primary" onClick={() => setForm({ expense: null })}>
                Ersten Beleg erfassen
              </button>
            )}
          </div>
        ) : (
          <ul className="bl-list">
            {visible.map((e) => (
              <li key={e.id} className={`bl-item${e.voided ? " voided" : ""}`}>
                <div className="bl-item-main">
                  <span className="bl-date">{fmtDate(e.receipt_date)}</span>
                  <strong>{e.supplier}</strong>
                  {e.description && <span className="tk-muted">{e.description}</span>}
                  <span className="bl-tags">
                    <span className="bl-tag">{CATEGORY_LABELS[e.category] ?? e.category}</span>
                    {e.order_id && <span className="bl-tag order">{orderTitle(e.order_id)}</span>}
                    {e.ai_extracted && <span className="bl-tag ai">KI</span>}
                    {e.voided && <span className="bl-tag void">ungültig{e.void_reason ? `: ${e.void_reason}` : ""}</span>}
                    {e.locked && !e.voided && <span className="bl-tag lock">🔒</span>}
                  </span>
                </div>
                <div className="bl-item-amount">
                  <strong>{fmt(Number(e.gross_amount))}</strong>
                  {e.original_currency && e.original_amount != null && (
                    <span className="tk-muted">
                      {Number(e.original_amount).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {e.original_currency}
                    </span>
                  )}
                  <span className="tk-muted">
                    netto {fmt(Number(e.net_amount))} · VSt {fmt(Number(e.tax_amount))}
                    {e.tax_rate !== null ? ` (${Number(e.tax_rate).toLocaleString("de-DE")} %${isForeignRate(e.tax_rate, cc) ? ", Ausland" : ""})` : " (gemischt)"}
                  </span>
                  <span className={`bl-paid${e.paid ? " yes" : ""}`}>
                    {e.paid ? `bezahlt${e.payment_method ? ` · ${PAYMENT_LABELS[e.payment_method]}` : ""}` : "offen"}
                  </span>
                </div>
                <div className="bl-item-actions">
                  {e.file_path ? (
                    <button type="button" className="bl-link" onClick={() => view(e)}>
                      Beleg ansehen
                    </button>
                  ) : (
                    <span className="tk-muted bl-small">ohne Datei</span>
                  )}
                  {!e.voided && (
                    <button type="button" className="bl-link" onClick={() => togglePaid(e)}>
                      {e.paid ? "auf offen setzen" : "als bezahlt markieren"}
                    </button>
                  )}
                  {!e.voided && !e.locked && (
                    <>
                      <button
                        type="button"
                        className="bl-link"
                        onClick={() => {
                          setSuccess("");
                          setForm({ expense: e });
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button type="button" className="bl-link danger" onClick={() => voidIt(e)}>
                        Ungültig
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="tk-muted bl-small bl-foot">
          Belege werden geschützt gespeichert und können nicht gelöscht oder ausgetauscht werden (Aufbewahrungspflicht 10 Jahre). Fehlerfassungen
          markieren Sie als „ungültig“.
        </p>

      {form && (
        <BelegForm
          tenantId={tenantId}
          country={cc}
          aiAllowed={aiAllowed}
          orders={orders}
          expense={form.expense}
          onClose={() => setForm(null)}
          onSaved={(msg) => {
            setForm(null);
            setSuccess(msg);
            load();
          }}
        />
      )}
    </>
  );

  // eingebettet in „Buchhaltung“ (Reiter) – ohne eigenen Rahmen
  if (embedded) return content;
  return (
    <section className="single-page-section tk-root bl-app">
      <div className="card form-page-card tk-card">
        <div className="page-topbar">
          <div>
            <h1>Belege &amp; Ausgaben</h1>
            <p className="tk-muted">Eingangsrechnungen und Quittungen fotografieren, Aufträgen zuordnen und die Vorsteuer im Blick behalten.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Zurück zum Dashboard
          </button>
        </div>
        {content}
      </div>
    </section>
  );
}
