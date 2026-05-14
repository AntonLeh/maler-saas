import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Tenant = {
  id: number;
  company_name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  vat_number: string | null;
  status: string;
  current_plan_id: number | null;
  created_at: string;
};

type Plan = {
  id: number;
  name: string;
  code: string;
};

type Subscription = {
  id: number;
  tenant_id: number;
  plan: "starter" | "professional" | "business" | "enterprise" | string;
  status: string;
  max_users: number;
  storage_limit_gb: number;
  image_limit: number;
  features: Record<string, any>;
  billing_cycle: string;
  monthly_price: number;
  currency: string;
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  trial_ends_at?: string | null;
};

type TenantStats = {
  users: number;
  customers: number;
  orders: number;
  invoices: number;
  revenue: number;
};

type BillingEvent = {
  id: number;
  tenant_id: number;
  event_type: string;
  old_plan: string | null;
  new_plan: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

type PlatformOwnerDashboardProps = {
  onBack: () => void;
};

export default function PlatformOwnerDashboard({
  onBack,
}: PlatformOwnerDashboardProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [billingEvents, setBillingEvents] = useState<BillingEvent[]>([]);
  const [tenantStats, setTenantStats] = useState<Record<number, TenantStats>>({});
  const [loading, setLoading] = useState(true);

  const loadTenants = async () => {
    setLoading(true);

    const { data: tenantsData, error: tenantsError } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: plansData, error: plansError } = await supabase
      .from("plans")
      .select("*");

    const {
  data: subscriptionsData,
  error: subscriptionsError,
} = await supabase.rpc("owner_get_subscriptions");

const { data: billingEventsData, error: billingEventsError } =
  await supabase
    .from("billing_events")
    .select("*")
    .order("created_at", { ascending: false });

    if (
  tenantsError ||
  plansError ||
  subscriptionsError ||
  billingEventsError
) {
      console.error("Fehler beim Laden der Owner-Daten:", {
        tenantsError,
        plansError,
        subscriptionsError,
        billingEventsError
      });
      setTenants([]);
      setPlans([]);
      setSubscriptions([]);
      setTenantStats({});
      setBillingEvents([]);
      setLoading(false);

      return;
    }

    const loadedTenants = (tenantsData as Tenant[]) || [];

    setTenants(loadedTenants);
    setPlans((plansData as Plan[]) || []);
    setSubscriptions((subscriptionsData as Subscription[]) || []);
    setBillingEvents((billingEventsData as BillingEvent[]) || []);

    const statsByTenant: Record<number, TenantStats> = {};

    for (const tenant of loadedTenants) {
      const [usersResult, customersResult, ordersResult, invoicesResult] =
        await Promise.all([
          supabase
            .from("app_users")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id),

          supabase
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id),

          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id),

          supabase
            .from("invoices")
            .select("total_amount")
            .eq("tenant_id", tenant.id),
        ]);

      const invoices = invoicesResult.data || [];

      const revenue = invoices.reduce((sum, invoice: any) => {
        return sum + Number(invoice.total_amount || 0);
      }, 0);

      statsByTenant[tenant.id] = {
        users: usersResult.count || 0,
        customers: customersResult.count || 0,
        orders: ordersResult.count || 0,
        invoices: invoices.length,
        revenue,
      };
    }

    setTenantStats(statsByTenant);
    setLoading(false);
  };

  useEffect(() => {
    loadTenants();
  }, []);

const handleChangePlan = async (
  tenantId: number,
  newPlan: string
) => {
  const { error } = await supabase.rpc("upgrade_subscription", {
    p_tenant_id: tenantId,
    p_plan: newPlan,
  });

  if (error) {
    console.error("Fehler beim Ändern des Plans:", error);
    alert("Plan konnte nicht geändert werden.");
    return;
  }

  alert("Plan wurde erfolgreich geändert.");

  await loadTenants();
};

  const stats = useMemo(() => {
   const trialStartedTenantIds = new Set(
  billingEvents
    .filter((event) => event.event_type === "trial_started")
    .map((event) => event.tenant_id)
);

const convertedTenantIds = new Set(
  billingEvents
    .filter(
      (event) =>
        event.event_type === "subscription_activated" ||
        event.event_type === "payment_received"
    )
    .map((event) => event.tenant_id)
);

const convertedFromTrialCount = Array.from(
  trialStartedTenantIds
).filter((tenantId) => convertedTenantIds.has(tenantId)).length;

const trialConversionRate =
  trialStartedTenantIds.size > 0
    ? Math.round(
        (convertedFromTrialCount /
          trialStartedTenantIds.size) *
          100
      )
    : 0;
    return {
      total: tenants.length,
      trial: tenants.filter((tenant) => tenant.status === "trial").length,
      active: tenants.filter((tenant) => tenant.status === "active").length,
      blocked: tenants.filter((tenant) => tenant.status === "blocked").length,
      trialStartedCount: trialStartedTenantIds.size,
convertedFromTrialCount,
trialConversionRate,
    };
  }, [tenants, billingEvents]);

  const ownerKpis = useMemo(() => {
  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "active"
  );

  const trialSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "trialing"
  );

  const paymentRequiredSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "payment_required"
  );

  const mrr = activeSubscriptions.reduce((sum, subscription) => {
    return sum + Number(subscription.monthly_price || 0);
  }, 0);

  const starterCount = subscriptions.filter(
    (subscription) => subscription.plan === "starter"
  ).length;

  const professionalCount = subscriptions.filter(
    (subscription) => subscription.plan === "professional"
  ).length;

  const businessCount = subscriptions.filter(
    (subscription) => subscription.plan === "business"
  ).length;

  const enterpriseCount = subscriptions.filter(
    (subscription) => subscription.plan === "enterprise"
  ).length;

  const trialStartedTenantIds = new Set(
  billingEvents
    .filter((event) => event.event_type === "trial_started")
    .map((event) => event.tenant_id)
);

