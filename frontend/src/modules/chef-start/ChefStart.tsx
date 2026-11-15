// Startseite des Chefs: links das Menü mit allen Bereichen, rechts nur das, was heute wichtig ist
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  HardHat,
  Lock,
  MessageSquare,
  MessagesSquare,
  Package,
  Palmtree,
  Phone,
  Receipt,
  Settings,
  Tag,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { loadOpenCount } from "../ki-telefon/api";
import { countNewLeads } from "../website/api";
import { loadAccess } from "../community/api";
import "./chef-start.css";

export type ChefNavKey =
  | "customers"
  | "quotes"
  | "orders"
  | "invoices"
  | "calendar"
  | "employees"
  | "absences"
  | "messages"
  | "materials"
  | "books"
  | "reports"
  | "ai-phone"
  | "website"
  | "workers"
  | "community"
  | "settings"
  | "pricing-rules"
  | "billing"
  | "new-customer"
  | "new-site-visit"
  | "new-employee"
  | "images"
  | "approvals";

type BusinessEvent = {
  id: number;
  event_type: string;
  message: string;
  icon: string | null;
  severity: "info" | "success" | "warning";
  created_at: string;
};

type Props = {
  tenantId: number;
  firstName?: string | null;
  lastName?: string | null;
  currency: string;
  counts: { customers: number; orders: number; invoices: number; employees: number };
  unreadMessages: number;
  can: { createCustomers: boolean; admin: boolean; aiPhone: boolean; website: boolean; reports: boolean };
  open: (key: ChefNavKey) => void;
  /** Hinweise aus anderen Modulen (Dokumente, Urlaub) – erscheinen in „Braucht Ihre Aufmerksamkeit“ */
  attention?: ReactNode;
  // Tageswerte (wie bisher im Cockpit)
  businessEvents: BusinessEvent[];
  selectedDate: string;
  onDateChange: (d: string) => void;
  activeEmployees: number;
  openOrders: number;
  openInvoices: number;
  openReceivables: number;
  newImages: number;
  pendingApprovalOrders: number;
};

type Item = { key: ChefNavKey; label: string; icon: LucideIcon; count?: number; badge?: number; locked?: boolean };

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

