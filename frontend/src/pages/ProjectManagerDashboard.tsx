import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { attentionList, fmtDate, todayIso, greeting, pmKpis, statusLabel, type PmAssignment, type PmOrder } from "../modules/projektleiter/logic";
import "../modules/projektleiter/pm.css";

type ProjectManagerDashboardProps = {
  userName: string;
  userEmail: string;
  companyName?: string;
  onLogout: () => void;
  onOpenOrders: () => void;
  onOpenReview: () => void;
  onOpenCreateCustomer: () => void;
  onOpenCreateSiteVisit: () => void;
  onOpenWorkOrders: () => void;
  onOpenMaterials: () => void;
  onOpenMessages: () => void;
  unreadMessages: number;
  orders: PmOrder[]; // Aufträge, die ich leite (aktiv)
  assignments: PmAssignment[];
  workOrdersCount: number; // Aufträge, bei denen ich selbst mitarbeite
  customerName: (id: string | number) => string;
  hasMaterials: boolean;
  // Terminkalender-Modul (optional)
  currentUserId?: number;
  onOpenAppointments?: () => void;
  /** Aufträge mit zugewiesenem Material (null = unbekannt, kein Hinweis) */
  materialOrderIds?: string[] | null;
  /** Auftrag direkt beim Material-Bereich öffnen */
  onOpenOrderMaterial?: (orderId: string) => void;
};

