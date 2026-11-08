// Owner-Dashboard: Berechnungen (Status, Kennzahlen, Handlungsbedarf, Diagramme) – ohne Netzwerk

import type { BillingEvent, OwnerTenant } from "./api";

export const PLAN_LABEL: Record<string, string> = { starter: "Starter", professional: "Professional", business: "Business", enterprise: "Enterprise" };
export const PLAN_ORDER = ["starter", "professional", "business", "enterprise"];

export type StateKey = "platform" | "blocked" | "payment" | "cancelling" | "paying" | "trial" | "trial_over" | "ended" | "none";
export type State = { key: StateKey; label: string; tone: "green" | "blue" | "amber" | "red" | "gray" | "purple" };

const PAYMENT_PROBLEM = ["past_due", "unpaid", "payment_required", "incomplete"];
const ENDED = ["canceled", "cancelled", "expired", "incomplete_expired"];
const day = 86400000;

export const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("de-DE") : "–");
export const fmtMoney = (v: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
export const daysUntil = (v: string | null | undefined, now = Date.now()) => (v ? Math.ceil((new Date(v).getTime() - now) / day) : null);

export function relative(v: string | null | undefined, now = Date.now()): string {
  if (!v) return "nie";
  const d = Math.floor((now - new Date(v).getTime()) / day);
  if (d <= 0) return "heute";
  if (d === 1) return "gestern";
  if (d < 30) return `vor ${d} Tagen`;
  if (d < 365) return `vor ${Math.floor(d / 30)} Mon.`;
  return `vor ${Math.floor(d / 365)} J.`;
}

export function stateOf(t: OwnerTenant, now = Date.now()): State {
  const s = t.subscription;
  if (t.is_platform) return { key: "platform", label: "Plattform", tone: "purple" };
  if (t.status === "blocked") return { key: "blocked", label: "Gesperrt", tone: "red" };
  if (!s) return { key: "none", label: "Ohne Abo", tone: "gray" };
  if (PAYMENT_PROBLEM.includes(s.status)) return { key: "payment", label: "Zahlung offen", tone: "red" };
  if (s.status === "active" && s.cancel_at_period_end) return { key: "cancelling", label: `Gekündigt zum ${fmtDate(s.cancel_at || s.expires_at)}`, tone: "amber" };
  if (s.status === "active") return { key: "paying", label: "Zahlend", tone: "green" };
  if (s.status === "trialing") {
    if (!s.has_stripe && s.trial_ends_at && new Date(s.trial_ends_at).getTime() < now) return { key: "trial_over", label: "Test abgelaufen", tone: "gray" };
    return { key: "trial", label: s.trial_ends_at ? `Test bis ${fmtDate(s.trial_ends_at)}` : "Testphase", tone: "blue" };
  }
  if (ENDED.includes(s.status)) return { key: "ended", label: "Beendet", tone: "gray" };
  return { key: "none", label: s.status, tone: "gray" };
}

export function kpis(tenants: OwnerTenant[], now = Date.now()) {
  const list = tenants.filter((t) => !t.is_platform);
  const states = list.map((t) => ({ t, s: stateOf(t, now) }));
  const paying = states.filter((x) => ["paying", "cancelling", "payment"].includes(x.s.key));
  const mrr = paying.reduce((sum, x) => sum + Number(x.t.subscription?.monthly_price || 0), 0);
  const trials = states.filter((x) => x.s.key === "trial").length;
  // Umwandlung: zahlend (auch gekündigt/Zahlung offen) im Verhältnis zu allen, deren Testphase vorbei ist
  const decided = states.filter((x) => x.s.key !== "trial" && x.s.key !== "none").length;
  const conversion = decided ? Math.round((paying.length / decided) * 100) : 0;
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const cancellations = states.filter((x) => {
    const s = x.t.subscription;
    if (!s) return false;
    if (x.s.key === "cancelling") return true;
    return ENDED.includes(s.status) && s.has_stripe && s.expires_at != null && new Date(s.expires_at).getTime() >= monthStart;
  }).length;
  const plans: Record<string, number> = { starter: 0, professional: 0, business: 0, enterprise: 0 };
  for (const x of paying) {
    const p = x.t.subscription?.plan ?? "";
    if (p in plans) plans[p]++;
  }
  return { mrr, arr: mrr * 12, paying: paying.length, trials, conversion, decided, cancellations, plans, total: list.length };
}

export type Todo = { tenant: OwnerTenant; tone: "red" | "amber" | "blue"; title: string; text: string };

export function todos(tenants: OwnerTenant[], now = Date.now()): Todo[] {
  const out: Todo[] = [];
  for (const t of tenants) {
    if (t.is_platform) continue;
    const st = stateOf(t, now);
    const s = t.subscription;
    if (st.key === "payment") out.push({ tenant: t, tone: "red", title: "Zahlung offen", text: "Die letzte Zahlung ist fehlgeschlagen – Kunde kontaktieren." });
    if (st.key === "cancelling") out.push({ tenant: t, tone: "amber", title: "Gekündigt", text: `Abo endet am ${fmtDate(s?.cancel_at || s?.expires_at)}. Nach dem Grund fragen?` });
    if (st.key === "trial") {
      const left = daysUntil(s?.trial_ends_at, now);
      if (left !== null && left <= 3) out.push({ tenant: t, tone: "amber", title: left <= 0 ? "Testphase endet heute" : `Testphase endet in ${left} Tag${left === 1 ? "" : "en"}`, text: "Noch kein Abo gebucht – jetzt nachfassen." });
      const age = Math.floor((now - new Date(t.created_at).getTime()) / day);
      if (age >= 7 && t.customers === 0 && t.orders === 0) out.push({ tenant: t, tone: "blue", title: "Test ohne Nutzung", text: `Seit ${age} Tagen registriert, noch keine Kunden oder Aufträge angelegt. Hilfe anbieten?` });
    }
  }
  const rank = { red: 0, amber: 1, blue: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

/** letzte 12 Monate als Schlüssel JJJJ-MM */
export function last12Months(now = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("de-DE", { month: "short" }).replace(".", "") });
  }
  return out;
}
const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function revenueByMonth(events: BillingEvent[], now = new Date()) {
  const months = last12Months(now);
  const sums: Record<string, number> = {};
  for (const e of events) if (e.event_type === "payment_received" && e.amount) sums[monthKey(e.created_at)] = (sums[monthKey(e.created_at)] ?? 0) + Number(e.amount);
  return months.map((m) => ({ ...m, value: Math.round((sums[m.key] ?? 0) * 100) / 100 }));
}

