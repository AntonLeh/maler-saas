// Erfolgsmessung: Registrierungen, zahlende Kunden, Umsatz und Werbekosten je Kanal und Kampagne (reine Logik, testbar)
import type { Post } from "./logic";

export type OriginData = { source?: string; medium?: string; campaign?: string; code?: string; landing?: string; at?: string } | null;
export type TenantLite = { id: number; company_name: string; created_at: string; paying: boolean; mrr: number };
export type AdCost = { id: number; campaign: string; channel: string; period_from: string | null; period_to: string | null; amount: number; note: string | null; created_at: string };

export const SOURCE_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  video: "Kurzvideo",
  youtube: "YouTube",
  google: "Google",
  email: "E-Mail",
  direkt: "Direkt / ohne Herkunft",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

export type Light = "green" | "yellow" | "red" | "wait" | "organic";
export const LIGHT_TEXT: Record<Light, string> = {
  green: "rechnet sich",
  yellow: "auf gutem Weg",
  red: "rechnet sich nicht",
  wait: "noch zu früh",
  organic: "ohne Werbekosten",
};

export type SourceRow = { source: string; signups: number; paying: number; revenue: number; mrr: number };
export type CampaignRow = {
  campaign: string;
  title: string;
  postId: number | null;
  sources: string[];
  paid: boolean;
  signups: number;
  paying: number;
  revenue: number;
  mrr: number;
  cost: number;
  costPerSignup: number | null;
  costPerCustomer: number | null;
  paybackMonths: number | null;
  light: Light;
  tenants: { id: number; name: string; paying: boolean }[];
};

const round = (n: number) => Math.round(n * 100) / 100;
const key = (s: string) => s.trim().toLowerCase();
const DAY = 86400000;

/**
 * Ampel:
 * - keine Kosten → „ohne Werbekosten“
 * - Umsatz ≥ Kosten → grün
 * - zahlende Kunden und Rest in ≤ 6 Monaten eingespielt → gelb
 * - noch keine zahlenden Kunden, Kosten jünger als 45 Tage → „noch zu früh“
 * - sonst rot
 */
export function lightFor(cost: number, revenue: number, mrr: number, paying: number, costAgeDays: number): { light: Light; payback: number | null } {
  if (cost <= 0) return { light: "organic", payback: null };
  if (revenue >= cost) return { light: "green", payback: 0 };
  const payback = mrr > 0 ? Math.ceil((cost - revenue) / mrr) : null;
  if (paying > 0 && payback !== null && payback <= 6) return { light: "yellow", payback };
  if (paying === 0 && costAgeDays < 45) return { light: "wait", payback };
  return { light: "red", payback };
}

