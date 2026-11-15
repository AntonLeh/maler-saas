// BI → Kundenanalyse: eine sortierbare Kundentabelle, A/B/C nach 80/15/5, späte Zahler, lange nicht gemeldete Kunden
import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { pct1, periodRanges } from "./logic";
import { customerStats, latePayers, sleeping, summary } from "./customers";
import type { CInvoice, CustomerRow, CustomerStat } from "./customers";
import { PeriodTabs } from "./shared";
import { moneyFormatter, usePeriod } from "./period";
import "./bi.css";

type SortKey = "name" | "invoices" | "revenue" | "open" | "payDays" | "lastInvoice";

const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–");

export default function CustomerAnalysis({ tenantId, currency, onBack }: { tenantId: number; currency: string; onBack: () => void }) {
  const [data, setData] = useState<{ customers: CustomerRow[]; invoices: CInvoice[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [period, choose] = usePeriod();
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "revenue", dir: -1 });
  const money = moneyFormatter(currency);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [c, i] = await Promise.all([
        supabase.from("customers").select("id, first_name, last_name, company_name").eq("tenant_id", tenantId),
        supabase
          .from("invoices")
          .select("id, customer_id, invoice_date, created_at, due_date, paid_at, subtotal, tax_rate, tax_amount, total_amount, status, document_type")
          .eq("tenant_id", tenantId),
      ]);
      if (cancel) return;
      if (c.error || i.error) setErr("Die Kundendaten konnten nicht geladen werden. Bitte später noch einmal versuchen.");
      else setData({ customers: (c.data ?? []) as CustomerRow[], invoices: (i.data ?? []) as CInvoice[] });
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId]);

  const calc = useMemo(() => {
    if (!data) return null;
    const r = periodRanges(period).cur;
    const rows = customerStats(data.customers, data.invoices, r);
    return { rows, sum: summary(rows, data.invoices, r), late: latePayers(rows), sleep: sleeping(rows) };
  }, [data, period]);

  const shown = useMemo(() => {
    if (!calc) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = calc.rows.filter((r) => (showAll || r.revenue > 0 || r.open > 0) && words.every((w) => r.name.toLowerCase().includes(w)));
    const val = (r: CustomerStat) => (sort.key === "name" ? r.name : r[sort.key] ?? (sort.dir === 1 ? Infinity : -Infinity));
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "string" ? x.localeCompare(String(y), "de") : (x as number) - (y as number)) * sort.dir;
    });
  }, [calc, q, showAll, sort]);

  const rank = useMemo(() => new Map((calc?.rows ?? []).filter((r) => r.revenue > 0).map((r, i) => [r.id, i + 1])), [calc]);

  const th = (key: SortKey, label: string, num = false) => (
    <th className={num ? "num" : ""} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}>
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
              <Users size={24} aria-hidden="true" /> Kundenanalyse
            </h2>
            <p>Welche Kunden bringen den Umsatz, wer zahlt spät, wer hat sich lange nicht gemeldet – Umsatz netto.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Zurück
          </button>
        </div>

        <PeriodTabs value={period} onChange={choose} />

        {err && <p className="bi2-msg">{err}</p>}
        {!calc && !err && <p className="bi2-muted">Kundendaten werden geladen …</p>}

        {calc && (
          <>
            <section className="bi2-kpis" aria-label="Kennzahlen">
              <div className="bi2-kpi">
                <span>Umsatz</span>
                <b>{money(calc.sum.revenue)}</b>
              </div>
              <div className="bi2-kpi">
                <span>Kunden mit Umsatz</span>
                <b>{calc.sum.customers}</b>
              </div>
              <div className="bi2-kpi">
                <span>Ø Umsatz je Kunde</span>
                <b>{money(calc.sum.perCustomer)}</b>
              </div>
              <div className="bi2-kpi">
                <span>Offene Rechnungen</span>
                <b>{money(calc.sum.open)}</b>
                <small>
                  {calc.sum.openCount} offen{calc.sum.dunned > 0 ? ` · ${calc.sum.dunned} gemahnt` : ""} · aktuell, brutto
                </small>
              </div>
              <div className="bi2-kpi">
                <span>Ø Zahlungsdauer</span>
                <b>{calc.sum.payDays != null ? `${calc.sum.payDays} Tage` : "–"}</b>
                <small>Rechnung bis Zahlung</small>
              </div>
            </section>

            {calc.sum.aCount > 0 && (
              <p className="bi2-lead">
                <b>
                  {calc.sum.aCount === 1 ? "1 Kunde bringt" : `${calc.sum.aCount} Kunden bringen`} {pct1(calc.sum.aShare)} % Ihres Umsatzes
                </b>{" "}
                – das sind Ihre A-Kunden. B-Kunden bringen die nächsten 15 %, C-Kunden den Rest.
              </p>
            )}

            <div className="bi2-two even">
              <section className="bi2-card">
                <h3>⏰ Zahlt eher spät</h3>
                {calc.late.length === 0 ? (
                  <p className="bi2-muted">Keine Auffälligkeiten – Ihre Kunden zahlen im Schnitt pünktlich.</p>
                ) : (
                  <ul className="bi2-list">
                    {calc.late.map((r) => (
                      <li key={r.id}>
                        <span>{r.name}</span>
                        <b className="warn">Ø {r.lateDays} Tage nach Fälligkeit</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="bi2-card">
                <h3>📞 Lange nichts gehört</h3>
                {calc.sleep.length === 0 ? (
                  <p className="bi2-muted">Alle Kunden mit Umsatz hatten in den letzten 12 Monaten eine Rechnung.</p>
                ) : (
                  <>
                    <ul className="bi2-list">
                      {calc.sleep.map((r) => (
                        <li key={r.id}>
                          <span>
                            {r.name}
                            <small>letzte Rechnung {fmtDate(r.lastInvoice)}</small>
                          </span>
                          <b>{money(r.lifetime)} gesamt</b>
                        </li>
                      ))}
                    </ul>
                    <p className="bi2-small">Gute Kandidaten für einen Anruf oder ein neues Angebot.</p>
                  </>
                )}
              </section>
            </div>

            <section className="bi2-card">
              <div className="bi2-tablebar">
                <h3>Alle Kunden</h3>
                <input type="search" placeholder="Kunde suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Kunde suchen" />
                <label className="bi2-check">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> auch Kunden ohne Umsatz
                </label>
              </div>
              {shown.length === 0 ? (
                <p className="bi2-muted">{q ? "Kein Kunde gefunden." : "Im gewählten Zeitraum hat noch kein Kunde Umsatz."}</p>
              ) : (
                <div className="bi2-table-wrap">
                  <table className="bi2-table">
                    <thead>
                      <tr>
                        <th className="num">#</th>
                        {th("name", "Kunde")}
                        {th("invoices", "Rechnungen", true)}
                        {th("revenue", "Umsatz", true)}
                        <th>Anteil</th>
                        {th("open", "Offen", true)}
                        {th("payDays", "Ø Zahlung", true)}
                        {th("lastInvoice", "Letzte Rechnung")}
                        <th>Klasse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.id}>
                          <td className="num muted" data-label="Rang">
                            {rank.get(r.id) ?? "–"}
                          </td>
                          <td className="name" data-label="Kunde">
                            {r.name}
                          </td>
                          <td className="num" data-label="Rechnungen">
                            {r.invoices}
                          </td>
                          <td className="num strong" data-label="Umsatz">
                            {money(r.revenue)}
                          </td>
                          <td data-label="Anteil">
                            <span className="bi2-share">
                              <span style={{ width: `${Math.min(r.share, 100)}%` }} />
                            </span>
                            <small>{r.share > 0 ? `${pct1(r.share)} %` : "–"}</small>
                          </td>
                          <td className={`num${r.dunned > 0 ? " warn" : ""}`} data-label="Offen">
                            {r.open > 0 ? money(r.open, 2) : "–"}
                            {r.dunned > 0 && <small> gemahnt</small>}
                          </td>
                          <td className="num" data-label="Ø Zahlung">
                            {r.payDays != null ? `${r.payDays} T.` : "–"}
                          </td>
                          <td data-label="Letzte Rechnung">{fmtDate(r.lastInvoice)}</td>
                          <td data-label="Klasse">{r.abc !== "–" ? <span className={`bi2-abc ${r.abc}`}>{r.abc}</span> : "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="bi2-small">Umsatz netto im gewählten Zeitraum, nur gültige Rechnungen. „Offen“ = aktuell offene Rechnungen inkl. Mehrwertsteuer.</p>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
