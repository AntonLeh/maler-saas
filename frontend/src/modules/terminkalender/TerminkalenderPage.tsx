import { useCallback, useEffect, useMemo, useState } from "react";
import "./terminkalender.css";
import type {
  Appointment,
  AppointmentInput,
  CalendarCustomer,
  CalendarOrder,
  CalendarPerson,
} from "./types";
import { customerName, personName } from "./types";
import {
  addDays,
  addMonths,
  monthTitle,
  startOfMonth,
  startOfWeek,
} from "./dateUtils";
import * as api from "./api";
import { ListView, MonthView, WeekView } from "./CalendarViews";
import AppointmentForm from "./AppointmentForm";
import AppointmentDetails from "./AppointmentDetails";
import { Notice } from "./ui";

type View = "month" | "week" | "list";

type Props = {
  tenantId: number;
  currentUserId: number;
  onBack: () => void;
};

type FormState = { initial: Appointment | null; defaultStart: Date } | null;

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function rangeFor(view: View, anchor: Date): { from: Date; to: Date } {
  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  const from = startOfWeek(startOfMonth(anchor));
  return { from, to: addDays(from, 42) };
}

export default function TerminkalenderPage({ tenantId, currentUserId, onBack }: Props) {
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && window.innerWidth < 760 ? "list" : "month"
  );
  const [anchor, setAnchor] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [projectManagers, setProjectManagers] = useState<CalendarPerson[]>([]);
  const [people, setPeople] = useState<Map<number, CalendarPerson>>(new Map());
  const [customers, setCustomers] = useState<CalendarCustomer[]>([]);
  const [orders, setOrders] = useState<CalendarOrder[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(null);

  const { from, to } = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  // Stammdaten einmal laden
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.loadProjectManagers(tenantId), api.loadCustomers(tenantId), api.loadOrders(tenantId)])
      .then(([pms, cs, os]) => {
        if (cancelled) return;
        setProjectManagers(pms);
        setCustomers(cs);
        setOrders(os);
        setPeople((prev) => {
          const next = new Map(prev);
          pms.forEach((p) => next.set(p.id, p));
          return next;
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.loadAppointments(tenantId, from, to);
      setAppointments(list);
      // Namen auch für inaktive / ehemalige Projektleiter auflösen
      const missing = list
        .map((a) => a.assigned_to)
        .filter((id): id is number => id !== null && !people.has(id));
      if (missing.length > 0) {
        const extra = await api.loadPeople(missing);
        setPeople((prev) => {
          const next = new Map(prev);
          extra.forEach((p) => next.set(p.id, p));
          return next;
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // people bewusst nicht als Abhängigkeit: sonst Endlosschleife beim Nachladen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    let list = appointments;
    if (filter === "unassigned") list = list.filter((a) => !a.assigned_to);
    else if (filter !== "all") list = list.filter((a) => String(a.assigned_to) === filter);
    if (view === "list") {
      const m = anchor.getMonth();
      const y = anchor.getFullYear();
      list = list.filter((a) => {
        const d = new Date(a.starts_at);
        return d.getMonth() === m && d.getFullYear() === y;
      });
    }
    return list;
  }, [appointments, filter, view, anchor]);

  const counts = useMemo(() => {
    const c = { offen: 0, bestaetigt: 0, abgelehnt: 0, ohne: 0 };
    for (const a of appointments) {
      if (a.status === "weitergeleitet") c.offen++;
      else if (a.status === "bestaetigt") c.bestaetigt++;
      else if (a.status === "abgelehnt") c.abgelehnt++;
      if (!a.assigned_to && a.status !== "abgesagt") c.ohne++;
    }
    return c;
  }, [appointments]);

  const selected = appointments.find((a) => a.id === selectedId) ?? null;
  const customerById = (id: number | null) =>
    id === null ? undefined : customers.find((c) => String(c.id) === String(id));
  const orderById = (id: number | null) =>
    id === null ? undefined : orders.find((o) => String(o.id) === String(id));
  const nameFor = (a: Appointment) => (a.assigned_to ? personName(people.get(a.assigned_to)) : "nicht zugewiesen");

  const extraInfoFor = (a: Appointment) => {
    const parts: string[] = [];
    const c = customerById(a.customer_id);
    const o = orderById(a.order_id);
    if (c) parts.push(`Kunde: ${customerName(c)}`);
    if (o) parts.push(`Auftrag: ${o.title}`);
    if (a.description) parts.push(`Notiz: ${a.description}`);
    return parts.join("\n");
  };

  const flash = (msg: string) => {
    setError("");
    setSuccess(msg);
    window.setTimeout(() => setSuccess((s) => (s === msg ? "" : s)), 4000);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doForward = async (a: Appointment, pmId: number, note: string) => {
    const { notified } = await api.forwardAppointment(a, pmId, currentUserId, note, extraInfoFor(a));
    const name = personName(people.get(pmId));
    flash(
      notified
        ? `Termin an ${name} weitergeleitet und Nachricht gesendet.`
        : `Termin an ${name} weitergeleitet. Die Nachricht konnte nicht gesendet werden.`
    );
  };

  const handleSave = (input: AppointmentInput, forwardTo: number | null, note: string) =>
    run(async () => {
      const initial = form?.initial ?? null;
      let saved: Appointment;
      if (initial) {
        saved = await api.updateAppointment(initial.id, input);
        const changed =
          initial.starts_at !== saved.starts_at ||
          initial.ends_at !== saved.ends_at ||
          (initial.location ?? "") !== (saved.location ?? "");
        // Bereits weitergeleiteten Termin geändert -> Projektleiter neu informieren
        if (saved.assigned_to && changed && ["weitergeleitet", "bestaetigt", "abgelehnt"].includes(saved.status)) {
          await doForward(saved, saved.assigned_to, "Der Termin wurde geändert. Bitte erneut bestätigen.");
        } else {
          flash("Termin gespeichert.");
        }
      } else {
        saved = await api.createAppointment(tenantId, currentUserId, input);
        if (forwardTo) await doForward(saved, forwardTo, note);
        else flash("Termin angelegt.");
      }
      setForm(null);
      setSelectedId(null);
      await reload();
    });

  const goPrev = () => setAnchor((d) => (view === "week" ? addDays(d, -7) : addMonths(d, -1)));
  const goNext = () => setAnchor((d) => (view === "week" ? addDays(d, 7) : addMonths(d, 1)));

  const title =
    view === "week"
      ? `KW ${isoWeek(from)} · ${from.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} – ${addDays(
          from,
          6
        ).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`
      : monthTitle(anchor);

  const openCreate = (day?: Date) => {
    const start = day ? new Date(day) : new Date();
    if (day) {
      start.setHours(9, 0, 0, 0);
    } else {
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
    }
    setForm({ initial: null, defaultStart: start });
  };

  return (
    <section className="single-page-section tk-root">
      <div className="card form-page-card tk-card">
        <div className="page-topbar">
          <div>
            <h1>Terminkalender</h1>
            <p>Termine planen und an Projektleiter weiterleiten.</p>
          </div>
          <div className="tk-topbar-actions">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openCreate()}>
              + Neuer Termin
            </button>
          </div>
        </div>

        <div className="tk-stats">
          <span className="tk-stat tk-status-weitergeleitet">
            <strong>{counts.offen}</strong> warten auf Antwort
          </span>
          <span className="tk-stat tk-status-bestaetigt">
            <strong>{counts.bestaetigt}</strong> bestätigt
          </span>
          <span className="tk-stat tk-status-abgelehnt">
            <strong>{counts.abgelehnt}</strong> abgelehnt
          </span>
          <span className="tk-stat tk-status-geplant">
            <strong>{counts.ohne}</strong> ohne Projektleiter
          </span>
        </div>

        <div className="tk-toolbar">
          <div className="tk-nav">
            <button type="button" className="tk-icon-btn" onClick={goPrev} aria-label="Zurück">
              ‹
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setAnchor(new Date())}>
              Heute
            </button>
            <button type="button" className="tk-icon-btn" onClick={goNext} aria-label="Weiter">
              ›
            </button>
            <h2 className="tk-range-title">{title}</h2>
          </div>

          <div className="tk-toolbar-right">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter Projektleiter">
              <option value="all">Alle Termine</option>
              <option value="unassigned">Ohne Projektleiter</option>
              {projectManagers.map((pm) => (
                <option key={pm.id} value={String(pm.id)}>
                  {personName(pm)}
                </option>
              ))}
            </select>
            <div className="tk-segment" role="tablist" aria-label="Ansicht">
              {(
                [
                  ["month", "Monat"],
                  ["week", "Woche"],
                  ["list", "Liste"],
                ] as [View, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className={view === v ? "active" : ""}
                  onClick={() => setView(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <Notice kind="error" onClose={() => setError("")}>
            {error}
          </Notice>
        )}
        {success && <Notice kind="success">{success}</Notice>}

        <div className={`tk-view${loading ? " tk-loading" : ""}`}>
          {view === "month" && (
            <MonthView anchor={anchor} appointments={filtered} onSelect={(a) => setSelectedId(a.id)} onCreateAt={openCreate} />
          )}
          {view === "week" && (
            <WeekView
              anchor={anchor}
              appointments={filtered}
              nameFor={nameFor}
              onSelect={(a) => setSelectedId(a.id)}
              onCreateAt={openCreate}
            />
          )}
          {view === "list" && <ListView appointments={filtered} nameFor={nameFor} onSelect={(a) => setSelectedId(a.id)} />}
        </div>

        <div className="tk-legend">
          <span className="tk-badge tk-status-geplant">Geplant</span>
          <span className="tk-badge tk-status-weitergeleitet">Weitergeleitet</span>
          <span className="tk-badge tk-status-bestaetigt">Bestätigt</span>
          <span className="tk-badge tk-status-abgelehnt">Abgelehnt</span>
          <span className="tk-badge tk-status-abgesagt">Abgesagt</span>
        </div>
      </div>

      {selected && !form && (
        <AppointmentDetails
          key={selected.id + selected.updated_at}
          appointment={selected}
          customer={customerById(selected.customer_id)}
          order={orderById(selected.order_id)}
          assignee={selected.assigned_to ? people.get(selected.assigned_to) : undefined}
          projectManagers={projectManagers}
          busy={busy}
          onClose={() => setSelectedId(null)}
          onEdit={() => setForm({ initial: selected, defaultStart: new Date(selected.starts_at) })}
          onForward={(pmId, note) =>
            run(async () => {
              await doForward(selected, pmId, note);
              await reload();
            })
          }
          onCancelAppointment={() =>
            run(async () => {
              await api.setAppointmentStatus(selected.id, "abgesagt");
              if (selected.assigned_to && selected.status !== "geplant") {
                await api.notifyCancelled(selected, currentUserId);
                flash("Termin abgesagt, Projektleiter wurde benachrichtigt.");
              } else {
                flash("Termin abgesagt.");
              }
              await reload();
            })
          }
          onReactivate={() =>
            run(async () => {
              await api.setAppointmentStatus(selected.id, "geplant");
              flash("Termin wieder aktiv. Bei Bedarf erneut weiterleiten.");
              await reload();
            })
          }
          onDelete={() =>
            run(async () => {
              await api.deleteAppointment(selected.id);
              setSelectedId(null);
              flash("Termin gelöscht.");
              await reload();
            })
          }
        />
      )}

      {form && (
        <AppointmentForm
          initial={form.initial}
          defaultStart={form.defaultStart}
          customers={customers}
          orders={orders}
          projectManagers={projectManagers}
          saving={busy}
          onCancel={() => setForm(null)}
          onSave={handleSave}
        />
      )}
    </section>
  );
}
