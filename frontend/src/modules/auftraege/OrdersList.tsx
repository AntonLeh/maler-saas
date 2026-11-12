// Auftragsliste: Status-Leiste mit Zahlen, kompakte Zeilen, Team-Kürzel, Hinweise, Sortierung, Karten auf dem Handy
import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as L from "./listLogic";
import type { ListAssignment, ListOrder, Sort, Tab } from "./listLogic";
import { fmtHours, hoursState } from "./planHours";
import "./orders-list.css";

type Person = { id: number; first_name: string | null; last_name: string | null; role_id: number; is_active?: boolean | null };
type Progress = { id: number; order_id: string | number; user_id: number; note: string; created_at: string; images?: { id: number; image_url: string }[] };

type Props<O extends ListOrder> = {
  title: string;
  description: string;
  orders: O[];
  assignments: ListAssignment[];
  people: Person[];
  customerName: (id: O["customer_id"]) => string;
  progressFor: (orderId: string) => Progress[];
  materialOrderIds: string[] | null;
  initialTab: Tab;
  customerFilter: { id: string; name: string } | null;
  onClearCustomer: () => void;
  message?: string;
  canEdit: boolean;
  isAdmin: boolean;
  onEdit: (o: O) => void;
  onApprove: (id: string) => void;
  onPartialInvoice: (id: string) => void;
  onInvoice: (id: string) => void;
  renderFinishedExtra?: (o: O) => ReactNode;
  onPreviewImage: (url: string) => void;
  onBack: () => void;
  formatDateTime: (v: string) => string;
  /** Geplante und erfasste Stunden je Auftrag */
  hoursFor?: (orderId: string) => { planned: number | null; actual: number };
};

function readSort(): Sort {
  try {
    const s = localStorage.getItem("orders:sort");
    return s === "ende" || s === "kunde" || s === "neu" ? s : "start";
  } catch {
    return "start";
  }
}

