// Business Intelligence: Unternehmer-Cockpit mit Zeitraum, Vergleich, Umsatzverlauf und automatischer Einschätzung
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clock, Package, Trophy, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { pct1, assessment, change, figures, monthlyRevenue, periodRanges, receivables } from "./logic";
import type { ExternalRow, InvoiceRow, MaterialLog, TimeRow } from "./logic";
import { PeriodTabs } from "./shared";
import { moneyFormatter, usePeriod } from "./period";
import "./bi.css";

export type BiTarget = "customers" | "orders" | "time" | "material" | "performance";

type Data = { invoices: InvoiceRow[]; time: TimeRow[]; external: ExternalRow[]; material: MaterialLog[]; prices: Map<number, number> };

export default function BiCockpit({ tenantId, currency, onBack, onOpen }: { tenantId: number; currency: string; onBack: () => void; onOpen: (t: BiTarget) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [period, choose] = usePeriod();

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [inv, time, ext, logs, mats] = await Promise.all([
          supabase.from("invoices").select("id, customer_id, order_id, invoice_date, created_at, subtotal, tax_rate, tax_amount, total_amount, status, document_type").eq("tenant_id", tenantId),
          supabase.rpc("admin_get_time_evaluation", { p_from: null, p_to: null, p_employee_id: null, p_order_id: null }),
          supabase.from("order_external_costs").select("invoice_date, created_at, amount_net").eq("tenant_id", tenantId),
          supabase.from("material_consumption_logs").select("*").eq("tenant_id", tenantId),
          supabase.from("materials").select("id, purchase_price").eq("tenant_id", tenantId),
        ]);
        if (inv.error) throw inv.error;
        if (cancel) return;
        setData({
          invoices: (inv.data ?? []) as InvoiceRow[],
          time: (time.data ?? []) as TimeRow[],
          external: (ext.data ?? []) as ExternalRow[], // ohne Datenbank-Update „Fremdleistungen“ einfach leer
          material: (logs.data ?? []) as MaterialLog[],
          prices: new Map(((mats.data ?? []) as { id: number; purchase_price: number | null }[]).map((m) => [m.id, Number(m.purchase_price || 0)])),
        });
      } catch {
        if (!cancel) setErr("Die Zahlen konnten nicht geladen werden. Bitte später noch einmal versuchen.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId]);

  const money = moneyFormatter(currency);

  const calc = useMemo(() => {
    if (!data) return null;
    const r = periodRanges(period);
    const cur = figures(data, r.cur);
    const prev = r.prev ? figures(data, r.prev) : null;
    const rec = receivables(data.invoices);
    const months = monthlyRevenue(data.invoices);
    // Ø Monatsumsatz der letzten 3 vollen Monate, auf brutto umgerechnet – offene Rechnungen sind brutto
    const last3 = months.slice(-4, -1).reduce((s, m) => s + m.revenue, 0) / 3;
    const ratio = data.invoices.length ? taxFactor(data.invoices) : 1;
    const advice = assessment(cur, rec, last3 * ratio, (n) => money(n));
    return { r, cur, prev, rec, months, advice };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, period, currency]);

  return (
    <section className="single-page-section">
      <div className="bi2">
        <div className="bi2-top">
          <div>
            <h2>
              <BarChart3 size={24} aria-hidden="true" /> Business Intelligence
            </h2>
            <p>Umsatz, Kosten und Rentabilität Ihres Betriebs – alle Beträge netto (ohne Mehrwertsteuer).</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Zurück
          </button>
        </div>

        <PeriodTabs value={period} onChange={choose} />

        {err && <p className="bi2-msg">{err}</p>}
        {!calc && !err && <p className="bi2-muted">Zahlen werden geladen …</p>}

        {calc && (
          <>
            <section className="bi2-kpis" aria-label="Kennzahlen">
              <Kpi label="Umsatz" value={money(calc.cur.revenue)} sub={`${calc.cur.invoices} Rechnung${calc.cur.invoices === 1 ? "" : "en"}`} delta={calc.prev ? change(calc.cur.revenue, calc.prev.revenue) : null} />
              <Kpi label="Lohnkosten" value={money(calc.cur.labor)} sub={pctOf(calc.cur.labor, calc.cur.revenue)} />
              <Kpi label="Material" value={money(calc.cur.material)} sub={pctOf(calc.cur.material, calc.cur.revenue)} />
              <Kpi label="Fremdleistungen" value={money(calc.cur.external)} sub={pctOf(calc.cur.external, calc.cur.revenue)} />
              <Kpi
                label="Deckungsbeitrag"
                value={money(calc.cur.margin)}
                sub={calc.cur.marginPct != null ? `${pct1(calc.cur.marginPct)} % vom Umsatz` : "–"}
                delta={calc.prev ? change(calc.cur.margin, calc.prev.margin) : null}
                tone={calc.cur.marginPct == null ? undefined : calc.cur.marginPct < 10 ? "red" : calc.cur.marginPct < 20 ? "yellow" : "green"}
              />
            </section>
            {calc.prev && <p className="bi2-note">Pfeile: Vergleich mit {calc.r.prevLabel}.</p>}

            <div className="bi2-two">
              <section className="bi2-card">
                <h3>Umsatz der letzten 12 Monate</h3>
                <Bars months={calc.months} money={money} />
              </section>

              <section className="bi2-card">
                <h3>Offene Rechnungen (aktuell)</h3>
                <div className="bi2-rec">
                  <b>{money(calc.rec.amount, 2)}</b>
                  <span>
                    {calc.rec.count} offen{calc.rec.dunned > 0 ? ` · davon ${calc.rec.dunned} gemahnt` : ""}
                  </span>
                  <small>Beträge inkl. Mehrwertsteuer – so viel müssen Ihre Kunden noch zahlen.</small>
                </div>
              </section>
            </div>

            <section className={`bi2-card bi2-advice ${calc.advice.level}`}>
              <div className="bi2-advice-head">
                <h3>Automatische Einschätzung</h3>
                <span className={`bi2-status ${calc.advice.level}`}>
                  {calc.advice.level === "green" ? "🟢 Gesund" : calc.advice.level === "yellow" ? "🟡 Aufmerksamkeit empfohlen" : "🔴 Handlungsbedarf"}
                </span>
              </div>
              <ul>
                {calc.advice.hints.map((h, i) => (
                  <li key={i} className={h.level}>
                    {h.text}
                  </li>
                ))}
              </ul>
              <p className="bi2-small">
                Feste Rechenregeln, keine KI und keine Steuer- oder Unternehmensberatung. Deckungsbeitrag = Umsatz minus Lohn, Material und Fremdleistungen – Gemeinkosten (Miete,
                Fahrzeuge, Versicherungen, Unternehmerlohn) sind noch nicht abgezogen.
              </p>
            </section>

            <h3 className="bi2-h">Genauer ansehen</h3>
            <div className="bi2-tiles">
              <Tile icon={Users} title="Kundenanalyse" text="Umsatz je Kunde, Top-Kunden, offene Beträge" onClick={() => onOpen("customers")} />
              <Tile icon={TrendingUp} title="Auftragsanalyse" text="Umsatz, Kosten und Deckungsbeitrag je Auftrag" onClick={() => onOpen("orders")} />
              <Tile icon={Clock} title="Arbeitsstunden" text="Stunden und Lohnkosten je Mitarbeiter und Auftrag" onClick={() => onOpen("time")} />
              <Tile icon={Package} title="Materialanalyse" text="Verbrauch und Materialkosten" onClick={() => onOpen("material")} />
              <Tile icon={Trophy} title="Leistungsmanagement" text="Mitarbeiter-Ranking, Bewertungen, Leistungs- und Bonusregeln" onClick={() => onOpen("performance")} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Verhältnis brutto/netto aus den vorhandenen Rechnungen (für den Vergleich offene Rechnungen ↔ Monatsumsatz) */
function taxFactor(inv: InvoiceRow[]) {
  let net = 0;
  let gross = 0;
  for (const i of inv) {
    const g = Number(i.total_amount || 0);
    const n = i.subtotal != null ? Number(i.subtotal) : g;
    if (g > 0 && n > 0) {
      gross += g;
      net += n;
    }
  }
  return net > 0 ? gross / net : 1;
}

const pctOf = (part: number, whole: number) => (whole > 0 ? `${pct1((part / whole) * 100)} % vom Umsatz` : "–");

function Kpi({ label, value, sub, delta, tone }: { label: string; value: string; sub?: string; delta?: number | null; tone?: "green" | "yellow" | "red" }) {
  return (
    <div className={`bi2-kpi${tone ? ` ${tone}` : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>
        {sub}
        {delta != null && (
          <em className={delta >= 0 ? "up" : "down"}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)} %
          </em>
        )}
      </small>
    </div>
  );
}

function Bars({ months, money }: { months: { key: string; label: string; revenue: number }[]; money: (n: number) => string }) {
  const max = Math.max(...months.map((m) => m.revenue), 0);
  if (max <= 0) return <p className="bi2-muted">In den letzten 12 Monaten gibt es noch keine Rechnungen.</p>;
  return (
    <div className="bi2-bars" role="img" aria-label="Umsatz der letzten 12 Monate">
      {months.map((m, i) => (
        <div key={m.key} className={`bi2-bar${i === months.length - 1 ? " now" : ""}`} title={`${m.label}: ${money(m.revenue)}`}>
          <div className="bi2-bar-track">
            <div style={{ height: `${Math.max((m.revenue / max) * 100, m.revenue > 0 ? 2 : 0)}%` }} />
          </div>
          <span>{m.label}</span>
        </div>
      ))}
    </div>
  );
}

function Tile({ icon: Icon, title, text, onClick }: { icon: LucideIcon; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" className="bi2-tile" onClick={onClick}>
      <Icon size={22} aria-hidden="true" />
      <span>
        <b>{title}</b>
        <small>{text}</small>
      </span>
    </button>
  );
}
