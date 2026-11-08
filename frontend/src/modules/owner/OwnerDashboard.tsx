// Owner-Dashboard (nur Plattform-Inhaber): Kennzahlen, Handlungsbedarf, Diagramme, Firmenliste mit Detailansicht.

import { useCallback, useEffect, useMemo, useState } from "react";
import { showAlert, showConfirm, showPrompt } from "../../lib/dialogs";
import DeletionDeadlines from "../loeschfristen/DeletionDeadlines";
import * as api from "./api";
import type { BillingEvent, OwnerTenant } from "./api";
import { PLAN_LABEL, PLAN_ORDER, planPrice, daysUntil, fmtDate, fmtMoney, kpis, relative, revenueByMonth, signupsByMonth, stateOf, toCsv, todos } from "./logic";
import type { StateKey } from "./logic";
import "./owner.css";

type Props = { onBack: () => void };

const FILTERS: { key: "all" | StateKey | "trial_any"; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "trial", label: "Testphase" },
  { key: "paying", label: "Zahlend" },
  { key: "free", label: "Ohne Zahlung" },
  { key: "payment", label: "Zahlung offen" },
  { key: "cancelling", label: "Gekündigt" },
  { key: "trial_over", label: "Test abgelaufen" },
  { key: "ended", label: "Beendet" },
  { key: "blocked", label: "Gesperrt" },
];
type Sort = "new" | "name" | "login" | "trial";

const EVENT_LABEL: Record<string, string> = {
  trial_started: "Testphase gestartet",
  subscription_activated: "Abo abgeschlossen",
  payment_received: "Zahlung erhalten",
  subscription_canceled: "Abo beendet",
  plan_changed: "Tarif gewechselt",
};

function Bars({ data, money }: { data: { label: string; value: number }[]; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="ow-bars" role="img" aria-label={data.map((d) => `${d.label}: ${money ? fmtMoney(d.value) : d.value}`).join(", ")}>
      {data.map((d, i) => (
        <div key={i} className="ow-bar" title={`${d.label}: ${money ? fmtMoney(d.value) : d.value}`}>
          <span className="ow-bar-val">{d.value ? (money ? Math.round(d.value) : d.value) : ""}</span>
          <i style={{ height: `${Math.max(d.value ? 4 : 0, (d.value / max) * 100)}%` }} />
          <span className="ow-bar-label">{d.label}</span>
        </div>
      ))}
      {total === 0 && <p className="ow-bars-empty">Noch keine Daten</p>}
    </div>
  );
}

/** Firma endgültig löschen – mit Namens-Eingabe als Bestätigung. true = gelöscht */
async function deleteFlow(tenantId: number, name: string): Promise<boolean> {
  const typed = await showPrompt(
    `Alle Daten der Firma werden endgültig gelöscht: Kunden, Aufträge, Angebote, Rechnungen, Belege, Website, Dateien und die Zugänge aller Mitarbeiter. Telefonnummer, KI-Assistent und eigene Domain werden freigegeben, ein laufendes Abo gekündigt.\n\nDas lässt sich nicht rückgängig machen. Zur Bestätigung bitte den Firmennamen eingeben:\n${name}`,
    {
      title: `„${name}“ endgültig löschen?`,
      tone: "error",
      placeholder: name,
      confirmLabel: "Endgültig löschen",
      danger: true,
      validate: (v) => (v.replace(/\s+/g, " ").trim().toLowerCase() === name.replace(/\s+/g, " ").trim().toLowerCase() ? null : "Der Name stimmt nicht überein."),
    }
  );
  if (typed === null) return false;
  try {
    const out = await api.deleteTenant(tenantId, typed);
    const lines = out.steps.map((x) => `${x.ok ? "✓" : "✗"} ${x.step}: ${x.detail}`);
    await showAlert(`${lines.join("\n")}${out.complete ? "" : "\n\nBei den mit ✗ markierten Punkten bitte von Hand nachsehen (die Firma selbst ist gelöscht)."}`, {
      title: `„${out.name}“ wurde gelöscht`,
      tone: out.complete ? "success" : "warning",
    });
    return true;
  } catch (e) {
    await showAlert((e as Error).message, { tone: "error", title: "Firma konnte nicht gelöscht werden" });
    return false;
  }
}