export default function ChefStart(p: Props) {
  const [aiOpen, setAiOpen] = useState(0);
  const [leads, setLeads] = useState(0);
  const [appts, setAppts] = useState<number | null>(null);
  const [community, setCommunity] = useState<{ on: boolean; badge: number }>({ on: false, badge: 0 });
  const { open } = p;

  // Rückkehr von der Stripe-Bezahlseite des KI-Telefons (?ki_kauf=...) → direkt dorthin
  useEffect(() => {
    if (p.can.aiPhone && new URLSearchParams(window.location.search).has("ki_kauf")) open("ai-phone");
    // nur einmal beim Laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.can.aiPhone]);

  useEffect(() => {
    let cancel = false;
    if (p.can.aiPhone) void loadOpenCount(p.tenantId).then((n) => !cancel && setAiOpen(n)).catch(() => undefined);
    if (p.can.website) void countNewLeads(p.tenantId).then((n) => !cancel && setLeads(n)).catch(() => undefined);
    void loadAccess()
      .then((a) => !cancel && a?.enabled && setCommunity({ on: true, badge: (a.unread ?? 0) + (a.staff_pending ?? 0) + (a.mod_pending ?? 0) + (a.verify_pending ?? 0) }))
      .catch(() => undefined);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    void supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", p.tenantId)
      .neq("status", "abgesagt")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .then(({ count, error }) => !cancel && setAppts(error ? null : count ?? 0));
    return () => {
      cancel = true;
    };
  }, [p.tenantId, p.can.aiPhone, p.can.website]);

  const money = (n: number) => {
    try {
      return n.toLocaleString("de-DE", { style: "currency", currency: p.currency || "EUR" });
    } catch {
      return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }
  };

  const groups: { title: string; items: (Item | false)[] }[] = [
    {
      title: "Kunden & Aufträge",
      items: [
        { key: "customers", label: "Kunden", icon: Users, count: p.counts.customers },
        { key: "quotes", label: "Angebote", icon: FileText },
        { key: "orders", label: "Aufträge", icon: ClipboardList, count: p.counts.orders },
        { key: "invoices", label: "Rechnungen", icon: Receipt, count: p.counts.invoices },
        { key: "calendar", label: "Termine", icon: CalendarDays },
      ],
    },
    {
      title: "Team",
      items: [
        { key: "employees", label: "Mitarbeiter", icon: UsersRound, count: p.counts.employees },
        { key: "absences", label: "Urlaub & Abwesenheit", icon: Palmtree },
        { key: "messages", label: "Nachrichten", icon: MessageSquare, badge: p.unreadMessages },
      ],
    },
    {
      title: "Betrieb",
      items: [
        { key: "materials", label: "Material", icon: Package },
        p.can.admin && { key: "books", label: "Buchhaltung", icon: BookOpen },
        { key: "reports", label: "Business Intelligence", icon: BarChart3, locked: !p.can.reports },
      ],
    },
    {
      title: "Extras",
      items: [
        { key: "ai-phone", label: "KI-Telefon", icon: Phone, badge: aiOpen, locked: !p.can.aiPhone },
        { key: "website", label: "Website", icon: Globe, badge: leads, locked: !p.can.website },
        { key: "workers", label: "Fachkräfte", icon: HardHat, locked: !p.can.website },
        community.on && { key: "community", label: "MalerTreff", icon: MessagesSquare, badge: community.badge },
      ],
    },
    {
      title: "Verwaltung",
      items: [
        { key: "settings", label: "Einstellungen", icon: Settings },
        { key: "pricing-rules", label: "Preisregeln", icon: Tag },
        { key: "billing", label: "Abrechnung & Abo", icon: CreditCard },
      ],
    },
  ];

  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="cs-layout">
      <nav className="cs-menu" aria-label="Bereiche">
        {groups.map((g) => (
          <div key={g.title} className="cs-menu-group">
            <h4>{g.title}</h4>
            {g.items
              .filter((x): x is Item => !!x)
              .map((it) => {
                const Icon = it.locked ? Lock : it.icon;
                return (
                  <button key={it.key} type="button" className={`cs-menu-item${it.locked ? " locked" : ""}`} onClick={() => open(it.key)}>
                    <Icon size={18} strokeWidth={2.1} aria-hidden="true" />
                    <span>{it.label}</span>
                    {!it.locked && (it.badge ?? 0) > 0 ? (
                      <b className="cs-badge">{it.badge}</b>
                    ) : it.count != null ? (
                      <em>{it.count}</em>
                    ) : null}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="cs-main">
        <div className="cs-hello">
          <div>
            <h2>
              {greeting()}
              {name ? `, ${name}` : ""}
            </h2>
            <p>{today}</p>
          </div>
          <div className="cs-hello-actions">
            {p.can.createCustomers && (
              <button type="button" className="btn btn-success" onClick={() => open("new-customer")}>
                + Kunde
              </button>
            )}
            <button type="button" className="btn btn-success" onClick={() => open("new-site-visit")}>
              + Besichtigung
            </button>
            {p.can.admin && (
              <button type="button" className="btn btn-success" onClick={() => open("new-employee")}>
                + Mitarbeiter
              </button>
            )}
          </div>
        </div>

        <section className="cs-kpis" aria-label="Kennzahlen heute">
          <button type="button" className="cs-kpi" onClick={() => open("orders")}>
            <span>Offene Aufträge</span>
            <b>{p.openOrders}</b>
          </button>
          <button type="button" className="cs-kpi" onClick={() => open("invoices")}>
            <span>Offene Rechnungen</span>
            <b>{p.openInvoices}</b>
            {p.openReceivables > 0 && <small>{money(p.openReceivables)} offen</small>}
          </button>
          <div className="cs-kpi">
            <span>Auf Baustellen</span>
            <b>{p.activeEmployees}</b>
            <small>Mitarbeiter jetzt</small>
          </div>
          <button type="button" className="cs-kpi" onClick={() => open("calendar")}>
            <span>Termine</span>
            <b>{appts ?? "–"}</b>
            <small>nächste 7 Tage</small>
          </button>
          <button type="button" className="cs-kpi" onClick={() => open("images")}>
            <span>Neue Fotos</span>
            <b>{p.newImages}</b>
            <small>heute</small>
          </button>
        </section>

        <section className="cs-card cs-attn">
          <h3>
            <Bell size={17} aria-hidden="true" /> Braucht Ihre Aufmerksamkeit
          </h3>
          <div className="cs-attn-list">
            {p.pendingApprovalOrders > 0 && (
              <AttnRow icon="⚠️" warn onOpen={() => open("approvals")}>
                <b>{p.pendingApprovalOrders === 1 ? "1 Auftrag wartet" : `${p.pendingApprovalOrders} Aufträge warten`}</b> auf Ihre Freigabe
              </AttnRow>
            )}
            {p.can.aiPhone && aiOpen > 0 && (
              <AttnRow icon="📞" onOpen={() => open("ai-phone")}>
                <b>{aiOpen === 1 ? "1 offener Rückruf" : `${aiOpen} offene Rückrufe`}</b> vom KI-Telefon
              </AttnRow>
            )}
            {p.can.website && leads > 0 && (
              <AttnRow icon="🌐" onOpen={() => open("website")}>
                <b>{leads === 1 ? "1 neue Anfrage" : `${leads} neue Anfragen`}</b> über Ihre Website
              </AttnRow>
            )}
            {p.unreadMessages > 0 && (
              <AttnRow icon="💬" onOpen={() => open("messages")}>
                <b>{p.unreadMessages === 1 ? "1 ungelesene Nachricht" : `${p.unreadMessages} ungelesene Nachrichten`}</b>
              </AttnRow>
            )}
            {p.attention}
          </div>
        </section>

        <News events={p.businessEvents} selectedDate={p.selectedDate} onDateChange={p.onDateChange} />
      </div>
    </div>
  );
}

function AttnRow({ icon, warn, onOpen, children }: { icon: string; warn?: boolean; onOpen: () => void; children: ReactNode }) {
  return (
    <div className={`cs-attn-row${warn ? " warn" : ""}`}>
      <span className="cs-attn-ic" aria-hidden="true">
        {icon}
      </span>
      <span className="cs-attn-text">{children}</span>
      <button type="button" className="cs-attn-go" onClick={onOpen}>
        Öffnen →
      </button>
    </div>
  );
}

function News({ events, selectedDate, onDateChange }: { events: BusinessEvent[]; selectedDate: string; onDateChange: (d: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const isToday = selectedDate === new Date().toLocaleDateString("sv-SE");
  const shown = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const list = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (
    <section className="cs-card cs-news">
      <div className="cs-news-head">
        <h3>Neuigkeiten</h3>
        <span className="cs-news-date">
          <button
            type="button"
            onClick={() => {
              const i = ref.current;
              if (!i) return;
              if (typeof i.showPicker === "function") i.showPicker();
              else i.click();
            }}
          >
            📅 {shown}
          </button>
          <input ref={ref} type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} aria-label="Datum für Neuigkeiten auswählen" />
        </span>
      </div>
      {list.length === 0 ? (
        <div className="cs-news-empty">{isToday ? "Heute noch keine Ereignisse." : `Am ${shown} gab es keine Ereignisse.`}</div>
      ) : (
        <ul className="cs-news-list">
          {list.map((e) => (
            <li key={e.id} className={e.severity === "warning" ? "warn" : ""}>
              <time>{new Date(e.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</time>
              <span aria-hidden="true">{e.icon || "📢"}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