export default function ProjectManagerDashboard({
  userName,
  userEmail,
  companyName,
  onLogout,
  onOpenOrders,
  onOpenReview,
  onOpenCreateCustomer,
  onOpenCreateSiteVisit,
  onOpenWorkOrders,
  onOpenMaterials,
  onOpenMessages,
  unreadMessages,
  orders,
  assignments,
  workOrdersCount,
  customerName,
  hasMaterials,
  currentUserId,
  onOpenAppointments,
  materialOrderIds,
  onOpenOrderMaterial,
}: ProjectManagerDashboardProps) {
  const [openAppointments, setOpenAppointments] = useState(0);

  useEffect(() => {
    if (currentUserId === undefined) return;
    let cancelled = false;
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", currentUserId)
      .eq("status", "weitergeleitet")
      .then(({ count, error }) => {
        if (!cancelled && !error) setOpenAppointments(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const kpis = useMemo(() => pmKpis(orders, assignments), [orders, assignments]);
  const attention = useMemo(
    () => attentionList(orders, assignments, new Date(), 6, hasMaterials && materialOrderIds ? new Set(materialOrderIds) : null),
    [orders, assignments, hasMaterials, materialOrderIds]
  );
  const firstName = userName.split(" ")[0] || userName;

  return (
    <div className="dashboard-page pm-root">
      <div className="dashboard-container">
        <header className="pm-head">
          <div>
            <span className="pm-kicker">Projektleitung{companyName ? ` · ${companyName}` : ""}</span>
            <h1>{greeting()}, {firstName}!</h1>
            <p className="pm-muted">Deine Projekte, Aufmaße und Termine auf einen Blick.</p>
          </div>
          <div className="pm-user">
            <div>
              <strong>{userName}</strong>
              <span>{userEmail}</span>
            </div>
            <button type="button" onClick={onLogout} className="btn btn-secondary">
              Abmelden
            </button>
          </div>
        </header>

        <section className="pm-kpis" aria-label="Kennzahlen">
          <button type="button" onClick={onOpenOrders}>
            <span>Meine Projekte</span>
            <b>{kpis.active}</b>
            <small>{kpis.inProgress} in Arbeit</small>
          </button>
          <button type="button" className={kpis.review > 0 ? "warn" : ""} onClick={onOpenReview}>
            <span>Zur Prüfung</span>
            <b>{kpis.review}</b>
            <small>{kpis.review > 0 ? "warten auf Freigabe" : "nichts offen"}</small>
          </button>
          <button type="button" onClick={onOpenWorkOrders}>
            <span>Ich arbeite mit</span>
            <b>{workOrdersCount}</b>
            <small>Stechuhr & Fortschritt</small>
          </button>
          <button type="button" className={unreadMessages > 0 ? "info" : ""} onClick={onOpenMessages}>
            <span>Nachrichten</span>
            <b>{unreadMessages}</b>
            <small>ungelesen</small>
          </button>
        </section>

        <div className="pm-grid">
          <section className="pm-card">
            <h2>Schnellzugriff</h2>
            <div className="pm-actions">
              <button type="button" className="pm-action primary" onClick={onOpenCreateSiteVisit}>
                <i aria-hidden>📐</i>
                <span><b>Aufmaß anlegen</b><small>Besichtigung beim Kunden erfassen</small></span>
              </button>
              <button type="button" className="pm-action" onClick={onOpenCreateCustomer}>
                <i aria-hidden>👤</i>
                <span><b>Kunde anlegen</b><small>Neuen Kunden erfassen</small></span>
              </button>
              <button type="button" className="pm-action" onClick={onOpenOrders}>
                <i aria-hidden>📋</i>
                <span><b>Meine Projekte</b><small>Aufträge planen und Mitarbeiter einteilen</small></span>
              </button>
              <button type="button" className="pm-action" onClick={onOpenWorkOrders}>
                <i aria-hidden>⏱️</i>
                <span><b>Meine Ausführungsaufträge</b><small>Wo du selbst mitarbeitest</small></span>
              </button>
              <button type="button" className="pm-action" onClick={onOpenMaterials}>
                <i aria-hidden>🎨</i>
                <span>
                  <b>Materialverwaltung</b>
                  <small>{hasMaterials ? "Material, Lager & Lieferscheine" : "ab Tarif Professional"}</small>
                </span>
              </button>
              {onOpenAppointments && currentUserId !== undefined && (
                <button type="button" className="pm-action" onClick={onOpenAppointments}>
                  <i aria-hidden>📅</i>
                  <span><b>Meine Termine</b><small>{openAppointments > 0 ? `${openAppointments} neu weitergeleitet` : "Besichtigungen & Termine"}</small></span>
                  {openAppointments > 0 && <em>{openAppointments}</em>}
                </button>
              )}
              <button type="button" className="pm-action" onClick={onOpenMessages}>
                <i aria-hidden>💬</i>
                <span><b>Nachrichten</b><small>Mit Büro und Team</small></span>
                {unreadMessages > 0 && <em>{unreadMessages}</em>}
              </button>
            </div>
          </section>

          <section className="pm-card">
            <h2>Braucht Aufmerksamkeit</h2>
            {attention.length === 0 ? (
              <p className="pm-ok">✓ Alles im grünen Bereich – keine offenen Punkte bei deinen Projekten.</p>
            ) : (
              <ul className="pm-list">
                {attention.map((a) => (
                  <li key={`${a.reason}-${a.order.id}`}>
                    <button
                      type="button"
                      onClick={
                        a.reason === "review"
                          ? onOpenReview
                          : a.reason === "no_material" && onOpenOrderMaterial
                            ? () => onOpenOrderMaterial(String(a.order.id))
                            : onOpenOrders
                      }
                    >
                      <span className={`pm-dot r-${a.reason}`} aria-hidden />
                      <span className="pm-list-main">
                        <b>{a.order.title || "Auftrag"}</b>
                        <small>
                          {[customerName(a.order.customer_id), a.order.address_city].filter(Boolean).join(" · ")}
                        </small>
                        <small className={`pm-reason r-${a.reason}`}>{a.text}</small>
                      </span>
                      <span className="pm-status">{statusLabel(a.order.status)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {kpis.startingToday > 0 && attention.every((a) => a.reason !== "start_today") && (
              <p className="pm-muted">{kpis.startingToday} Projekt(e) starten heute.</p>
            )}
            {orders.length > 0 && (
              <p className="pm-muted pm-next">
                Nächster Start:{" "}
                {(() => {
                  const next = orders
                    .filter((o) => o.start_date && o.start_date.slice(0, 10) >= todayIso())
                    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0];
                  return next ? `${next.title} am ${fmtDate(next.start_date)}` : "kein Termin geplant";
                })()}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
