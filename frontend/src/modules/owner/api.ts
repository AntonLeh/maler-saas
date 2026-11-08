// Owner-Dashboard: Daten laden und Aktionen (nur Plattform-Inhaber)

import { supabase, supabaseUrl } from "../../lib/supabase";

export type OwnerSub = {
  id: number;
  plan: string;
  status: string;
  monthly_price: number | null;
  currency: string | null;
  trial_ends_at: string | null;
  expires_at: string | null;
  cancel_at_period_end: boolean | null;
  cancel_at: string | null;
  has_stripe: boolean;
};

export type OwnerTenant = {
  id: number;
  company_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  status: string;
  created_at: string;
  is_platform: boolean;
  subscription: OwnerSub | null;
  users: number;
  customers: number;
  orders: number;
  invoices: number;
  last_sign_in: string | null;
  phone_balance_seconds: number | null;
  phone_seconds_month: number;
  ai_texts_month: number;
  ai_receipts_month: number;
  website: { slug: string; published: boolean; custom_domain: string | null } | null;
  legal: { agb?: string; avv?: string; datenschutz?: string } | null;
};

export type BillingEvent = {
  id: number;
  tenant_id: number;
  event_type: string;
  old_plan: string | null;
  new_plan: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

export async function loadOverview(): Promise<OwnerTenant[]> {
  const { data, error } = await supabase.rpc("owner_overview");
  if (error) {
    if (/owner_overview|does not exist|Could not find/i.test(error.message)) {
      throw new Error("Für das neue Owner-Dashboard fehlt noch ein Datenbank-Update (20261108100000_owner_uebersicht.sql).");
    }
    throw new Error(error.message);
  }
  return (data ?? []) as OwnerTenant[];
}

export async function loadBillingEvents(): Promise<BillingEvent[]> {
  const { data } = await supabase.from("billing_events").select("*").order("created_at", { ascending: false }).limit(2000);
  return (data ?? []) as BillingEvent[];
}

export async function setTenantStatus(tenantId: number, status: "active" | "blocked") {
  const { error } = await supabase.from("tenants").update({ status, updated_at: new Date().toISOString() }).eq("id", tenantId);
  if (error) throw new Error("Status konnte nicht geändert werden.");
}

export async function extendTrial(sub: OwnerSub, days: number): Promise<string> {
  const base = Math.max(Date.now(), sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0);
  const until = new Date(base + days * 86400000).toISOString();
  const { error } = await supabase.from("subscriptions").update({ trial_ends_at: until, updated_at: new Date().toISOString() }).eq("id", sub.id);
  if (error) throw new Error("Testphase konnte nicht verlängert werden.");
  return until;
}

export async function deleteTenant(tenantId: number, confirmName: string) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Bitte erneut anmelden.");
  const res = await fetch(`${supabaseUrl}/functions/v1/delete-tenant`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantId, confirm_name: confirmName }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(`${out.error || `Fehler ${res.status}`}\n\nIst die Funktion „delete-tenant“ veröffentlicht?`);
  return out as { name: string; complete: boolean; steps: { step: string; ok: boolean; detail: string }[] };
}
