// Erfolgsmessung: Welche Beiträge und Anzeigen bringen Registrierungen und zahlende Kunden?
import { useEffect, useMemo, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import { loadBillingEvents, loadOverview } from "../owner/api";
import { planPrice, stateOf } from "../owner/logic";
import * as api from "./api";
import type { Post } from "./logic";
import { LIGHT_TEXT, adLink, computeSuccess, slugOf, sourceLabel } from "./success";
import type { AdCost, OriginData, TenantLite } from "./success";

type Props = { posts: Post[]; onOpenPost: (id: number) => void; onClose: () => void };
type Range = "alle" | "30" | "90" | "jahr";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });
const CHANNELS = ["facebook", "instagram", "linkedin", "google", "youtube"];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function SuccessView({ posts, onOpenPost, onClose }: Props) {
  const [data, setData] = useState<{ tenants: TenantLite[]; origins: Map<number, OriginData> | null; payments: Map<number, number>; costs: AdCost[] | null } | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>("alle");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", channel: "facebook", from: "", to: "", amount: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancel = false;
    Promise.all([loadOverview(), loadBillingEvents(), api.loadOrigins(), api.loadAdCosts()])
      .then(([tenants, events, origins, costs]) => {
        if (cancel) return;
        const payments = new Map<number, number>();
        for (const e of events) if (e.event_type === "payment_received" && e.amount) payments.set(Number(e.tenant_id), (payments.get(Number(e.tenant_id)) ?? 0) + Number(e.amount));
        const lite: TenantLite[] = tenants
          .filter((t) => !t.is_platform)
          .map((t) => {
            const k = stateOf(t).key;
            const paying = ["paying", "cancelling", "payment"].includes(k);
            return { id: t.id, company_name: t.company_name, created_at: t.created_at, paying, mrr: paying ? planPrice(t.subscription?.plan, t.subscription?.monthly_price) : 0 };
          });
        setData({ tenants: lite, origins, payments, costs });
      })
      .catch((e) => !cancel && setError((e as Error).message));
    return () => {
      cancel = true;
    };
  }, [reload]);

  const from = useMemo(() => {
    const d = new Date();
    if (range === "30") d.setDate(d.getDate() - 30);
    else if (range === "90") d.setDate(d.getDate() - 90);
    else if (range === "jahr") return `${d.getFullYear()}-01-01`;
    else return null;
    return d.toISOString().slice(0, 10);
  }, [range]);

  const result = useMemo(
    () => (data ? computeSuccess({ tenants: data.tenants, origins: data.origins ?? new Map(), payments: data.payments, posts, costs: data.costs ?? [], from }) : null),
    [data, posts, from],
  );

  const addCost = async () => {
    setMsg(null);
    const amount = Number(form.amount.replace(",", "."));
    if (!form.name.trim()) return setMsg({ ok: false, text: "Bitte einen Namen für die Kampagne eingeben." });
    if (!Number.isFinite(amount) || amount <= 0) return setMsg({ ok: false, text: "Bitte einen Betrag eingeben." });
    try {
      await api.addAdCost({ campaign: slugOf(form.name), channel: form.channel, period_from: form.from || null, period_to: form.to || null, amount, note: form.name.trim() });
      setForm({ ...form, amount: "", from: "", to: "" });
      setMsg({ ok: true, text: "Kosten gespeichert." });
      setReload((r) => r + 1);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const removeCost = async (c: AdCost) => {
    if (!(await showConfirm(`Kosten „${c.note || c.campaign}“ (${eur(c.amount)}) löschen?`, { danger: true, confirmLabel: "Löschen" }))) return;
    await api.deleteAdCost(c.id);
    setReload((r) => r + 1);
  };

  return (
    <div className="ow2-card ow2-success">
      <div className="ow2-agent-head">
        <div>
          <h3>📈 Erfolg</h3>
          <p className="ow2-small">Welche Beiträge und Anzeigen bringen Registrierungen und zahlende Kunden? Gezählt wird, wer über einen Link aus einem Beitrag oder einer Anzeige kam – ohne Cookies.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Schließen
        </button>
      </div>

      {error && <p className="ow2-msg err">{error}</p>}
      {data && data.origins === null && <p className="ow2-msg err">Für die Erfolgsmessung fehlt noch das Datenbank-Update (SQL „Erfolgsmessung“).</p>}
      {!data && !error && <p className="ow2-empty">Wird geladen …</p>}

      {result && (
        <>
          <div className="ow2-seg ow2-filter">
            {(
              [
                ["alle", "Gesamt"],
                ["30", "30 Tage"],
                ["90", "90 Tage"],
                ["jahr", "Dieses Jahr"],
              ] as [Range, string][]
            ).map(([k, l]) => (
              <button key={k} type="button" className={range === k ? "on" : ""} onClick={() => setRange(k)}>
                {l}
              </button>
            ))}
          </div>

          <div className="ow2-kpis">
            <div>
              <span>Registrierungen</span>
              <b>{result.totals.signups}</b>
              <small>davon {result.totals.tracked} über Beiträge/Anzeigen</small>
            </div>
            <div>
              <span>Zahlende Kunden daraus</span>
              <b>{result.totals.trackedPaying}</b>
              <small>Umsatz {eur(result.totals.trackedRevenue)}</small>
            </div>
            <div>
              <span>Werbekosten</span>
              <b>{eur(result.totals.cost)}</b>
              <small>{result.totals.costPerCustomer !== null ? `${eur(result.totals.costPerCustomer)} je zahlendem Kunden` : "noch keine Zuordnung"}</small>
            </div>
          </div>

          <h4 className="ow2-h4">Nach Kanal</h4>
          <div className="ow2-table-wrap">
            <table className="ow2-table">
              <thead>
                <tr>
                  <th>Kanal</th>
                  <th className="r">Registrierungen</th>
                  <th className="r">Zahlend</th>
                  <th className="r">Umwandlung</th>
                  <th className="r">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {result.sources.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ow2-muted">
                      Noch keine Registrierungen im Zeitraum.
                    </td>
                  </tr>
                ) : (
                  result.sources.map((s) => (
                    <tr key={s.source}>
                      <td>{sourceLabel(s.source)}</td>
                      <td className="r">{s.signups}</td>
                      <td className="r">{s.paying}</td>
                      <td className="r">{s.signups ? `${Math.round((s.paying / s.signups) * 100)} %` : "–"}</td>
                      <td className="r">{eur(s.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h4 className="ow2-h4">Nach Beitrag / Anzeige</h4>
          {result.campaigns.length === 0 ? (
            <p className="ow2-empty">Noch keine Registrierung über einen Beitrags-Link. Das füllt sich, sobald jemand über einen Ihrer Links kommt und sich registriert.</p>
          ) : (
            <div className="ow2-table-wrap">
              <table className="ow2-table">
                <thead>
                  <tr>
                    <th>Beitrag / Kampagne</th>
                    <th className="r">Reg.</th>
                    <th className="r">Zahlend</th>
                    <th className="r">Umsatz</th>
                    <th className="r">Kosten</th>
                    <th className="r">je Kunde</th>
                    <th>Bewertung</th>
                  </tr>
                </thead>
                <tbody>
                  {result.campaigns.map((c) => (
                    <tr key={c.campaign} onClick={() => setOpen(open === c.campaign ? null : c.campaign)} className="click">
                      <td>
                        <b>{c.title}</b>
                        <small>
                          {c.sources.map(sourceLabel).join(", ") || "–"}
                          {c.paid ? " · bezahlt" : ""}
                          {c.postId && (
                            <>
                              {" · "}
                              <button
                                type="button"
                                className="ow2-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenPost(c.postId!);
                                }}
                              >
                                Beitrag öffnen
                              </button>
                            </>
                          )}
                        </small>
                        {open === c.campaign && c.tenants.length > 0 && <small>Firmen: {c.tenants.map((t) => `${t.name}${t.paying ? " ✓" : ""}`).join(", ")}</small>}
                      </td>
                      <td className="r">{c.signups}</td>
                      <td className="r">{c.paying}</td>
                      <td className="r">{eur(c.revenue)}</td>
                      <td className="r">{c.cost ? eur(c.cost) : "–"}</td>
                      <td className="r">{c.costPerCustomer !== null ? eur(c.costPerCustomer) : "–"}</td>
                      <td>
                        <span className={`ow2-light l-${c.light}`}>
                          <i />
                          {LIGHT_TEXT[c.light]}
                          {c.light === "yellow" && c.paybackMonths ? ` (noch ~${c.paybackMonths} Mon.)` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 className="ow2-h4">Werbekosten (bezahlte Anzeigen)</h4>
          <div className="ow2-form">
            <div className="ow2-field">
              <label>Kampagne</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z. B. Winter-Anzeige Bayern" />
            </div>
            <div className="ow2-field">
              <label>Kanal</label>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {sourceLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="ow2-field">
              <label>Zeitraum (optional)</label>
              <div className="ow2-two">
                <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                <input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
              </div>
            </div>
            <div className="ow2-field">
              <label>Kosten (€, laut Werbekonto)</label>
              <input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="z. B. 150" />
            </div>
          </div>
          {form.name.trim() && (
            <p className="ow2-small">
              Link für diese Anzeige (als Ziel-URL im Werbekonto eintragen): <code className="ow2-code">{adLink(form.channel, form.name)}</code>{" "}
              <button
                type="button"
                className="ow2-link"
                onClick={async () => setMsg({ ok: true, text: (await copy(adLink(form.channel, form.name))) ? "Link kopiert." : "Bitte Link markieren und kopieren." })}
              >
                Kopieren
              </button>
            </p>
          )}
          {msg && <p className={`ow2-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
          <div className="ow2-actions left">
            <button type="button" className="btn btn-primary" onClick={addCost} disabled={data?.costs === null}>
              Kosten hinzufügen
            </button>
          </div>
          {data?.costs && data.costs.length > 0 && (
            <ul className="ow2-costs">
              {data.costs.map((c) => (
                <li key={c.id}>
                  <span>
                    <b>{c.note || c.campaign}</b> · {sourceLabel(c.channel)}
                    {c.period_from ? ` · ${new Date(`${c.period_from}T12:00:00`).toLocaleDateString("de-DE")}` : ""}
                    {c.period_to ? ` – ${new Date(`${c.period_to}T12:00:00`).toLocaleDateString("de-DE")}` : ""}
                  </span>
                  <b>{eur(c.amount)}</b>
                  <button type="button" className="ow2-link" onClick={() => removeCost(c)}>
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="ow2-note">
            So wird gezählt: Wer über einen Link aus einem Beitrag (z. B. maler-saas.com/go/…) oder einer Anzeige kommt und sich im selben Besuch registriert, wird diesem Beitrag
            zugeordnet. Es werden keine Cookies gesetzt; wer erst später direkt wiederkommt, zählt als „Direkt“. Umsatz = bisher eingegangene Zahlungen dieser Firmen.
          </p>
        </>
      )}
    </div>
  );
}