const convertedTenantIds = new Set(
  billingEvents
    .filter(
      (event) =>
        event.event_type === "subscription_activated" ||
        event.event_type === "payment_received"
    )
    .map((event) => event.tenant_id)
);

const convertedFromTrialCount = Array.from(
  trialStartedTenantIds
).filter((tenantId) => convertedTenantIds.has(tenantId)).length;

const trialConversionRate =
  trialStartedTenantIds.size > 0
    ? Math.round(
        (convertedFromTrialCount /
          trialStartedTenantIds.size) *
          100
      )
    : 0;

  return {
  mrr,
  activeCount: activeSubscriptions.length,
  trialCount: trialSubscriptions.length,
  paymentRequiredCount: paymentRequiredSubscriptions.length,
  starterCount,
  professionalCount,
  businessCount,
  enterpriseCount,
  trialStartedCount: trialStartedTenantIds.size,
  convertedFromTrialCount,
  trialConversionRate,
};
}, [subscriptions, billingEvents]);

  const getPlanName = (planId: number | null) => {
    if (!planId) return "-";
    const plan = plans.find((item) => item.id === planId);
    return plan?.name || `Plan ${planId}`;
  };

  const getSubscriptionForTenant = (tenantId: number) => {
  return subscriptions.find(
    (subscription) => Number(subscription.tenant_id) === Number(tenantId)
  );
};

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("de-DE");
  };

  const formatMoney = (value: number | null | undefined) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  };

const updateTenantStatus = async (tenantId: number, status: string) => {
  const { error } = await supabase
    .from("tenants")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (error) {
    alert("Status konnte nicht geändert werden.");
    console.error(error);
    return;
  }

  await loadTenants();
};

