// Auftrag: Stunden (inkl. nachgetragene), Fremdleistungen und Kosten nach Art
import { useCallback, useEffect, useMemo, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import {
  costSplit,
  dayOf,
  fmtH,
  fmtMoney,
  GROUP_LABELS,
  groupOf,
  hm,
  nameOf,
  netMinutes,
  typeOf,
  ymd,
} from "./logic";
import type { Entry, ExternalCost, Group, Person } from "./logic";
import ManualTimeDialog from "./ManualTimeDialog";
import "./st.css";

type Props = {
  tenantId: number;
  orderId: number;
  orderTitle: string;
  currentUserId: number;
  roleId: number;
  currencySymbol: string;
};

export default function OrderCostsSection({
  tenantId,
  orderId,
  orderTitle,
  currentUserId,
  roleId,
  currencySymbol: cur,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [external, setExternal] = useState<ExternalCost[]>([]);
  const [dialog, setDialog] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState<{
    subUserId: string;
    description: string;
    amount: string;
    invoiceNo: string;
    invoiceDate: string;
    rc: boolean;
  } | null>(null);
  const isAdmin = roleId === 2;
  const money = isAdmin; // Projektleiter sehen nur Stunden, keine Beträge

  const load = useCallback(async () => {
    const [e, p, x] = await Promise.all([
      api.loadEntries(tenantId, { orderId }).catch(() => []),
      api.loadPeople(tenantId).catch(() => []),
      money
        ? api.loadExternalCosts(tenantId, { orderId })
        : Promise.resolve([] as ExternalCost[]),
    ]);
    setEntries(e);
    setPeople(p);
    setExternal(x);
  }, [tenantId, orderId, money]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen laden
    void load();
  }, [load]);

  const byId = useMemo(
    () => new Map(people.map((p) => [Number(p.id), p])),
    [people],
  );
  const split = useMemo(
    () => costSplit(entries, people, external),
    [entries, people, external],
  );
  const subs = people.filter((p) => typeOf(p) === "sub");
  const sorted = [...entries].sort((a, b) =>
    String(b.started_at).localeCompare(String(a.started_at)),
  );
  const visible = showAll ? sorted : sorted.slice(0, 8);

  const removeEntry = async (e: Entry) => {
    if (
      !(await showConfirm("Nachgetragenen Eintrag löschen?", {
        danger: true,
        confirmLabel: "Löschen",
      }))
    )
      return;
    try {
      await api.deleteManualEntry(e.id);
      await load();
    } catch (x) {
      setMsg({ text: (x as Error).message, ok: false });
    }
  };

  const saveExternal = async () => {
    if (!form) return;
    const amount = Number(form.amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0)
      return setMsg({
        text: "Bitte einen Betrag (netto) eintragen.",
        ok: false,
      });
    try {
      await api.addExternalCost({
        tenantId,
        orderId,
        createdBy: currentUserId,
        subUserId: form.subUserId ? Number(form.subUserId) : null,
        description: form.description,
        amount,
        invoiceNo: form.invoiceNo,
        invoiceDate: form.invoiceDate,
        reverseCharge: form.rc,
      });
      setForm(null);
      setMsg({ text: "Fremdleistung gespeichert.", ok: true });
      await load();
    } catch (x) {
      setMsg({ text: (x as Error).message, ok: false });
    }
  };

  const removeExternal = async (x: ExternalCost) => {
    if (
      !(await showConfirm(
        `Fremdleistung über ${fmtMoney(Number(x.amount_net), cur)} löschen?`,
        { danger: true, confirmLabel: "Löschen" },
      ))
    )
      return;
    try {
      await api.deleteExternalCost(x.id);
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  };

  const groups: Group[] = ["own", "leih", "sub"];

  return (
    <div className="st-section">
      <div className="st-head">
        <div>
          <h3>{money ? "Stunden & Kosten" : "Stunden"}</h3>
          <p className="st-small">
            {money
              ? "Erfasste Stunden aller Personen, Rechnungen von Subunternehmern und die Kosten nach Beschäftigungsart."
              : "Erfasste Arbeitsstunden aller Personen auf diesem Auftrag."}
          </p>
        </div>
        <div className="st-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setDialog(true)}
          >
            + Stunden nachtragen
          </button>
          {money && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setForm({
                  subUserId: subs.length === 1 ? String(subs[0].id) : "",
                  description: "",
                  amount: "",
                  invoiceNo: "",
                  invoiceDate: ymd(new Date()),
                  rc: true,
                })
              }
            >
              + Fremdleistung
            </button>
          )}
        </div>
      </div>
      {msg && <p className={`st-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}

      <div className="st-split">
        {groups.map((g) => (
          <div key={g} className={split[g].minutes ? "" : "zero"}>
            <span>{GROUP_LABELS[g]}</span>
            <b>
              {money
                ? fmtMoney(split[g].cost, cur)
                : `${fmtH(split[g].minutes)} Std.`}
            </b>
            {money && <small>{fmtH(split[g].minutes)} Std.</small>}
          </div>
        ))}
        {money && (
          <>
            <div className={split.external ? "" : "zero"}>
              <span>Fremdleistungen</span>
              <b>{fmtMoney(split.external, cur)}</b>
              <small>{external.length} Rechnung(en)</small>
            </div>
            <div className="sum">
              <span>Personal + Fremdleistungen</span>
              <b>{fmtMoney(split.total, cur)}</b>
              <small>ohne Material</small>
            </div>
          </>
        )}
      </div>

      {form && (
        <div className="st-form">
          <h4>Fremdleistung (Rechnung eines Subunternehmers)</h4>
          <div className="st-grid">
            <label className="st-field">
              <span>Subunternehmer</span>
              <select
                value={form.subUserId}
                onChange={(e) =>
                  setForm({ ...form, subUserId: e.target.value })
                }
              >
                <option value="">– nicht angelegt –</option>
                {subs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {nameOf(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>Betrag netto ({cur}) *</span>
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="z. B. 1.850,00"
              />
            </label>
            <label className="st-field">
              <span>Rechnungs-Nr.</span>
              <input
                value={form.invoiceNo}
                onChange={(e) =>
                  setForm({ ...form, invoiceNo: e.target.value })
                }
              />
            </label>
            <label className="st-field">
              <span>Rechnungsdatum</span>
              <input
                type="date"
                value={form.invoiceDate}
                onChange={(e) =>
                  setForm({ ...form, invoiceDate: e.target.value })
                }
              />
            </label>
            <label className="st-field full">
              <span>Leistung</span>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="z. B. Fassade gestrichen, 240 m² (Pauschale)"
              />
            </label>
            <label className="st-check full">
              <input
                type="checkbox"
                checked={form.rc}
                onChange={(e) => setForm({ ...form, rc: e.target.checked })}
              />{" "}
              Rechnung ohne Umsatzsteuer (§ 13b – Steuer schulden Sie)
            </label>
          </div>
          <div className="st-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setForm(null)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveExternal}
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      {external.length > 0 && (
        <table className="st-table">
          <thead>
            <tr>
              <th>Rechnung</th>
              <th>Subunternehmer</th>
              <th>Leistung</th>
              <th className="r">Netto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {external.map((x) => (
              <tr key={x.id}>
                <td>
                  {x.invoice_no || "–"}
                  <small>
                    {x.invoice_date
                      ? new Date(
                          `${x.invoice_date}T12:00:00`,
                        ).toLocaleDateString("de-DE")
                      : ""}
                  </small>
                </td>
                <td>
                  {x.sub_user_id
                    ? nameOf(byId.get(Number(x.sub_user_id)))
                    : "–"}
                </td>
                <td>
                  {x.description || "–"}
                  {x.reverse_charge && <small>§ 13b</small>}
                </td>
                <td className="r">{fmtMoney(Number(x.amount_net), cur)}</td>
                <td className="r">
                  {(isAdmin || x.created_by === currentUserId) && (
                    <button
                      type="button"
                      className="st-x"
                      onClick={() => removeExternal(x)}
                      aria-label="Löschen"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sorted.length === 0 ? (
        <p className="st-empty">
          Für diesen Auftrag sind noch keine Stunden erfasst.
        </p>
      ) : (
        <table className="st-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Person</th>
              <th>Zeit</th>
              <th className="r">Stunden</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => {
              const p = byId.get(Number(e.user_id));
              return (
                <tr key={e.id}>
                  <td>
                    {new Date(`${dayOf(e)}T12:00:00`).toLocaleDateString(
                      "de-DE",
                    )}
                  </td>
                  <td>
                    {nameOf(p, e.user_id)}
                    <small>
                      {GROUP_LABELS[groupOf(p)]}
                      {e.entered_by
                        ? ` · nachgetragen von ${nameOf(byId.get(Number(e.entered_by)))}`
                        : ""}
                    </small>
                  </td>
                  <td>
                    {e.started_at && hm(e.started_at)}–
                    {e.ended_at && hm(e.ended_at)}
                    {Number(e.total_break_minutes) > 0 && (
                      <small>{e.total_break_minutes} min Pause</small>
                    )}
                  </td>
                  <td className="r">{fmtH(netMinutes(e))}</td>
                  <td className="r">
                    {e.entered_by &&
                      (isAdmin || Number(e.entered_by) === currentUserId) && (
                        <button
                          type="button"
                          className="st-x"
                          onClick={() => removeEntry(e)}
                          aria-label="Nachgetragenen Eintrag löschen"
                        >
                          ✕
                        </button>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {sorted.length > 8 && (
        <button
          type="button"
          className="st-link"
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll
            ? "Weniger anzeigen"
            : `Alle ${sorted.length} Einträge anzeigen`}
        </button>
      )}

      {dialog && (
        <ManualTimeDialog
          people={people}
          orders={[{ id: orderId, title: orderTitle }]}
          fixedOrderId={orderId}
          onSaved={async (text) => {
            setDialog(false);
            setMsg({ text, ok: true });
            await load();
          }}
          onClose={() => setDialog(false)}
        />
      )}
    </div>
  );
}
