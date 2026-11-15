// BI → Auftragsanalyse: Nachkalkulation je Auftrag (Angebot, abgerechnet, Kosten, Deckungsbeitrag, Stunden Ist/Plan)
import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { statusLabel } from "../projektleiter/logic";
import { pct1, periodRanges } from "./logic";
import type { InvoiceRow } from "./logic";
import { hoursTone, lowestMargin, marginTone, orderStats, orderSummary, overHours } from "./orders";
import type { OExternal, OMaterial, OTime, OrderFilter, OrderRow, OrderStat, QuoteRow } from "./orders";
import { PeriodTabs } from "./shared";
import { moneyFormatter, usePeriod } from "./period";
import "./bi.css";

type Data = { orders: OrderRow[]; quotes: QuoteRow[]; invoices: InvoiceRow[]; time: OTime[]; external: OExternal[]; material: OMaterial[]; prices: Map<number, number> };
type SortKey = "title" | "quote" | "billed" | "cost" | "marginPct" | "hoursPct";

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "running", label: "Laufend" },
  { key: "done", label: "Abgeschlossen" },
];
const hrs = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

export default function OrderAnalysis({ tenantId, currency, onBack }: { tenantId: number; currency: string; onBack: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [period, choose] = usePeriod();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "billed", dir: -1 });
  const money = moneyFormatter(currency);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [o, qu, inv, time, ext, logs, mats] = await Promise.all([
        supabase.from("orders").select("id, title, status, start_date, created_at, planned_hours, quote_id, customer_id").eq("tenant_id", tenantId),
        supabase.from("quotes").select("id, subtotal, tax_rate, tax_amount, total_amount").eq("tenant_id", tenantId),
        supabase.from("invoices").select("order_id, invoice_date, created_at, subtotal, tax_rate, tax_amount, total_amount, status, document_type").eq("tenant_id", tenantId),
        supabase.rpc("admin_get_time_evaluation", { p_from: null, p_to: null, p_employee_id: null, p_order_id: null }),
        supabase.from("order_external_costs").select("order_id, amount_net").eq("tenant_id", tenantId),
        supabase.from("material_consumption_logs").select("order_id, material_id, action, quantity, material_price_at_use").eq("tenant_id", tenantId),
        supabase.from("materials").select("id, purchase_price").eq("tenant_id", tenantId),
      ]);
      if (cancel) return;
      if (o.error || inv.error) {
        setErr("Die Auftragsdaten konnten nicht geladen werden. Bitte später noch einmal versuchen.");
        return;
      }
      // Materialbuchungen ohne Preisspalte (ältere Datenbank) – dann ohne den Preis noch einmal laden
      let material = (logs.data ?? []) as OMaterial[];
      if (logs.error) {
        const retry = await supabase.from("material_consumption_logs").select("order_id, material_id, action, quantity").eq("tenant_id", tenantId);
        material = (retry.data ?? []) as OMaterial[];
      }
      setData({
        orders: (o.data ?? []) as OrderRow[],
        quotes: (qu.data ?? []) as QuoteRow[],
        invoices: (inv.data ?? []) as InvoiceRow[],
        time: (time.data ?? []) as OTime[],
        external: (ext.data ?? []) as OExternal[],
        material,
        prices: new Map(((mats.data ?? []) as { id: number; purchase_price: number | null }[]).map((m) => [m.id, Number(m.purchase_price || 0)])),
      });
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId]);

  const calc = useMemo(() => {
    if (!data) return null;
    const rows = orderStats(data, periodRanges(period).cur, filter);
    return { rows, sum: orderSummary(rows), low: lowestMargin(rows), over: overHours(rows) };
  }, [data, period, filter]);

  const shown = useMemo(() => {
    if (!calc) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = calc.rows.filter((r) => words.every((w) => r.title.toLowerCase().includes(w)));
    const val = (r: OrderStat) => (sort.key === "title" ? r.title : r[sort.key]);
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (typeof x === "string") return x.localeCompare(String(y), "de") * sort.dir;
      if (x == null && y == null) return 0;
      if (x == null) return 1; // leere Werte immer nach unten
      if (y == null) return -1;
      return ((x as number) - (y as number)) * sort.dir;
    });
  }, [calc, q, sort]);

  const th = (key: SortKey, label: string, num = true) => (
    <th className={num ? "num" : ""} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "title" ? 1 : -1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  return (
    <section className="single-page-section">
      <div className="bi2">
        <div className="bi2-top">
          <div>
            <h2>
              <TrendingUp size={24} aria-hidden="true" /> Auftragsanalyse
            </h2>
            <p>Nachkalkulation je Auftrag: Angebot, Rechnung, Kosten und Stunden – alle Beträge netto.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Zurück
          </button>
        </div>

        <div className="bi2-filterrow">
          <PeriodTabs value={period} onChange={choose} />
          <div className="bi2-periods" role="tablist" aria-label="Status">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p className="bi2-note">Zeitraum nach Auftragsbeginn.</p>

        {err && <p className="bi2-msg">{err}</p>}
        {!calc && !err && <p className="bi2-muted">Auftragsdaten werden geladen …</p>}

        {calc && (
          <>
            <section className="bi2-kpis four" aria-label="Kennzahlen">
              <div className="bi2-kpi">
                <span>Abgerechnet</span>
                <b>{money(calc.sum.billed)}</b>
                <small>
                  {calc.sum.billedCount} Auftr{calc.sum.billedCount === 1 ? "ag" : "äge"} mit Rechnung
                </small>
              </div>
              <div className={`bi2-kpi ${marginTone(calc.sum.marginPct)}`}>
                <span>Deckungsbeitrag</span>
                <b>{money(calc.sum.margin)}</b>
                <small>{calc.sum.marginPct != null ? `Ø ${pct1(calc.sum.marginPct)} % vom Umsatz` : "–"}</small>
              </div>
              <div className="bi2-kpi">
                <span>Aufträge im Zeitraum</span>
                <b>{calc.rows.length}</b>
                <small>{calc.rows.filter((r) => !r.done).length} laufend</small>
              </div>
              <div className={`bi2-kpi${calc.sum.overPlan > 0 ? " yellow" : ""}`}>
                <span>Über Planstunden</span>
                <b>{calc.sum.overPlan}</b>
                <small>{calc.sum.withPlan > 0 ? `von ${calc.sum.withPlan} mit Planstunden` : "noch keine Planstunden hinterlegt"}</small>
              </div>
            </section>

            <div className="bi2-two even">
              <section className="bi2-card">
                <h3>📉 Bringt am wenigsten</h3>
                {calc.low.length === 0 ? (
                  <p className="bi2-muted">Noch keine abgerechneten Aufträge im Zeitraum.</p>
                ) : (
                  <ul className="bi2-list">
                    {calc.low.map((r) => (
                      <li key={r.id}>
                        <span>
                          {r.title}
                          <small>
                            {money(r.billed)} abgerechnet · Kosten {money(r.cost)}
                          </small>
                        </span>
                        <b className={`tone-${marginTone(r.marginPct)}`}>{pct1(r.marginPct ?? 0)} %</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="bi2-card">
                <h3>⏱ Stunden überschritten</h3>
                {calc.over.length === 0 ? (
                  <p className="bi2-muted">{calc.sum.withPlan > 0 ? "Kein Auftrag liegt mehr als 10 % über den Planstunden." : "Für die Aufträge sind noch keine Planstunden hinterlegt."}</p>
                ) : (
                  <ul className="bi2-list">
                    {calc.over.map((r) => (
                      <li key={r.id}>
                        <span>
                          {r.title}
                          <small>
                            {hrs(r.hours)} von {hrs(r.planned ?? 0)} Std. · {r.done ? "abgeschlossen" : "läuft noch"}
                          </small>
                        </span>
                        <b className="tone-red">+{Math.round((r.hoursPct ?? 100) - 100)} %</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="bi2-card">
              <div className="bi2-tablebar">
                <h3>Nachkalkulation je Auftrag</h3>
                <input type="search" placeholder="Auftrag suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Auftrag suchen" />
              </div>
              {shown.length === 0 ? (
                <p className="bi2-muted">{q ? "Kein Auftrag gefunden." : "Im gewählten Zeitraum gibt es keine Aufträge."}</p>
              ) : (
                <div className="bi2-table-wrap">
                  <table className="bi2-table orders">
                    <thead>
                      <tr>
                        {th("title", "Auftrag", false)}
                        {th("quote", "Angebot")}
                        {th("billed", "Abgerechnet")}
                        <th className="num">Lohn</th>
                        <th className="num">Material</th>
                        <th className="num">Fremd</th>
                        {th("marginPct", "Deckungsbeitrag")}
                        {th("hoursPct", "Stunden Ist / Plan")}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.id}>
                          <td className="name" data-label="Auftrag">
                            {r.title}
                            <small className="sub">
                              <span className={`bi2-chip${r.done ? " done" : ""}`}>{statusLabel(r.status)}</span>
                              {r.start && new Date(`${r.start}T12:00:00`).toLocaleDateString("de-DE")}
                            </small>
                          </td>
                          <td className="num" data-label="Angebot">
                            {r.quote != null ? money(r.quote) : "–"}
                          </td>
                          <td className="num strong" data-label="Abgerechnet">
                            {r.billed > 0 ? money(r.billed) : "–"}
                          </td>
                          <td className="num" data-label="Lohn">
                            {money(r.labor)}
                          </td>
                          <td className="num" data-label="Material">
                            {money(r.material)}
                          </td>
                          <td className="num" data-label="Fremd">
                            {money(r.external)}
                          </td>
                          <td className="num" data-label="Deckungsbeitrag">
                            {r.margin != null ? (
                              <>
                                <span className={`tone-${marginTone(r.marginPct)}`}>{money(r.margin)}</span>
                                <small> {pct1(r.marginPct ?? 0)} %</small>
                              </>
                            ) : (
                              <span className="bi2-open">
                                noch nicht abgerechnet
                                {r.costOfQuotePct != null && (
                                  <small className={r.costOfQuotePct > 100 ? "tone-red" : r.costOfQuotePct > 80 ? "tone-yellow" : ""}>Kosten bisher {Math.round(r.costOfQuotePct)} % des Angebots</small>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="num" data-label="Stunden Ist / Plan">
                            {r.planned != null ? (
                              <span className="bi2-hours">
                                <span>
                                  {hrs(r.hours)} / {hrs(r.planned)}
                                </span>
                                <span className={`bi2-meter ${hoursTone(r.hoursPct)}`}>
                                  <span style={{ width: `${Math.min(r.hoursPct ?? 0, 100)}%` }} />
                                </span>
                              </span>
                            ) : (
                              <span>
                                {hrs(r.hours)} <small>ohne Plan</small>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="bi2-small">
                Angebot und Rechnung netto (nur gültige Rechnungen). Kosten = Lohn + Material (Einkaufspreis) + Fremdleistungen. Deckungsbeitrag erst, wenn eine Rechnung vorliegt.
                Stunden: grün bis 100 %, orange bis 110 %, rot darüber.
              </p>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