const extendTrial = async (tenantId: number) => {
  const subscription = getSubscriptionForTenant(tenantId);

  if (!subscription) {
    alert("Keine Subscription für diese Firma gefunden.");
    return;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      trial_ends_at: new Date(
        new Date(subscription.trial_ends_at || new Date()).getTime() +
          14 * 24 * 60 * 60 * 1000
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (error) {
    alert("Trial konnte nicht verlängert werden.");
    console.error(error);
    return;
  }

  await loadTenants();
};

const deleteTenantCompletely = async (tenantId: number, companyName: string) => {
  const firstConfirm = confirm(
    `Firma "${companyName}" wirklich ENDGÜLTIG löschen? Alle Daten dieser Firma werden gelöscht.`
  );

  if (!firstConfirm) return;

  const secondConfirm = confirm(
    `Letzte Warnung: Das kann nicht rückgängig gemacht werden. "${companyName}" endgültig löschen?`
  );

  if (!secondConfirm) return;

  const { error } = await supabase.rpc("delete_tenant_completely", {
    p_tenant_id: tenantId,
  });

  if (error) {
    alert("Firma konnte nicht gelöscht werden.");
    console.error(error);
    return;
  }

  await loadTenants();
};

  return (
    <section className="single-page-section">
      <div className="card form-page-card">
        <div className="page-topbar">
          <div>
            <h2>Plattform-Owner Dashboard</h2>
            <p>Übersicht über alle Firmenmandanten.</p>
          </div>

          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Zurück
          </button>
        </div>

        <section className="stats-grid stats-grid-5">
          <div className="stat-card">
            <span className="stat-label">Firmen gesamt</span>
            <strong className="stat-value">{stats.total}</strong>
          </div>

          <div className="stat-card">
            <span className="stat-label">Trial</span>
            <strong className="stat-value">{stats.trial}</strong>
          </div>

          <div className="stat-card">
            <span className="stat-label">Aktive Firmen</span>
            <strong className="stat-value">{stats.active}</strong>
          </div>

          <div className="stat-card">
            <span className="stat-label">Gesperrt</span>
            <strong className="stat-value">{stats.blocked}</strong>
          </div>
          <div className="stat-card">
  <span className="stat-label">
    Trial Conversion
  </span>

  <strong className="stat-value">
    {ownerKpis.trialConversionRate}%
  </strong>

  <div className="table-subtitle">
    {ownerKpis.convertedFromTrialCount} von{" "}
    {ownerKpis.trialStartedCount}
  </div>
</div>
        </section>
        <section
  className="stats-grid stats-grid-5"
  style={{ marginTop: "18px" }}
>
  <div className="stat-card">
    <span className="stat-label">MRR</span>

    <strong className="stat-value">
      {ownerKpis.mrr.toFixed(0)} CHF
    </strong>
  </div>

  <div className="stat-card">
    <span className="stat-label">
      Zahlende Firmen
    </span>

    <strong className="stat-value">
      {ownerKpis.activeCount}
    </strong>
  </div>

  <div className="stat-card">
    <span className="stat-label">
      Trials aktiv
    </span>

    <strong className="stat-value">
      {ownerKpis.trialCount}
    </strong>
  </div>

  <div className="stat-card">
    <span className="stat-label">
      Zahlung erforderlich
    </span>

    <strong className="stat-value">
      {ownerKpis.paymentRequiredCount}
    </strong>
  </div>

  <div className="stat-card">
    <span className="stat-label">
      Planverteilung
    </span>

    <strong
      className="stat-value"
      style={{ fontSize: "15px" }}
    >
      S {ownerKpis.starterCount} ·
      P {ownerKpis.professionalCount} ·
      B {ownerKpis.businessCount}
    </strong>
  </div>
</section>

        {loading ? (
          <p className="info-text">Firmen werden geladen...</p>
        ) : tenants.length === 0 ? (
          <div className="empty-state">
            <p>Noch keine Firmen vorhanden.</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ marginTop: "24px" }}>
            <table className="orders-table orders-table-wide">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Kontakt</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Trial bis</th>
                  <th>Nutzer</th>
                  <th>Kunden</th>
                  <th>Aufträge</th>
                  <th>Rechnungen</th>
                  <th>Firmenumsatz</th>
                  <th>Erstellt</th>
                  <th>Aktionen</th>
                </tr>
              </thead>

              <tbody>
  {tenants.map((tenant) => {
    const subscription = getSubscriptionForTenant(tenant.id);
    
    return (
      <tr key={tenant.id}>
        <td>
          <strong>{tenant.company_name}</strong>

          <div className="table-subtitle">
            {tenant.slug}
          </div>
        </td>

        <td>
          {tenant.email || "-"}

          <div className="table-subtitle">
            {tenant.phone || ""}
          </div>
        </td>

        <td>
          <span className="status-badge status-geplant">
            {tenant.status}
          </span>
        </td>

        <td>
          <select
            value={subscription?.plan || "starter"}
            onChange={(e) =>
              handleChangePlan(tenant.id, e.target.value)
            }
            style={{
              padding: "7px 10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              minWidth: "170px",
            }}
          >
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>

          <div
  style={{
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#666",
  }}
>
  Aktuell:{" "}
  {(subscription?.plan || "starter").toUpperCase()}
</div>

          <div className="table-subtitle">
            {subscription?.monthly_price
              ? `${subscription.monthly_price} ${subscription.currency}/Monat`
              : "Kein Preis hinterlegt"}
          </div>
        </td>

        <td>
          {formatDate(subscription?.trial_ends_at)}
        </td>

        <td>
          {tenantStats[tenant.id]?.users ?? 0}
        </td>

        <td>
          {tenantStats[tenant.id]?.customers ?? 0}
        </td>

        <td>
          {tenantStats[tenant.id]?.orders ?? 0}
        </td>

        <td>
          {tenantStats[tenant.id]?.invoices ?? 0}
        </td>

        <td>
          <strong>
            {formatMoney(
              tenantStats[tenant.id]?.revenue ?? 0
            )}
          </strong>
        </td>

        <td>
          {formatDate(tenant.created_at)}
        </td>

        <td>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                updateTenantStatus(tenant.id, "active")
              }
            >
              Aktivieren
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                deleteTenantCompletely(
                  tenant.id,
                  tenant.company_name
                )
              }
            >
              Löschen
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                updateTenantStatus(tenant.id, "blocked")
              }
            >
              Sperren
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => extendTrial(tenant.id)}
            >
              Trial +14 Tage
            </button>
          </div>
        </td>
      </tr>
    );
  })}
</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}