export function computeSuccess(input: {
  tenants: TenantLite[];
  origins: Map<number, OriginData>;
  payments: Map<number, number>;
  posts: Post[];
  costs: AdCost[];
  from?: string | null;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const list = input.tenants.filter((t) => !input.from || t.created_at.slice(0, 10) >= input.from);
  const postBy = new Map<string, Post>();
  for (const p of input.posts) {
    if (p.utm_campaign) postBy.set(key(p.utm_campaign), p);
    if (p.short_code) postBy.set(key(p.short_code), p);
  }

  const bySource = new Map<string, SourceRow>();
  const byCampaign = new Map<string, CampaignRow>();
  for (const t of list) {
    const o = input.origins.get(t.id) ?? null;
    const source = o?.source ? key(o.source) : "direkt";
    const revenue = input.payments.get(t.id) ?? 0;
    const sr = bySource.get(source) ?? { source, signups: 0, paying: 0, revenue: 0, mrr: 0 };
    sr.signups++;
    if (t.paying) {
      sr.paying++;
      sr.mrr += t.mrr;
    }
    sr.revenue += revenue;
    bySource.set(source, sr);

    if (!o?.campaign) continue;
    const post = postBy.get(key(o.campaign)) ?? (o.code ? postBy.get(key(o.code)) : undefined);
    const ck = post?.utm_campaign ? key(post.utm_campaign) : key(o.campaign);
    const cr =
      byCampaign.get(ck) ??
      ({
        campaign: ck,
        title: post?.title ?? o.campaign,
        postId: post?.id ?? null,
        sources: [],
        paid: false,
        signups: 0,
        paying: 0,
        revenue: 0,
        mrr: 0,
        cost: 0,
        costPerSignup: null,
        costPerCustomer: null,
        paybackMonths: null,
        light: "organic",
        tenants: [],
      } as CampaignRow);
    cr.signups++;
    if (!cr.sources.includes(source)) cr.sources.push(source);
    if (o.medium === "paid") cr.paid = true;
    if (t.paying) {
      cr.paying++;
      cr.mrr += t.mrr;
    }
    cr.revenue += revenue;
    cr.tenants.push({ id: t.id, name: t.company_name, paying: t.paying });
    byCampaign.set(ck, cr);
  }

  // Werbekosten den Kampagnen zuordnen (auch Kampagnen ohne Registrierung anzeigen)
  const costAge = new Map<string, number>();
  for (const c of input.costs) {
    const ck = key(c.campaign);
    const post = postBy.get(ck);
    const cr =
      byCampaign.get(ck) ??
      ({
        campaign: ck,
        title: post?.title ?? c.campaign,
        postId: post?.id ?? null,
        sources: [],
        paid: true,
        signups: 0,
        paying: 0,
        revenue: 0,
        mrr: 0,
        cost: 0,
        costPerSignup: null,
        costPerCustomer: null,
        paybackMonths: null,
        light: "organic",
        tenants: [],
      } as CampaignRow);
    cr.cost += Number(c.amount) || 0;
    cr.paid = true;
    if (!post && c.note) cr.title = c.note;
    if (!cr.sources.includes(key(c.channel))) cr.sources.push(key(c.channel));
    const start = Date.parse(`${(c.period_from ?? c.created_at).slice(0, 10)}T12:00:00`);
    costAge.set(ck, Math.min(costAge.get(ck) ?? Infinity, Number.isFinite(start) ? start : now));
    byCampaign.set(ck, cr);
  }

  const campaigns = [...byCampaign.values()].map((c) => {
    const age = costAge.has(c.campaign) ? (now - (costAge.get(c.campaign) as number)) / DAY : 999;
    const { light, payback } = lightFor(c.cost, c.revenue, c.mrr, c.paying, age);
    return {
      ...c,
      revenue: round(c.revenue),
      mrr: round(c.mrr),
      cost: round(c.cost),
      costPerSignup: c.cost > 0 && c.signups ? round(c.cost / c.signups) : null,
      costPerCustomer: c.cost > 0 && c.paying ? round(c.cost / c.paying) : null,
      paybackMonths: payback,
      light,
    };
  });
  campaigns.sort((a, b) => b.signups - a.signups || b.cost - a.cost || a.title.localeCompare(b.title, "de"));

  const sources = [...bySource.values()].map((s) => ({ ...s, revenue: round(s.revenue), mrr: round(s.mrr) })).sort((a, b) => (a.source === "direkt" ? 1 : b.source === "direkt" ? -1 : b.signups - a.signups));
  const totalCost = round(input.costs.reduce((s, c) => s + (Number(c.amount) || 0), 0));
  const tracked = list.filter((t) => input.origins.get(t.id)?.source).length;
  const trackedPaying = list.filter((t) => t.paying && input.origins.get(t.id)?.source).length;
  const trackedRevenue = round(list.filter((t) => input.origins.get(t.id)?.source).reduce((s, t) => s + (input.payments.get(t.id) ?? 0), 0));
  return {
    sources,
    campaigns,
    totals: {
      signups: list.length,
      tracked,
      trackedPaying,
      trackedRevenue,
      cost: totalCost,
      costPerCustomer: totalCost > 0 && trackedPaying ? round(totalCost / trackedPaying) : null,
    },
  };
}

/** Link für eine bezahlte Anzeige */
export function adLink(channel: string, campaign: string): string {
  const slug = campaign
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const p = new URLSearchParams({ utm_source: channel, utm_medium: "paid", utm_campaign: slug || "anzeige" });
  return `https://maler-saas.com/?${p.toString()}`;
}
export const slugOf = (campaign: string) => new URL(adLink("x", campaign)).searchParams.get("utm_campaign") ?? "";
