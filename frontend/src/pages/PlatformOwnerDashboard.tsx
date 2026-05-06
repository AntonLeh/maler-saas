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
  plan_id: number;
  status: string;
  trial_ends_at: string | null;
};

type TenantStats = {
  users: number;
  customers: number;
  orders: number;
  invoices: number;
  revenue: number;
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

    const { data: subscriptionsData, error: subscriptionsError } = await supabase
      .from("subscriptions")
      .select("*");

    if (tenantsError || plansError || subscriptionsError) {
      console.error("Fehler beim Laden der Owner-Daten:", {
        tenantsError,
        plansError,
        subscriptionsError,
      });
      setTenants([]);
      setPlans([]);
      setSubscriptions([]);
      setTenantStats({});
      setLoading(false);
      return;
    }

    const loadedTenants = (tenantsData as Tenant[]) || [];

    setTenants(loadedTenants);
    setPlans((plansData as Plan[]) || []);
    setSubscriptions((subscriptionsData as Subscription[]) || []);

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

  const stats = useMemo(() => {
    return {
      total: tenants.length,
      trial: tenants.filter((tenant) => tenant.status === "trial").length,
      active: tenants.filter((tenant) => tenant.status === "active").length,
      blocked: tenants.filter((tenant) => tenant.status === "blocked").length,
    };
  }, [tenants]);

  const getPlanName = (planId: number | null) => {
    if (!planId) return "-";
    const plan = plans.find((item) => item.id === planId);
    return plan?.name || `Plan ${planId}`;
  };

  const getSubscriptionForTenant = (tenantId: number) => {
    return subscriptions.find((item) => item.tenant_id === tenantId) || null;
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
                        <div className="table-subtitle">{tenant.slug}</div>
                      </td>

                      <td>
                        {tenant.email || "-"}
                        <div className="table-subtitle">{tenant.phone || ""}</div>
                      </td>

                      <td>
                        <span className="status-badge status-geplant">
                          {tenant.status}
                        </span>
                      </td>

                      <td>{getPlanName(tenant.current_plan_id)}</td>

                      <td>{formatDate(subscription?.trial_ends_at)}</td>

                      <td>{tenantStats[tenant.id]?.users ?? 0}</td>

                      <td>{tenantStats[tenant.id]?.customers ?? 0}</td>

                      <td>{tenantStats[tenant.id]?.orders ?? 0}</td>

                      <td>{tenantStats[tenant.id]?.invoices ?? 0}</td>

                      <td>
                        <strong>
                          {formatMoney(tenantStats[tenant.id]?.revenue ?? 0)}
                        </strong>
                      </td>

                      <td>{formatDate(tenant.created_at)}</td>
                      <td>
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    <button
  type="button"
  className="btn btn-secondary"
  onClick={() => updateTenantStatus(tenant.id, "active")}
>
  Aktivieren
</button>

<button
  type="button"
  className="btn btn-secondary"
  onClick={() =>
    deleteTenantCompletely(tenant.id, tenant.company_name)
  }
>
  Löschen
</button>

    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => updateTenantStatus(tenant.id, "blocked")}
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