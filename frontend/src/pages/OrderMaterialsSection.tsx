import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { showConfirm } from "../lib/dialogs";
import * as mapi from "../modules/material/api";
import "../modules/material/material.css";

type MaterialLite = {
  id: number;
  name: string;
  unit: string;
  stock_quantity: number;
  purchase_price: number | null;
};

type Employee = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  role_id: number;
  employment_type?: string | null;
  app_access?: boolean | null;
};

type Assignment = {
  id: number;
  material_id: number;
  assigned_to_user_id: number;
  quantity: number;
  unit: string;
  status: string;
  assigned_at: string;
};

type Props = {
  tenantId: number;
  orderId: number;
  employees: Employee[];
  currentUserId: number;
  /** Wird nach jedem Laden mit der Anzahl zugewiesener Materialien aufgerufen */
  onAssignmentsChanged?: (count: number) => void;
  /** Währung der Firma */
  currency?: string;
  /** Beträge anzeigen (nur Admin; Projektleiter sehen keine Kosten) */
  showCosts?: boolean;
};

export default function OrderMaterialsSection({
  tenantId,
  orderId,
  employees,
  currentUserId,
  onAssignmentsChanged,
  currency = "EUR",
  showCosts = true,
}: Props) {
  const [materials, setMaterials] = useState<MaterialLite[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [logs, setLogs] = useState<
    (mapi.UsageLog & { material_id?: number })[]
  >([]);
  const [team, setTeam] = useState<number[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [userId, setUserId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [booking, setBooking] = useState<{
    id: number;
    qty: string;
    action: string;
    note: string;
  } | null>(null);

  const loadData = async () => {
    const [mRes, aRes, lRes, tRes] = await Promise.all([
      supabase
        .from("materials")
        .select("id,name,unit,stock_quantity,purchase_price")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("order_material_assignments")
        .select(
          "id,material_id,assigned_to_user_id,quantity,unit,status,assigned_at",
        )
        .eq("tenant_id", tenantId)
        .eq("order_id", orderId)
        .order("assigned_at", { ascending: true }),
      supabase
        .from("material_consumption_logs")
        .select(
          "id,assignment_id,material_id,quantity,action,note,created_at,material_price_at_use",
        )
        .eq("tenant_id", tenantId)
        .eq("order_id", orderId),
      supabase
        .from("order_assignments")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("order_id", orderId),
    ]);
    if (aRes.error)
      console.error(
        "Materialzuweisungen konnten nicht geladen werden:",
        aRes.error,
      );
    const list = (aRes.data as Assignment[]) || [];
    setMaterials((mRes.data as MaterialLite[]) || []);
    setAssignments(list);
    setLogs((lRes.data as mapi.UsageLog[]) || []);
    setTeam([
      ...new Set(
        ((tRes.data as { user_id: number }[]) || []).map((r) =>
          Number(r.user_id),
        ),
      ),
    ]);
    onAssignmentsChanged?.(list.length);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, orderId]);

  const name = (id: number) => {
    const e = employees.find((x) => Number(x.id) === Number(id));
    return e
      ? `${e.first_name || ""} ${e.last_name || ""}`.trim() || "Mitarbeiter"
      : "Mitarbeiter";
  };
  const material = (id: number) => materials.find((m) => m.id === id);

  // Leiharbeiter, Subunternehmer und Personen ohne App können eine Übernahme nicht bestätigen –
  // für sie übernimmt der Projektleiter das Material selbst (und trägt die Verantwortung).
  const workers = employees.filter(
    (e) =>
      (e.role_id === 3 || e.role_id === 4) &&
      e.app_access !== false &&
      e.employment_type !== "leiharbeit" &&
      e.employment_type !== "sub",
  );
  const teamWorkers = workers.filter((e) => team.includes(Number(e.id)));
  const otherWorkers = workers.filter((e) => !team.includes(Number(e.id)));

  // Vorauswahl: einziges Teammitglied
  useEffect(() => {
    if (!userId && teamWorkers.length === 1)
      setUserId(String(teamWorkers[0].id));
  }, [teamWorkers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(
    () =>
      assignments.map((a) => {
        const own = logs.filter((l) => l.assignment_id === a.id);
        const sum = (act: string[]) =>
          own
            .filter((l) => act.includes(l.action))
            .reduce((s, l) => s + Number(l.quantity || 0), 0);
        const used = sum(["used", "damaged", "left_on_site"]);
        const returned = sum(["returned"]);
        const priceNow = material(a.material_id)?.purchase_price ?? null;
        const cost = own
          .filter((l) => l.action !== "returned")
          .reduce(
            (s, l) =>
              s +
              Number(l.quantity || 0) *
                Number(l.material_price_at_use ?? priceNow ?? 0),
            0,
          );
        return {
          a,
          used,
          returned,
          open: Number(a.quantity) - used - returned,
          cost,
          hasPrice: priceNow != null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignments, logs, materials],
  );
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);

  const selected = materialId ? material(Number(materialId)) : undefined;

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const qty = mapi.parseNum(quantity);
    if (!materialId)
      return setNotice({ text: "Bitte ein Material auswählen.", ok: false });
    if (!userId)
      return setNotice({ text: "Bitte einen Empfänger auswählen.", ok: false });
    if (!Number.isFinite(qty) || qty <= 0)
      return setNotice({
        text: "Bitte eine Menge größer als 0 eingeben.",
        ok: false,
      });
    if (selected && qty > Number(selected.stock_quantity)) {
      return setNotice({
        text: `Im Lager sind nur ${mapi.fmtQty(selected.stock_quantity)} ${selected.unit}.`,
        ok: false,
      });
    }
    setBusy(true);
    try {
      await mapi.assignToOrder(
        orderId,
        Number(materialId),
        Number(userId),
        qty,
      );
      setNotice({
        text: `${mapi.fmtQty(qty)} ${selected?.unit || ""} ${selected?.name || "Material"} an ${name(Number(userId))} zugewiesen.`,
        ok: true,
      });
      setMaterialId("");
      setQuantity("1");
      await loadData();
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const confirmOwn = async (a: Assignment) => {
    setBusy(true);
    try {
      await mapi.confirmHandover(a.id);
      setNotice({
        text: "Übernahme bestätigt – Sie sind jetzt für dieses Material verantwortlich.",
        ok: true,
      });
      await loadData();
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const book = async (open: number, unit: string) => {
    if (!booking) return;
    const qty = mapi.parseNum(booking.qty);
    if (!Number.isFinite(qty) || qty <= 0)
      return setNotice({
        text: "Bitte eine Menge größer als 0 eingeben.",
        ok: false,
      });
    if (qty > open)
      return setNotice({
        text: `Offen sind nur ${mapi.fmtQty(open)} ${unit}.`,
        ok: false,
      });
    setBusy(true);
    try {
      await mapi.bookUsage(booking.id, qty, booking.action, booking.note);
      setNotice({
        text: `${mapi.fmtQty(qty)} ${unit} als „${mapi.USAGE_LABELS[booking.action]}“ gebucht.`,
        ok: true,
      });
      setBooking(null);
      await loadData();
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (a: Assignment) => {
    const m = material(a.material_id);
    const ok = await showConfirm(
      `${mapi.fmtQty(a.quantity)} ${a.unit} ${m?.name || "Material"} wieder zurück ins Lager buchen?`,
      {
        title: "Zuweisung stornieren",
        confirmLabel: "Stornieren",
        danger: true,
      },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await mapi.cancelAssignment(a.id);
      setNotice({
        text: "Zuweisung storniert – Material ist zurück im Lager.",
        ok: true,
      });
      await loadData();
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mt-root" style={{ marginTop: 24 }}>
      <h3 style={{ margin: 0 }}>Material</h3>
      <p className="info-text" style={{ margin: "4px 0 0" }}>
        Material aus dem Lager diesem Auftrag zuweisen. Der Mitarbeiter
        bestätigt die Übernahme und bucht Verbrauch und Rückgabe. Arbeiten
        Leiharbeiter oder Subunternehmer, übernimmt der Projektleiter das
        Material selbst, bestätigt die Übernahme und bucht den Verbrauch hier.
      </p>

      <form onSubmit={assign} className="om-assign">
        <div className="mt-field">
          <label htmlFor={`om-mat-${orderId}`}>Material</label>
          <select
            id={`om-mat-${orderId}`}
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
          >
            <option value="">Bitte wählen</option>
            {materials.map((m) => (
              <option
                key={m.id}
                value={m.id}
                disabled={Number(m.stock_quantity) <= 0}
              >
                {m.name} –{" "}
                {Number(m.stock_quantity) <= 0
                  ? "nicht im Lager"
                  : `${mapi.fmtQty(m.stock_quantity)} ${m.unit} im Lager`}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-field">
          <label htmlFor={`om-qty-${orderId}`}>
            Menge{selected ? ` (${selected.unit})` : ""}
          </label>
          <input
            id={`om-qty-${orderId}`}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="mt-field">
          <label htmlFor={`om-user-${orderId}`}>Empfänger</label>
          <select
            id={`om-user-${orderId}`}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Bitte wählen</option>
            {teamWorkers.length > 0 && (
              <optgroup label="Team dieses Auftrags">
                {teamWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {name(w.id)}
                    {w.role_id === 3 ? " (PL)" : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {otherWorkers.length > 0 && (
              <optgroup
                label={
                  teamWorkers.length > 0 ? "Weitere Mitarbeiter" : "Mitarbeiter"
                }
              >
                {otherWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {name(w.id)}
                    {w.role_id === 3 ? " (PL)" : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "…" : "Zuweisen"}
        </button>
      </form>

      {notice && (
        <p className={`mt-msg ${notice.ok ? "ok" : "err"}`}>{notice.text}</p>
      )}

      {rows.length === 0 ? (
        <p className="mt-empty">Noch kein Material zugewiesen.</p>
      ) : (
        <table className="om-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Empfänger</th>
              <th>Zugewiesen</th>
              <th>Verbraucht</th>
              <th>Zurück</th>
              <th>Status</th>
              {showCosts && <th>Kosten</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, used, returned, open, cost, hasPrice }) => (
              <Fragment key={a.id}>
                <tr>
                  <td>
                    <b>
                      {material(a.material_id)?.name ||
                        `Material #${a.material_id}`}
                    </b>
                  </td>
                  <td data-label="An">{name(a.assigned_to_user_id)}</td>
                  <td data-label="Zugewiesen">
                    {mapi.fmtQty(a.quantity)} {a.unit}
                  </td>
                  <td data-label="Verbraucht">
                    {used > 0 ? `${mapi.fmtQty(used)} ${a.unit}` : "–"}
                  </td>
                  <td data-label="Zurück">
                    {returned > 0 ? `${mapi.fmtQty(returned)} ${a.unit}` : "–"}
                  </td>
                  <td>
                    <span className={`om-status ${a.status}`}>
                      {a.status === "reserved"
                        ? "Wartet auf Übernahme"
                        : open > 0
                          ? `Übernommen · ${mapi.fmtQty(open)} offen`
                          : "Abgeschlossen"}
                    </span>
                  </td>
                  {showCosts && (
                    <td data-label="Kosten">
                      {cost > 0
                        ? mapi.fmtMoney(cost, currency)
                        : hasPrice
                          ? "–"
                          : "kein Preis"}
                    </td>
                  )}
                  <td className="om-actions">
                    {a.status === "reserved" &&
                      Number(a.assigned_to_user_id) ===
                        Number(currentUserId) && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => confirmOwn(a)}
                          disabled={busy}
                        >
                          Übernahme bestätigen
                        </button>
                      )}
                    {a.status !== "reserved" &&
                      open > 0 &&
                      Number(a.assigned_to_user_id) ===
                        Number(currentUserId) && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() =>
                            setBooking(
                              booking?.id === a.id
                                ? null
                                : {
                                    id: a.id,
                                    qty: mapi.fmtQty(open),
                                    action: "used",
                                    note: "",
                                  },
                            )
                          }
                          disabled={busy}
                        >
                          Verbrauch buchen
                        </button>
                      )}
                    {a.status === "reserved" && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => cancel(a)}
                        disabled={busy}
                      >
                        Stornieren
                      </button>
                    )}
                  </td>
                </tr>
                {booking?.id === a.id && (
                  <tr className="om-book-row">
                    <td colSpan={showCosts ? 8 : 7}>
                      <div className="om-book">
                        <label>
                          Menge
                          <input
                            inputMode="decimal"
                            value={booking.qty}
                            onChange={(e) =>
                              setBooking({ ...booking, qty: e.target.value })
                            }
                          />
                          {a.unit}
                        </label>
                        <label>
                          Buchung
                          <select
                            value={booking.action}
                            onChange={(e) =>
                              setBooking({ ...booking, action: e.target.value })
                            }
                          >
                            {Object.entries(mapi.USAGE_LABELS).map(([k, l]) => (
                              <option key={k} value={k}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grow">
                          Notiz
                          <input
                            value={booking.note}
                            onChange={(e) =>
                              setBooking({ ...booking, note: e.target.value })
                            }
                            placeholder="optional"
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setBooking(null)}
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => book(open, a.unit)}
                          disabled={busy}
                        >
                          Buchen
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          {showCosts && (
            <tfoot>
              <tr>
                <td colSpan={6}>Materialkosten (verbraucht)</td>
                <td>{mapi.fmtMoney(totalCost, currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
