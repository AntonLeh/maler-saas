// BI → Materialanalyse: Kosten, Anteil am Umsatz, Beschädigtes, Lagerwert, Nachbestellen, Kategorien
import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { countsAsRevenue, inRange, invoiceDay, netAmount, pct1, periodRanges } from "./logic";
import type { InvoiceRow } from "./logic";
import { byCategory, materialStats, materialSummary, mostDamaged, qtyText, toReorder } from "./materials";
import type { MatLog, MatRow, MatStat } from "./materials";
import { PeriodTabs } from "./shared";
import { moneyFormatter, usePeriod } from "./period";
import "./bi.css";

type SortKey = "name" | "category" | "qty" | "price" | "cost" | "damagedCost" | "stock";

export default function MaterialAnalysis({ tenantId, currency, onBack }: { tenantId: number; currency: string; onBack: () => void }) {
  const [data, setData] = useState<{ materials: MatRow[]; logs: MatLog[]; invoices: InvoiceRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [period, choose] = usePeriod();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyUsed, setOnlyUsed] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "cost", dir: -1 });
  const money = moneyFormatter(currency);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [m, l, i] = await Promise.all([
        supabase.from("materials").select("*").eq("tenant_id", tenantId),
        supabase.from("material_consumption_logs").select("*").eq("tenant_id", tenantId),
        supabase.from("invoices").select("invoice_date, created_at, subtotal, tax_rate, tax_amount, total_amount, status, document_type").eq("tenant_id", tenantId),
      ]);
      if (cancel) return;
      if (m.error) setErr("Die Materialdaten konnten nicht geladen werden. Bitte später noch einmal versuchen.");
      else setData({ materials: (m.data ?? []) as MatRow[], logs: (l.data ?? []) as MatLog[], invoices: (i.data ?? []) as InvoiceRow[] });
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId]);

  const calc = useMemo(() => {
    if (!data) return null;
    const r = periodRanges(period).cur;
    const rows = materialStats(data.materials, data.logs, r);
    const revenue = data.invoices.filter((x) => countsAsRevenue(x) && inRange(invoiceDay(x), r)).reduce((s, x) => s + netAmount(x), 0);
    return { rows, sum: materialSummary(rows, revenue), cats: byCategory(rows), reorder: toReorder(rows), damaged: mostDamaged(rows) };
  }, [data, period]);

  const categories = useMemo(() => [...new Set((calc?.rows ?? []).map((r) => r.category))].sort((a, b) => a.localeCompare(b, "de")), [calc]);

  const shown = useMemo(() => {
    if (!calc) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = calc.rows.filter((r) => (!onlyUsed || r.cost > 0 || r.low) && (!cat || r.category === cat) && words.every((w) => r.name.toLowerCase().includes(w)));
    const val = (r: MatStat) => r[sort.key];
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "string" ? x.localeCompare(String(y), "de") : (x as number) - (y as number)) * sort.dir;
    });
  }, [calc, q, cat, onlyUsed, sort]);

  const th = (key: SortKey, label: string, num = true) => (
    <th className={num ? "num" : ""} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" || key === "category" ? 1 : -1 }))}>
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
              <Package size={24} aria-hidden="true" /> Materialanalyse
            </h2>
            <p>Was kostet Material, wo geht es kaputt, was muss nachbestellt werden – Beträge netto zum Einkaufspreis.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Zurück
          </button>
        </div>

        <PeriodTabs value={period} onChange={choose} />

        {err && <p className="bi2-msg">{err}</p>}
        {!calc && !err && <p className="bi2-muted">Materialdaten werden geladen …</p>}

        {calc && (
          <>
            <section className="bi2-kpis" aria-label="Kennzahlen">
              <div className="bi2-kpi">
                <span>Materialkosten</span>
                <b>{money(calc.sum.cost)}</b>
                <small>im Zeitraum</small>
              </div>
              <div className={`bi2-kpi${(calc.sum.revenueShare ?? 0) > 30 ? " yellow" : ""}`}>
                <span>Anteil am Umsatz</span>
                <b>{calc.sum.revenueShare != null ? `${pct1(calc.sum.revenueShare)} %` : "–"}</b>
                <small>{calc.sum.revenueShare != null ? "Material / Umsatz netto" : "noch kein Umsatz"}</small>
              </div>
              <div className={`bi2-kpi${calc.sum.damaged > 0 ? " red" : ""}`}>
                <span>Beschädigt</span>
                <b>{money(calc.sum.damaged)}</b>
                <small>Schwund im Zeitraum</small>
              </div>
              <div className="bi2-kpi">
                <span>Lagerwert</span>
                <b>{money(calc.sum.stockValue)}</b>
                <small>aktuell, Bestand × Einkaufspreis</small>
              </div>
              <div className={`bi2-kpi${calc.sum.low > 0 ? " yellow" : ""}`}>
                <span>Nachbestellen</span>
                <b>{calc.sum.low}</b>
                <small>unter Mindestbestand</small>
              </div>
            </section>

            <div className="bi2-three">
              <section className="bi2-card">
                <h3>📦 Nachbestellen</h3>
                {calc.reorder.length === 0 ? (
                  <p className="bi2-muted">Alles ausreichend auf Lager – oder noch kein Mindestbestand hinterlegt.</p>
                ) : (
                  <ul className="bi2-list">
                    {calc.reorder.map((r) => (
                      <li key={r.id}>
                        <span>
                          {r.name}
                          <small>Mindestens {qtyText(r.minimum, r.unit)}</small>
                        </span>
                        <b className="tone-red">{qtyText(r.stock, r.unit)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="bi2-card">
                <h3>💥 Beschädigt</h3>
                {calc.damaged.length === 0 ? (
                  <p className="bi2-muted">Im Zeitraum wurde kein Material als beschädigt gebucht.</p>
                ) : (
                  <ul className="bi2-list">
                    {calc.damaged.map((r) => (
                      <li key={r.id}>
                        <span>
                          {r.name}
                          <small>{qtyText(r.damagedQty, r.unit)}</small>
                        </span>
                        <b className="tone-red">{money(r.damagedCost)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="bi2-card">
                <h3>🗂 Kosten nach Kategorie</h3>
                {calc.cats.length === 0 ? (
                  <p className="bi2-muted">Im Zeitraum wurde kein Material verbraucht.</p>
                ) : (
                  <ul className="bi2-cats">
                    {calc.cats.map((c) => (
                      <li key={c.category}>
                        <span className="bi2-cats-top">
                          <span>{c.category}</span>
                          <b>
                            {money(c.cost)} <small>{pct1(c.share)} %</small>
                          </b>
                        </span>
                        <span className="bi2-share wide">
                          <span style={{ width: `${Math.min(c.share, 100)}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="bi2-card">
              <div className="bi2-tablebar">
                <h3>Alle Materialien</h3>
                <input type="search" placeholder="Material suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Material suchen" />
                {categories.length > 1 && (
                  <select className="bi2-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategorie">
                    <option value="">Alle Kategorien</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                <label className="bi2-check">
                  <input type="checkbox" checked={!onlyUsed} onChange={(e) => setOnlyUsed(!e.target.checked)} /> auch Material ohne Verbrauch
                </label>
              </div>
              {shown.length === 0 ? (
                <p className="bi2-muted">{q || cat ? "Kein Material gefunden." : "Im gewählten Zeitraum wurde kein Material verbraucht."}</p>
              ) : (
                <div className="bi2-table-wrap">
                  <table className="bi2-table mats">
                    <thead>
                      <tr>
                        {th("name", "Material", false)}
                        {th("category", "Kategorie", false)}
                        {th("qty", "Verbrauch")}
                        {th("price", "Einkauf")}
                        {th("cost", "Kosten")}
                        <th>Anteil</th>
                        {th("damagedCost", "Beschädigt")}
                        {th("stock", "Bestand")}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.id}>
                          <td className="name" data-label="Material">
                            {r.name}
                          </td>
                          <td data-label="Kategorie">{r.category}</td>
                          <td className="num" data-label="Verbrauch">
                            {r.qty > 0 ? qtyText(r.qty, r.unit) : "–"}
                          </td>
                          <td className="num" data-label="Einkauf">
                            {money(r.price, 2)}
                            {r.unit && <small> / {r.unit}</small>}
                          </td>
                          <td className="num strong" data-label="Kosten">
                            {r.cost > 0 ? money(r.cost) : "–"}
                          </td>
                          <td data-label="Anteil">
                            <span className="bi2-share">
                              <span style={{ width: `${Math.min(r.share, 100)}%` }} />
                            </span>
                            <small>{r.share > 0 ? `${pct1(r.share)} %` : "–"}</small>
                          </td>
                          <td className={`num${r.damagedCost > 0 ? " warn" : ""}`} data-label="Beschädigt">
                            {r.damagedCost > 0 ? money(r.damagedCost) : "–"}
                          </td>
                          <td className={`num${r.low ? " tone-red" : ""}`} data-label="Bestand">
                            {qtyText(r.stock, r.unit)}
                            {r.low && <small> nachbestellen</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="bi2-small">
                Verbrauch = verbraucht + auf der Baustelle gelassen + beschädigt, jeweils zum Einkaufspreis bei der Buchung. Bestand und Lagerwert sind aktuell, unabhängig vom
                Zeitraum. Mindestbestände legen Sie in der Materialverwaltung fest.
              </p>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
