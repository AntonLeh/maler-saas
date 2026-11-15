// BI → Leistungsmanagement: Übersicht mit echten Zahlen, Ranking im Zeitraum, Kundenbewertungen (nur Chef)
import { useEffect, useMemo, useState } from "react";
import { ClipboardPen, Gift, Settings2, Star, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { periodRanges } from "./logic";
import { employeeOfMonth, personName, ranking, reviewSummary, starsText } from "./performance";
import type { PerfEntry, PerfResult, Person, Review, ReviewEmployee } from "./performance";
import { PeriodTabs } from "./shared";
import { usePeriod } from "./period";
import "./bi.css";

export type PerfTarget = "criteria" | "bonus" | "entry";
type Data = {
  people: Person[];
  entries: PerfEntry[];
  results: PerfResult[];
  reviews: Review[];
  reviewEmployees: ReviewEmployee[];
  orders: Map<number, string>;
  customers: Map<number, string>;
};

const Stars = ({ n }: { n: number | null }) =>
  n == null ? (
    <span className="bi2-muted">–</span>
  ) : (
    <span className="bi2-stars" aria-label={`${starsText(n)} von 5 Sternen`}>
      {"★★★★★".slice(0, Math.round(n))}
      <span>{"★★★★★".slice(Math.round(n))}</span>
    </span>
  );

export default function Performance({ tenantId, onBack, onOpen }: { tenantId: number; onBack: () => void; onOpen: (t: PerfTarget) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [period, choose] = usePeriod("month");
  const [view, setView] = useState<"overview" | "reviews">("overview");
  const [who, setWho] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [p, e, r, rv, re, o, c] = await Promise.all([
        supabase.from("app_users").select("id, first_name, last_name, role_id, is_active").eq("tenant_id", tenantId),
        supabase.from("employee_performance").select("employee_id, points, source_type, created_at, order_id").eq("tenant_id", tenantId),
        supabase.from("employee_performance_results").select("employee_id, order_id, evaluation_date, reward_name, stars, reward_value").eq("tenant_id", tenantId),
        supabase
          .from("customer_reviews")
          .select("id, order_id, customer_id, overall_rating, quality_rating, punctuality_rating, cleanliness_rating, friendliness_rating, recommendation_score, comment, created_at")
          .eq("tenant_id", tenantId),
        supabase.from("customer_review_employees").select("review_id, employee_id, rating, comment").eq("tenant_id", tenantId),
        supabase.from("orders").select("id, title").eq("tenant_id", tenantId),
        supabase.from("customers").select("id, first_name, last_name, company_name").eq("tenant_id", tenantId),
      ]);
      if (cancel) return;
      if (p.error || e.error) {
        setErr("Die Leistungsdaten konnten nicht geladen werden. Bitte später noch einmal versuchen.");
        return;
      }
      setData({
        people: (p.data ?? []) as Person[],
        entries: (e.data ?? []) as PerfEntry[],
        results: (r.data ?? []) as PerfResult[],
        reviews: (rv.data ?? []) as Review[],
        reviewEmployees: (re.data ?? []) as ReviewEmployee[],
        orders: new Map(((o.data ?? []) as { id: number; title: string | null }[]).map((x) => [x.id, x.title || `Auftrag #${x.id}`])),
        customers: new Map(
          ((c.data ?? []) as { id: number; first_name: string | null; last_name: string | null; company_name: string | null }[]).map((x) => [
            x.id,
            (x.company_name || `${x.first_name ?? ""} ${x.last_name ?? ""}`).trim() || `Kunde #${x.id}`,
          ]),
        ),
      });
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId]);

  const calc = useMemo(() => {
    if (!data) return null;
    const r = periodRanges(period).cur;
    const rows = ranking(data, r);
    return {
      r,
      rows,
      eom: employeeOfMonth(data),
      reviews: reviewSummary(data.reviews, r),
      rated: rows.filter((x) => x.points !== 0 || x.customerCount > 0).length,
      rewards: rows.reduce((s, x) => s + x.rewards.reduce((t, y) => t + y.count, 0), 0),
    };
  }, [data, period]);

  const reviewList = useMemo(() => {
    if (!data || !calc) return [];
    const empByReview = new Map<number, ReviewEmployee[]>();
    for (const x of data.reviewEmployees) {
      const id = Number(x.review_id);
      if (!empByReview.has(id)) empByReview.set(id, []);
      empByReview.get(id)!.push(x);
    }
    const people = new Map(data.people.map((p) => [p.id, personName(p)]));
    return data.reviews
      .filter((r) => {
        const d = String(r.created_at ?? "").slice(0, 10);
        return (!calc.r || (d >= calc.r.from && d <= calc.r.to)) && (!who || (empByReview.get(r.id) ?? []).some((e) => String(e.employee_id) === who));
      })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((r) => ({ ...r, employees: (empByReview.get(r.id) ?? []).map((e) => ({ ...e, name: people.get(Number(e.employee_id)) ?? "Mitarbeiter" })) }));
  }, [data, calc, who]);

  const header = (
    <div className="bi2-top">
      <div>
        <h2>
          {view === "reviews" ? <Star size={24} aria-hidden="true" /> : <Trophy size={24} aria-hidden="true" />} {view === "reviews" ? "Kundenbewertungen" : "Leistungsmanagement"}
        </h2>
        <p>
          {view === "reviews"
            ? "Alle Bewertungen aus dem Kundenportal – mit den Sternen für einzelne Mitarbeiter."
            : "Punkte, Kundenbewertungen und Belohnungen Ihrer Mitarbeiter – nur für Sie als Chef sichtbar."}
        </p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={view === "reviews" ? () => setView("overview") : onBack}>
        ← Zurück
      </button>
    </div>
  );

  return (
    <section className="single-page-section">
      <div className="bi2">
        {header}
        <PeriodTabs value={period} onChange={choose} />
        {err && <p className="bi2-msg">{err}</p>}
        {!calc && !err && <p className="bi2-muted">Daten werden geladen …</p>}

        {calc && view === "overview" && (
          <>
            <section className="bi2-kpis four" aria-label="Kennzahlen">
              <div className="bi2-kpi green">
                <span>Mitarbeiter des Monats</span>
                <b>{calc.eom ? calc.eom.name : "–"}</b>
                <small>{calc.eom ? `${calc.eom.points} Punkte im laufenden Monat` : "diesen Monat noch keine Punkte"}</small>
              </div>
              <div className="bi2-kpi">
                <span>Ø Kundenbewertung</span>
                <b>{calc.reviews.overall != null ? `${starsText(calc.reviews.overall)} ★` : "–"}</b>
                <small>
                  {calc.reviews.count} Bewertung{calc.reviews.count === 1 ? "" : "en"}
                </small>
              </div>
              <div className="bi2-kpi">
                <span>Bewertete Mitarbeiter</span>
                <b>{calc.rated}</b>
                <small>mit Punkten oder Kundensternen</small>
              </div>
              <div className="bi2-kpi">
                <span>Belohnungen erreicht</span>
                <b>{calc.rewards}</b>
                <small>Bonusstufen je Auftrag</small>
              </div>
            </section>

            <section className="bi2-card">
              <h3>Ranking</h3>
              {calc.rows.length === 0 ? (
                <p className="bi2-muted">Noch keine Mitarbeiter angelegt.</p>
              ) : (
                <div className="bi2-table-wrap">
                  <table className="bi2-table perf">
                    <thead>
                      <tr>
                        <th className="num">#</th>
                        <th>Mitarbeiter</th>
                        <th className="num">Punkte</th>
                        <th className="num">davon Regeln</th>
                        <th className="num">Bewertungen</th>
                        <th className="num">Kunden</th>
                        <th>Kundensterne</th>
                        <th>Belohnungen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.rows.map((r, i) => (
                        <tr key={r.id}>
                          <td className="num muted" data-label="Rang">
                            {i < 3 && r.points > 0 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                          </td>
                          <td className="name" data-label="Mitarbeiter">
                            {r.name}
                          </td>
                          <td className="num strong" data-label="Punkte">
                            {r.points}
                          </td>
                          <td className="num" data-label="davon Regeln">
                            {r.auto}
                          </td>
                          <td className="num" data-label="Bewertungen">
                            {r.manual}
                          </td>
                          <td className="num" data-label="Kunden">
                            {r.customer}
                          </td>
                          <td data-label="Kundensterne">
                            <Stars n={r.customerAvg} />
                            {r.customerCount > 0 && (
                              <small>
                                {" "}
                                {starsText(r.customerAvg)} ({r.customerCount})
                              </small>
                            )}
                          </td>
                          <td data-label="Belohnungen">
                            {r.rewards.length === 0 ? (
                              <span className="bi2-muted">–</span>
                            ) : (
                              r.rewards.map((x) => (
                                <span key={x.name} className="bi2-chip done" style={{ marginRight: 4 }}>
                                  {x.count > 1 ? `${x.count}× ` : ""}
                                  {x.name}
                                </span>
                              ))
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="bi2-small">
                Punkte = automatische Regeln je Auftrag + von Ihnen erfasste Bewertungen + Punkte aus Kundenbewertungen, jeweils im gewählten Zeitraum. Belohnungen werden wie in Ihren
                Bonusregeln je Auftrag vergeben. Leistungsbewertungen sind personenbezogene Daten – bitte nur für den vereinbarten Zweck nutzen (bei einem Betriebsrat: Mitbestimmung beachten).
              </p>
            </section>

            <h3 className="bi2-h">Einstellen und erfassen</h3>
            <div className="bi2-tiles">
              <Tile icon={Star} title="Kundenbewertungen" text="Alle Bewertungen aus dem Kundenportal" onClick={() => setView("reviews")} />
              <Tile icon={ClipboardPen} title="Bewertung erfassen" text="Punkte für einen Mitarbeiter vergeben" onClick={() => onOpen("entry")} />
              <Tile icon={Settings2} title="Leistungsregeln" text="Kriterien wie Pünktlichkeit, Qualität, Dokumentation" onClick={() => onOpen("criteria")} />
              <Tile icon={Gift} title="Bonusregeln" text="Belohnungen und Sterne nach Punktestand" onClick={() => onOpen("bonus")} />
            </div>
          </>
        )}

        {calc && view === "reviews" && (
          <>
            <section className="bi2-kpis" aria-label="Durchschnittswerte">
              <div className="bi2-kpi">
                <span>Gesamt</span>
                <b>{starsText(calc.reviews.overall)} ★</b>
                <small>
                  {calc.reviews.count} Bewertung{calc.reviews.count === 1 ? "" : "en"}
                </small>
              </div>
              <div className="bi2-kpi">
                <span>Qualität</span>
                <b>{starsText(calc.reviews.quality)}</b>
              </div>
              <div className="bi2-kpi">
                <span>Pünktlichkeit</span>
                <b>{starsText(calc.reviews.punctuality)}</b>
              </div>
              <div className="bi2-kpi">
                <span>Sauberkeit</span>
                <b>{starsText(calc.reviews.cleanliness)}</b>
              </div>
              <div className="bi2-kpi">
                <span>Weiterempfehlung</span>
                <b>{calc.reviews.recommendation != null ? `${starsText(calc.reviews.recommendation)} / 10` : "–"}</b>
              </div>
            </section>

            <section className="bi2-card">
              <div className="bi2-tablebar">
                <h3>Bewertungen</h3>
                <select className="bi2-select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Nach Mitarbeiter filtern">
                  <option value="">Alle Mitarbeiter</option>
                  {calc.rows.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {reviewList.length === 0 ? (
                <p className="bi2-muted">Im gewählten Zeitraum gibt es keine Kundenbewertungen.</p>
              ) : (
                <ul className="bi2-reviews">
                  {reviewList.map((r) => (
                    <li key={r.id}>
                      <div className="bi2-review-head">
                        <span>
                          <b>{data?.customers.get(Number(r.customer_id)) ?? "Kunde"}</b>
                          <small>
                            {data?.orders.get(Number(r.order_id)) ?? "Auftrag"} · {r.created_at ? new Date(r.created_at).toLocaleDateString("de-DE") : ""}
                          </small>
                        </span>
                        <Stars n={r.overall_rating ?? null} />
                      </div>
                      <div className="bi2-review-parts">
                        {r.quality_rating != null && <span>Qualität {r.quality_rating}/5</span>}
                        {r.punctuality_rating != null && <span>Pünktlichkeit {r.punctuality_rating}/5</span>}
                        {r.cleanliness_rating != null && <span>Sauberkeit {r.cleanliness_rating}/5</span>}
                        {r.friendliness_rating != null && <span>Freundlichkeit {r.friendliness_rating}/5</span>}
                        {r.recommendation_score != null && <span>Weiterempfehlung {r.recommendation_score}/10</span>}
                      </div>
                      {r.comment && <p className="bi2-review-text">„{r.comment}“</p>}
                      {r.employees.length > 0 && (
                        <ul className="bi2-review-emps">
                          {r.employees.map((e, i) => (
                            <li key={i}>
                              <span>{e.name}</span>
                              <Stars n={e.rating ?? null} />
                              {e.comment && <small>„{e.comment}“</small>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="bi2-small">Mitarbeiterbewertungen werden nie auf Ihrer Website veröffentlicht.</p>
            </section>
          </>
        )}
      </div>
    </section>
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