export default function OrdersList<O extends ListOrder>(p: Props<O>) {
  const [tab, setTab] = useState<Tab>(p.initialTab);
  const [search, setSearch] = useState("");
  const [personId, setPersonId] = useState("");
  const [sort, setSortState] = useState<Sort>(readSort);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const today = L.todayIso();

  const setSort = (s: Sort) => {
    setSortState(s);
    try {
      localStorage.setItem("orders:sort", s);
    } catch {
      /* egal */
    }
  };

  const nameOf = useMemo(() => {
    const m = new Map(p.people.map((x) => [Number(x.id), `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim() || `Mitarbeiter #${x.id}`]));
    return (id: number) => m.get(Number(id)) ?? `Mitarbeiter #${id}`;
  }, [p.people]);

  const teamOf = useMemo(() => {
    const m = new Map<string, ListAssignment[]>();
    for (const a of p.assignments) {
      const k = String(a.order_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return (id: string | number) => m.get(String(id)) ?? [];
  }, [p.assignments]);

  // Grundmenge: Kunde, Person, Suche – danach Reiter (damit die Zahlen in der Leiste zur Suche passen)
  const base = useMemo(
    () =>
      p.orders.filter((o) => {
        if (p.customerFilter && String(o.customer_id) !== String(p.customerFilter.id)) return false;
        const team = teamOf(o.id);
        if (personId === "unassigned" && team.some((a) => a.assignment_role === "employee")) return false;
        if (personId && personId !== "unassigned" && !team.some((a) => String(a.user_id) === personId)) return false;
        return L.matches(o, search, [p.customerName(o.customer_id), ...team.map((a) => nameOf(a.user_id))]);
      }),
    [p, teamOf, personId, search, nameOf]
  );

  const counts = useMemo(() => Object.fromEntries(L.TABS.map((t) => [t.key, base.filter((o) => L.inTab(o, t.key)).length])) as Record<Tab, number>, [base]);
  const shown = useMemo(() => L.sortOrders(base.filter((o) => L.inTab(o, tab)), sort, p.customerName), [base, tab, sort, p]);

  const staff = p.people.filter((x) => x.role_id === 3 || x.role_id === 4);
  const activeStaff = staff.filter((x) => x.is_active !== false);
  const formerStaff = staff.filter((x) => x.is_active === false);

  const toggle = (id: string) =>
    setOpen((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="single-page-section ol-root">
      <div className="card">
        <div className="page-topbar">
          <div>
            <h2>{p.customerFilter ? `Aufträge von ${p.customerFilter.name}` : p.title}</h2>
            <p>{p.description}</p>
          </div>
          <div className="topbar-actions-inline">
            {p.customerFilter && (
              <button type="button" className="btn btn-secondary" onClick={p.onClearCustomer}>
                Kundenfilter zurücksetzen
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={p.onBack}>
              Zurück zum Dashboard
            </button>
          </div>
        </div>

        <div className="ol-tabs" role="tablist" aria-label="Status">
          {L.TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`${tab === t.key ? "on" : ""} t-${t.key}`} onClick={() => setTab(t.key)}>
              {t.label}
              <span>{counts[t.key]}</span>
            </button>
          ))}
        </div>

        <div className="ol-toolbar">
          <input type="search" placeholder="Suchen: Titel, Kunde, Ort, Mitarbeiter …" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Mitarbeiter">
            <option value="">Alle Mitarbeiter</option>
            <option value="unassigned">Niemand eingeteilt</option>
            <optgroup label="Team">
              {activeStaff.map((x) => (
                <option key={x.id} value={String(x.id)}>
                  {nameOf(x.id)}
                  {x.role_id === 3 ? " (PL)" : ""}
                </option>
              ))}
            </optgroup>
            {formerStaff.length > 0 && (
              <optgroup label="Ausgeschieden">
                {formerStaff.map((x) => (
                  <option key={x.id} value={String(x.id)}>
                    {nameOf(x.id)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <label className="ol-sort">
            Sortieren
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {L.SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {p.message && <p className="info-text">{p.message}</p>}

        {shown.length === 0 ? (
          <div className="ol-empty">{search || personId ? "Keine Aufträge für diese Suche." : "Keine Aufträge in diesem Bereich."}</div>
        ) : (
          <div className="ol-table-wrap">
            <table className="ol-table">
              <thead>
                <tr>
                  <th>Auftrag</th>
                  <th>Status</th>
                  <th>Team</th>
                  <th>Zeitraum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const id = String(o.id);
                  const team = teamOf(o.id);
                  const pm = team.filter((a) => a.assignment_role === "project_manager");
                  const workers = team.filter((a) => a.assignment_role === "employee" && !pm.some((x) => x.user_id === a.user_id));
                  const pmWorks = pm.some((x) => team.some((a) => a.assignment_role === "employee" && a.user_id === x.user_id));
                  const hrs = p.hoursFor?.(id);
                  const hs = hrs ? hoursState(hrs.planned, hrs.actual) : null;
                  const flags = L.flagsOf(o, team, p.materialOrderIds, today, hrs);
                  const st = L.statusInfo(o.status);
                  const progress = p.progressFor(id);
                  const isOpen = open.has(id);
                  const overdue = flags.some((f) => f.key === "overdue");
                  return (
                    <Fragment key={id}>
                      <tr className={isOpen ? "open" : ""}>
                        <td className="ol-main" data-label="">
                          <button type="button" className="ol-title" onClick={() => (p.canEdit ? p.onEdit(o) : toggle(id))}>
                            {o.title || "Auftrag"}
                          </button>
                          <small>{[p.customerName(o.customer_id), [o.address_zip, o.address_city].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "–"}</small>
                          {flags.length > 0 && (
                            <div className="ol-flags">
                              {flags.map((f) => (
                                <span key={f.key} className={`ol-flag f-${f.key}`}>
                                  {f.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td data-label="Status">
                          <span className={`ol-status ${st.cls}`}>{st.label}</span>
                        </td>
                        <td data-label="Team">
                          <div className="ol-team">
                            {pm.map((a) => (
                              <span key={`pm-${a.user_id}`} className="ol-av pm" title={`Projektleiter: ${nameOf(a.user_id)}${pmWorks ? " (arbeitet mit)" : ""}`}>
                                {L.initials(nameOf(a.user_id))}
                              </span>
                            ))}
                            {workers.slice(0, 4).map((a) => (
                              <span key={`w-${a.user_id}`} className="ol-av" title={nameOf(a.user_id)}>
                                {L.initials(nameOf(a.user_id))}
                              </span>
                            ))}
                            {workers.length > 4 && (
                              <span className="ol-av more" title={workers.slice(4).map((a) => nameOf(a.user_id)).join(", ")}>
                                +{workers.length - 4}
                              </span>
                            )}
                            {!team.length && <span className="ol-none">–</span>}
                          </div>
                        </td>
                        <td data-label="Zeitraum" className={overdue ? "ol-overdue" : ""}>
                          {L.fmtDay(o.start_date)} – {L.fmtDay(o.end_date)}
                          {hrs && hs && (
                            <div className={`ol-hours h-${hs}`} title={`${fmtHours(hrs.actual)} von ${fmtHours(hrs.planned ?? 0)} geplanten Stunden`}>
                              <i style={{ width: `${Math.min(100, (hrs.actual / (hrs.planned || 1)) * 100)}%` }} />
                              <span>
                                {fmtHours(hrs.actual)} / {fmtHours(hrs.planned ?? 0)} Std.
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="ol-actions" data-label="">
                          <button type="button" className={`ol-btn ${isOpen ? "on" : ""}`} onClick={() => toggle(id)} disabled={!progress.length} title="Fortschritt anzeigen">
                            📝 {progress.length}
                          </button>
                          {p.canEdit && (
                            <button type="button" className="ol-btn" onClick={() => p.onEdit(o)}>
                              Bearbeiten
                            </button>
                          )}
                          {o.status === "zur_pruefung" && (
                            <button type="button" className="ol-btn primary" onClick={() => p.onApprove(id)}>
                              Freigeben
                            </button>
                          )}
                          {p.isAdmin && o.status === "fertig" && (
                            <button type="button" className="ol-btn primary" onClick={() => p.onInvoice(id)}>
                              Rechnung
                            </button>
                          )}
                          {p.isAdmin && o.status !== "abgerechnet" && o.status !== "storniert" && (
                            <button type="button" className="ol-btn" onClick={() => p.onPartialInvoice(id)} title="Abschlagsrechnung erstellen">
                              Abschlag
                            </button>
                          )}
                          {p.isAdmin && o.status === "fertig" && p.renderFinishedExtra?.(o)}
                        </td>
                      </tr>
                      {isOpen && progress.length > 0 && (
                        <tr className="ol-progress-row">
                          <td colSpan={5}>
                            <div className="ol-progress">
                              {progress.map((e) => (
                                <div key={e.id} className="ol-progress-item">
                                  <div>
                                    <small>
                                      {nameOf(e.user_id)} · {p.formatDateTime(e.created_at)}
                                    </small>
                                    <p>{e.note}</p>
                                  </div>
                                  {(e.images?.length ?? 0) > 0 && (
                                    <div className="ol-thumbs">
                                      {(e.images ?? []).map((img) => (
                                        <button key={img.id} type="button" onClick={() => p.onPreviewImage(img.image_url)}>
                                          <img src={img.image_url} alt="Fortschrittsbild" loading="lazy" />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="ol-legend">
          <span className="ol-av pm">PL</span> Projektleiter · <span className="ol-av">MA</span> Mitarbeiter – Namen erscheinen beim Antippen oder Darüberfahren.
        </p>
      </div>
    </section>
  );
}