function Detail({
  t,
  events,
  onClose,
  onChanged,
  onDeleted,
}: {
  t: OwnerTenant;
  events: BillingEvent[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const st = stateOf(t);
  const s = t.subscription;
  const myEvents = events.filter((e) => Number(e.tenant_id) === Number(t.id)).slice(0, 12);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.getElementById("app-dialog-root")?.childElementCount && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      await showAlert((e as Error).message, { tone: "error", title: "Das hat nicht geklappt" });
    } finally {
      setBusy(false);
    }
  };

  const extend = (days: number) =>
    run(async () => {
      if (!s) return;
      const until = await api.extendTrial(s, days);
      await onChanged();
      await showAlert(`Die Testphase läuft jetzt bis ${fmtDate(until)}.`, { tone: "success", title: "Verlängert" });
    });

  const toggleBlock = () =>
    run(async () => {
      const block = t.status !== "blocked";
      if (block && !(await showConfirm(`„${t.company_name}“ sperren? Die Mitarbeiter können sich dann nicht mehr anmelden.`, { danger: true, confirmLabel: "Sperren" }))) return;
      await api.setTenantStatus(t.id, block ? "blocked" : "active");
      await onChanged();
    });

  const remove = () =>
    run(async () => {
      if (await deleteFlow(t.id, t.company_name)) await onDeleted();
    });

  const phoneMin = (sec: number | null | undefined) => (sec == null ? "–" : `${Math.round(sec / 60)} Min.`);

  return (
    <div className="ow-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="ow-drawer" role="dialog" aria-modal="true" aria-label={t.company_name}>
        <header className="ow-drawer-head">
          <div>
            <h3>{t.company_name}</h3>
            <span className={`ow-badge ${st.tone}`}>{st.label}</span>
          </div>
          <button type="button" className="ow-x" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </header>

        <div className="ow-drawer-body">
          <section className="ow-sec">
            <h4>Kontakt</h4>
            <dl>
              <dt>E-Mail</dt>
              <dd>{t.email ? <a href={`mailto:${t.email}`}>{t.email}</a> : "–"}</dd>
              <dt>Telefon</dt>
              <dd>{t.phone ? <a href={`tel:${t.phone.replace(/\s/g, "")}`}>{t.phone}</a> : "–"}</dd>
              <dt>Ort</dt>
              <dd>{[t.city, t.country].filter(Boolean).join(", ") || "–"}</dd>
              <dt>Registriert</dt>
              <dd>{fmtDate(t.created_at)}</dd>
              <dt>Letzte Anmeldung</dt>
              <dd>
                {fmtDate(t.last_sign_in)} ({relative(t.last_sign_in)})
              </dd>
            </dl>
          </section>

          <section className="ow-sec">
            <h4>Abo</h4>
            <dl>
              <dt>Tarif</dt>
              <dd>{s ? PLAN_LABEL[s.plan] ?? s.plan : "–"}</dd>
              <dt>Preis</dt>
              <dd>{s ? `${fmtMoney(planPrice(s.plan, s.monthly_price))} / Monat (netto)` : "–"}</dd>
              <dt>Stripe</dt>
              <dd>{s?.has_stripe ? "verbunden" : "kein Stripe-Abo"}</dd>
              {s?.trial_ends_at && (
                <>
                  <dt>Testphase bis</dt>
                  <dd>{fmtDate(s.trial_ends_at)}</dd>
                </>
              )}
              {s?.cancel_at_period_end && (
                <>
                  <dt>Kündigung zum</dt>
                  <dd>{fmtDate(s.cancel_at || s.expires_at)}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="ow-sec">
            <h4>Nutzung</h4>
            <div className="ow-mini">
              <div>
                <b>{t.users}</b>
                <span>Mitarbeiter</span>
              </div>
              <div>
                <b>{t.customers}</b>
                <span>Kunden</span>
              </div>
              <div>
                <b>{t.orders}</b>
                <span>Aufträge</span>
              </div>
              <div>
                <b>{t.invoices}</b>
                <span>Rechnungen</span>
              </div>
            </div>
          </section>

          <section className="ow-sec">
            <h4>KI diesen Monat</h4>
            <dl>
              <dt>KI-Telefon</dt>
              <dd>
                {phoneMin(t.phone_seconds_month)} telefoniert · Guthaben {phoneMin(t.phone_balance_seconds)}
              </dd>
              <dt>KI-Texte / Werbung</dt>
              <dd>{t.ai_texts_month}</dd>
              <dt>Belege / Lieferscheine</dt>
              <dd>{t.ai_receipts_month}</dd>
            </dl>
          </section>

          <section className="ow-sec">
            <h4>Website &amp; Nachweise</h4>
            <dl>
              <dt>Website</dt>
              <dd>
                {t.website ? (
                  t.website.published ? (
                    <a href={t.website.custom_domain ? `https://${t.website.custom_domain}` : `https://maler-saas.com/w/${t.website.slug}`} target="_blank" rel="noopener noreferrer">
                      online ↗
                    </a>
                  ) : (
                    "angelegt, nicht veröffentlicht"
                  )
                ) : (
                  "–"
                )}
              </dd>
              <dt>AGB / AVV</dt>
              <dd>{t.legal?.agb ? `AGB ${fmtDate(t.legal.agb)} · AVV ${fmtDate(t.legal.avv ?? null)}` : "vor Einführung des Nachweises"}</dd>
            </dl>
          </section>

          {myEvents.length > 0 && (
            <section className="ow-sec">
              <h4>Verlauf</h4>
              <ul className="ow-timeline">
                {myEvents.map((e) => (
                  <li key={e.id}>
                    <span>{fmtDate(e.created_at)}</span>
                    <b>{EVENT_LABEL[e.event_type] ?? e.event_type}</b>
                    {e.amount ? <em>{fmtMoney(Number(e.amount))}</em> : e.new_plan ? <em>{PLAN_LABEL[e.new_plan] ?? e.new_plan}</em> : null}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!t.is_platform && (
            <section className="ow-sec">
              <h4>Aktionen</h4>
              <div className="ow-actions">
                {t.email && (
                  <a className="btn btn-secondary" href={`mailto:${t.email}?subject=${encodeURIComponent("MalerSaaS")}`}>
                    ✉ E-Mail schreiben
                  </a>
                )}
                {s && s.status === "trialing" && !s.has_stripe && (
                  <>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => extend(7)}>
                      Test +7 Tage
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => extend(14)}>
                      Test +14 Tage
                    </button>
                  </>
                )}
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={toggleBlock}>
                  {t.status === "blocked" ? "Entsperren" : "Sperren"}
                </button>
              </div>
              <p className="ow-note">Tarife ändern Kunden selbst über „Abrechnung &amp; Abo“ (Stripe) – so bleiben App und Abrechnung immer gleich.</p>
            </section>
          )}

          {!t.is_platform && (
            <section className="ow-sec ow-danger">
              <h4>Gefahrenzone</h4>
              <p>Löscht die Firma mit allen Daten, Dateien und Zugängen endgültig.</p>
              <button type="button" className="btn ow-btn-danger" disabled={busy} onClick={remove}>
                Firma endgültig löschen …
              </button>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function OwnerDashboard({ onBack }: Props) {
  const [tenants, setTenants] = useState<OwnerTenant[] | null>(null);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [plan, setPlan] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [openId, setOpenId] = useState<number | null>(null);
  const [deletionReload, setDeletionReload] = useState(0);

  const load = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([api.loadOverview(), api.loadBillingEvents()]);
      setTenants(t);
      setEvents(e);
      setError("");
    } catch (err) {
      setError((err as Error).message);
      setTenants([]);
    }
  }, []);

  useEffect(() => {
    // load setzt den Zustand erst nach dem Laden
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const all = useMemo(() => tenants ?? [], [tenants]);
  const k = useMemo(() => kpis(all), [all]);
  const todoList = useMemo(() => todos(all), [all]);
  const revenue = useMemo(() => revenueByMonth(events), [events]);
  const signups = useMemo(() => signupsByMonth(all), [all]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const t of all) {
      const key = stateOf(t).key;
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  }, [all]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = all.filter((t) => {
      if (filter !== "all" && stateOf(t).key !== filter) return false;
      if (plan && t.subscription?.plan !== plan) return false;
      if (!q) return true;
      return [t.company_name, t.email, t.city, t.phone].some((v) => (v ?? "").toLowerCase().includes(q));
    });
    const time = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);
    out.sort((a, b) =>
      sort === "name"
        ? a.company_name.localeCompare(b.company_name, "de")
        : sort === "login"
          ? time(b.last_sign_in) - time(a.last_sign_in)
          : sort === "trial"
            ? (time(a.subscription?.trial_ends_at) || Infinity) - (time(b.subscription?.trial_ends_at) || Infinity)
            : time(b.created_at) - time(a.created_at)
    );
    return out;
  }, [all, query, filter, plan, sort]);

  const open = all.find((t) => t.id === openId) ?? null;

  const exportCsv = () => {
    const blob = new Blob([toCsv(list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `malersaas-firmen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const planTotal = PLAN_ORDER.reduce((s, p) => s + (k.plans[p] ?? 0), 0);

  return (
    <section className="single-page-section ow-root">
      <div className="card form-page-card">
        <div className="ow-top">
          <div>
            <h2>Plattform-Übersicht</h2>
            <p>Stand {new Date().toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <div className="ow-top-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              ↻ Aktualisieren
            </button>
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!list.length}>
              CSV-Export
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        {error && <p className="ow-error">{error}</p>}

        <div className="ow-kpis">
          <div className="ow-kpi ow-kpi-main">
            <span>MRR (monatlich)</span>
            <b>{fmtMoney(k.mrr)}</b>
            <small>ARR {fmtMoney(k.arr)}</small>
          </div>
          <div className="ow-kpi">
            <span>Zahlende Firmen</span>
            <b>{k.paying}</b>
            <small>von {k.total} Firmen</small>
          </div>
          <div className="ow-kpi">
            <span>Testphasen aktiv</span>
            <b>{k.trials}</b>
            <small>ohne Kreditkarte</small>
          </div>
          <div className="ow-kpi">
            <span>Test → Abo</span>
            <b>{k.conversion} %</b>
            <small>
              {k.paying} von {k.decided} entschieden
            </small>
          </div>
          <div className="ow-kpi">
            <span>Kündigungen</span>
            <b>{k.cancellations}</b>
            <small>diesen Monat</small>
          </div>
        </div>

        <div className="ow-plans">
          <span>Tarife (zahlend)</span>
          <div className="ow-plan-bar">
            {planTotal === 0 ? (
              <i className="empty" style={{ width: "100%" }} />
            ) : (
              PLAN_ORDER.map((p) => (k.plans[p] ? <i key={p} className={p} style={{ width: `${(k.plans[p] / planTotal) * 100}%` }} title={`${PLAN_LABEL[p]}: ${k.plans[p]}`} /> : null))
            )}
          </div>
          <div className="ow-plan-legend">
            {PLAN_ORDER.map((p) => (
              <span key={p}>
                <i className={p} /> {PLAN_LABEL[p]} {k.plans[p] ?? 0}
              </span>
            ))}
          </div>
        </div>

        {todoList.length > 0 && (
          <section className="ow-panel">
            <h3>Handlungsbedarf ({todoList.length})</h3>
            <ul className="ow-todos">
              {todoList.map((td, i) => (
                <li key={i} className={td.tone}>
                  <div>
                    <b>
                      {td.tenant.company_name} – {td.title}
                    </b>
                    <span>{td.text}</span>
                  </div>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setOpenId(td.tenant.id)}>
                    Öffnen
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <DeletionDeadlines
          reloadKey={deletionReload}
          onDelete={async (id, name) => {
            if (await deleteFlow(id, name)) {
              await load();
              setDeletionReload((n) => n + 1);
            }
          }}
        />

        <div className="ow-charts">
          <section className="ow-panel">
            <h3>Abo-Einnahmen pro Monat</h3>
            <Bars data={revenue} money />
          </section>
          <section className="ow-panel">
            <h3>Neue Firmen pro Monat</h3>
            <Bars data={signups} />
          </section>
        </div>

        <section className="ow-panel">
          <div className="ow-list-head">
            <h3>Firmen</h3>
            <input type="search" placeholder="Suchen: Firma, E-Mail, Ort …" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="ow-chips">
            {FILTERS.map((f) =>
              f.key === "all" || counts[f.key] ? (
                <button key={f.key} type="button" className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>
                  {f.label} <small>{counts[f.key] ?? 0}</small>
                </button>
              ) : null
            )}
          </div>
          <div className="ow-list-tools">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Tarif">
              <option value="">Alle Tarife</option>
              {PLAN_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABEL[p]}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortierung">
              <option value="new">Neueste zuerst</option>
              <option value="name">Name A–Z</option>
              <option value="login">Zuletzt aktiv</option>
              <option value="trial">Testende zuerst</option>
            </select>
            <span className="ow-count">{list.length} Firma/Firmen</span>
          </div>

          {tenants === null ? (
            <p className="ow-muted">Wird geladen …</p>
          ) : list.length === 0 ? (
            <p className="ow-muted">Keine Firmen gefunden.</p>
          ) : (
            <div className="ow-table">
              <div className="ow-tr ow-th">
                <span>Firma</span>
                <span>Status</span>
                <span>Tarif</span>
                <span>Nutzung</span>
                <span>Zuletzt aktiv</span>
                <span />
              </div>
              {list.map((t) => {
                const st = stateOf(t);
                const left = t.subscription?.status === "trialing" ? daysUntil(t.subscription.trial_ends_at) : null;
                return (
                  <button key={t.id} type="button" className="ow-tr" onClick={() => setOpenId(t.id)}>
                    <span className="ow-firm">
                      <b>{t.company_name}</b>
                      <small>{[t.email, t.city].filter(Boolean).join(" · ") || "–"}</small>
                    </span>
                    <span>
                      <em className={`ow-badge ${st.tone}`}>{st.label}</em>
                      {left !== null && left >= 0 && left <= 3 && <small className="ow-warn"> noch {left} T.</small>}
                    </span>
                    <span className="ow-plan">
                      {t.subscription ? (
                        <>
                          {PLAN_LABEL[t.subscription.plan] ?? t.subscription.plan}
                          <small>{fmtMoney(planPrice(t.subscription.plan, t.subscription.monthly_price))} / Monat</small>
                        </>
                      ) : (
                        "–"
                      )}
                    </span>
                    <span className="ow-usage">
                      <small>
                        {t.users} MA · {t.customers} Kd · {t.orders} Auftr. · {t.invoices} Re.
                      </small>
                    </span>
                    <span>
                      <small>{relative(t.last_sign_in)}</small>
                    </span>
                    <span className="ow-chev" aria-hidden="true">
                      ›
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {open && (
        <Detail
          key={open.id}
          t={open}
          events={events}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={async () => {
            setOpenId(null);
            await load();
            setDeletionReload((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}
