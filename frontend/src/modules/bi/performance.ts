// Leistungsmanagement: Rechenregeln (ohne React, testbar)
// Alle Punkte stehen in employee_performance: source_type 'automatic' (Regeln je Auftrag), 'manual' (Bewertung erfassen), 'customer_review' (Kundenportal).
// employee_performance_results ist nur die Zusammenfassung der automatischen Punkte je Auftrag inkl. Belohnung/Sterne.
import { inRange } from "./logic";
import type { Range } from "./logic";

export type Person = { id: number; first_name?: string | null; last_name?: string | null; role_id?: number | null; is_active?: boolean | null };
export type PerfEntry = { employee_id?: number | null; points?: number | string | null; source_type?: string | null; created_at?: string | null; order_id?: number | null };
export type PerfResult = { employee_id?: number | null; order_id?: number | null; evaluation_date?: string | null; reward_name?: string | null; stars?: number | null; reward_value?: number | string | null };
export type Review = {
  id: number;
  order_id?: number | null;
  customer_id?: number | null;
  overall_rating?: number | null;
  quality_rating?: number | null;
  punctuality_rating?: number | null;
  cleanliness_rating?: number | null;
  friendliness_rating?: number | null;
  recommendation_score?: number | null;
  comment?: string | null;
  created_at?: string | null;
};
export type ReviewEmployee = { review_id?: number | null; employee_id?: number | null; rating?: number | null; comment?: string | null };

export type RankRow = {
  id: number;
  name: string;
  points: number;
  auto: number;
  manual: number;
  customer: number;
  customerAvg: number | null;
  customerCount: number;
  rewards: { name: string; count: number; stars: number }[];
  bestStars: number;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const day = (s: string | null | undefined) => String(s ?? "").slice(0, 10);
export const personName = (p: Person) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `Mitarbeiter #${p.id}`;

export function ranking(
  d: { people: Person[]; entries: PerfEntry[]; results: PerfResult[]; reviews: Review[]; reviewEmployees: ReviewEmployee[] },
  range: Range | null,
): RankRow[] {
  const reviewDay = new Map(d.reviews.map((r) => [r.id, day(r.created_at)]));
  const entries = d.entries.filter((e) => inRange(day(e.created_at), range));
  const results = d.results.filter((r) => inRange(day(r.evaluation_date), range));
  const revEmp = d.reviewEmployees.filter((r) => inRange(reviewDay.get(Number(r.review_id)) ?? "", range));

  // Mitarbeiter und Projektleiter, die aktiv sind – plus jeder, der im Zeitraum Punkte hat
  const ids = new Set<number>([
    ...d.people.filter((p) => p.is_active !== false && [3, 4].includes(Number(p.role_id))).map((p) => p.id),
    ...entries.map((e) => Number(e.employee_id)).filter(Boolean),
  ]);
  const byId = new Map(d.people.map((p) => [p.id, p]));

  return [...ids]
    .filter((id) => byId.has(id))
    .map((id) => {
      const mine = entries.filter((e) => Number(e.employee_id) === id);
      const sum = (type: string) => mine.filter((e) => (e.source_type ?? "manual") === type).reduce((s, e) => s + num(e.points), 0);
      const auto = sum("automatic");
      const customer = sum("customer_review");
      const total = mine.reduce((s, e) => s + num(e.points), 0);
      const ratings = revEmp.filter((r) => Number(r.employee_id) === id).map((r) => num(r.rating)).filter((x) => x >= 1 && x <= 5);
      const rew = new Map<string, { name: string; count: number; stars: number }>();
      let bestStars = 0;
      for (const r of results.filter((x) => Number(x.employee_id) === id)) {
        bestStars = Math.max(bestStars, num(r.stars));
        if (!r.reward_name) continue;
        const k = r.reward_name;
        const cur = rew.get(k) ?? { name: k, count: 0, stars: num(r.stars) };
        cur.count += 1;
        rew.set(k, cur);
      }
      return {
        id,
        name: personName(byId.get(id)!),
        points: total,
        auto,
        manual: total - auto - customer,
        customer,
        customerAvg: ratings.length ? ratings.reduce((s, x) => s + x, 0) / ratings.length : null,
        customerCount: ratings.length,
        rewards: [...rew.values()].sort((a, b) => b.stars - a.stars || b.count - a.count),
        bestStars,
      };
    })
    .sort((a, b) => b.points - a.points || (b.customerAvg ?? 0) - (a.customerAvg ?? 0) || a.name.localeCompare(b.name, "de"));
}

export function reviewSummary(reviews: Review[], range: Range | null) {
  const list = reviews.filter((r) => inRange(day(r.created_at), range) && num(r.overall_rating) >= 1);
  const avg = (k: keyof Review, min = 1) => {
    const xs = list.map((r) => r[k]).filter((x): x is number => x != null && num(x) >= min).map(num);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  };
  return {
    count: list.length,
    overall: avg("overall_rating"),
    quality: avg("quality_rating"),
    punctuality: avg("punctuality_rating"),
    cleanliness: avg("cleanliness_rating"),
    friendliness: avg("friendliness_rating"),
    recommendation: avg("recommendation_score", 0),
  };
}

/** Mitarbeiter des laufenden Monats (meiste Punkte), unabhängig vom gewählten Zeitraum */
export function employeeOfMonth(d: Parameters<typeof ranking>[0], today = new Date()) {
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${from.slice(0, 8)}${String(today.getDate()).padStart(2, "0")}`;
  const top = ranking(d, { from, to })[0];
  return top && top.points > 0 ? top : null;
}

export const starsText = (n: number | null) => (n == null ? "–" : n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