export function signupsByMonth(tenants: OwnerTenant[], now = new Date()) {
  const months = last12Months(now);
  const counts: Record<string, number> = {};
  for (const t of tenants) if (!t.is_platform) counts[monthKey(t.created_at)] = (counts[monthKey(t.created_at)] ?? 0) + 1;
  return months.map((m) => ({ ...m, value: counts[m.key] ?? 0 }));
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(tenants: OwnerTenant[]): string {
  const head = ["ID", "Firma", "E-Mail", "Telefon", "Ort", "Land", "Status", "Tarif", "Preis/Monat", "Test bis", "Registriert", "Letzte Anmeldung", "Mitarbeiter", "Kunden", "Aufträge", "Rechnungen", "Website", "AGB", "AVV"];
  const rows = tenants.map((t) => [
    t.id,
    t.company_name,
    t.email,
    t.phone,
    t.city,
    t.country,
    stateOf(t).label,
    PLAN_LABEL[t.subscription?.plan ?? ""] ?? t.subscription?.plan ?? "",
    t.subscription?.monthly_price ?? "",
    fmtDate(t.subscription?.trial_ends_at),
    fmtDate(t.created_at),
    fmtDate(t.last_sign_in),
    t.users,
    t.customers,
    t.orders,
    t.invoices,
    t.website ? (t.website.published ? "online" : "angelegt") : "",
    t.legal?.agb ?? "",
    t.legal?.avv ?? "",
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}
