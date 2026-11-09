import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import * as mapi from "../modules/material/api";
import "../modules/material/material.css";

type MaterialAssignment = {
  id: number;
  material_id: number;
  quantity: number;
  unit: string;
  status: string;
  materials?: { name: string } | null;
};

type Props = {
  tenantId: number;
  orderId: string;
  currentUserId: number;
};

export default function EmployeeMaterialsSection({ tenantId, orderId, currentUserId }: Props) {
  const [assignments, setAssignments] = useState<MaterialAssignment[]>([]);
  const [logs, setLogs] = useState<mapi.UsageLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<{ id: number | null; text: string; ok: boolean } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [action, setAction] = useState<Record<number, string>>({});
  const [note, setNote] = useState<Record<number, string>>({});

  const load = async () => {
    const { data, error } = await supabase
      .from("order_material_assignments")
      .select("id, material_id, quantity, unit, status, materials ( name )")
      .eq("tenant_id", tenantId)
      .eq("order_id", Number(orderId))
      .eq("assigned_to_user_id", currentUserId)
      .order("assigned_at", { ascending: false });
    if (error) console.error("Material konnte nicht geladen werden:", error);
    const list = (data as unknown as MaterialAssignment[]) || [];
    setAssignments(list);
    if (list.length > 0) {
      const { data: logData } = await supabase
        .from("material_consumption_logs")
        .select("id, assignment_id, quantity, action, note, created_at")
        .eq("tenant_id", tenantId)
        .in("assignment_id", list.map((a) => a.id))
        .order("created_at", { ascending: false });
      setLogs((logData as mapi.UsageLog[]) || []);
    } else {
      setLogs([]);
    }
    setLoaded(true);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, orderId, currentUserId]);

  const confirm = async (a: MaterialAssignment) => {
    setBusyId(a.id);
    setNotice(null);
    try {
      await mapi.confirmHandover(a.id);
      setNotice({ id: a.id, text: "Übernahme bestätigt.", ok: true });
      await load();
    } catch (err) {
      setNotice({ id: a.id, text: (err as Error).message, ok: false });
    } finally {
      setBusyId(null);
    }
  };

  const book = async (a: MaterialAssignment, open: number) => {
    const q = mapi.parseNum(qty[a.id] || "");
    const act = action[a.id] || "used";
    if (!Number.isFinite(q) || q <= 0) return setNotice({ id: a.id, text: "Bitte eine Menge größer als 0 eingeben.", ok: false });
    if (q > open) return setNotice({ id: a.id, text: `Es sind nur noch ${mapi.fmtQty(open)} ${a.unit} offen.`, ok: false });
    setBusyId(a.id);
    setNotice(null);
    try {
      await mapi.bookUsage(a.id, q, act, (note[a.id] || "").trim());
      setQty((p) => ({ ...p, [a.id]: "" }));
      setNote((p) => ({ ...p, [a.id]: "" }));
      setAction((p) => ({ ...p, [a.id]: "used" }));
      setNotice({ id: a.id, text: `${mapi.USAGE_LABELS[act]}: ${mapi.fmtQty(q)} ${a.unit} gespeichert.`, ok: true });
      await load();
    } catch (err) {
      setNotice({ id: a.id, text: (err as Error).message, ok: false });
    } finally {
      setBusyId(null);
    }
  };

  if (!loaded) return null;
  if (assignments.length === 0) {
    return <p className="mt-empty">Für diesen Auftrag ist dir kein Material zugewiesen.</p>;
  }

  return (
    <div className="em-list mt-root">
      {assignments.map((a) => {
        const own = logs.filter((l) => l.assignment_id === a.id);
        const booked = own.reduce((s, l) => s + Number(l.quantity || 0), 0);
        const open = Math.max(0, Number(a.quantity) - booked);
        const msg = notice && notice.id === a.id ? notice : null;
        return (
          <div key={a.id} className="em-item">
            <div className="em-head">
              <div>
                <b>{a.materials?.name || `Material #${a.material_id}`}</b>
                <small>
                  {mapi.fmtQty(a.quantity)} {a.unit} zugewiesen
                  {a.status === "handed_over" ? ` · ${mapi.fmtQty(open)} ${a.unit} offen` : ""}
                </small>
              </div>
              <span className={`om-status ${a.status}`}>{a.status === "reserved" ? "Bitte Übernahme bestätigen" : open > 0 ? "Übernommen" : "Abgeschlossen"}</span>
            </div>

            {a.status === "reserved" ? (
              <button type="button" className="btn btn-primary" onClick={() => confirm(a)} disabled={busyId === a.id}>
                {busyId === a.id ? "Bestätigt …" : "✓ Material erhalten"}
              </button>
            ) : (
              open > 0 && (
                <div className="em-book">
                  <input
                    inputMode="decimal"
                    placeholder="Menge"
                    value={qty[a.id] || ""}
                    onChange={(e) => setQty((p) => ({ ...p, [a.id]: e.target.value }))}
                    aria-label="Menge"
                  />
                  <select value={action[a.id] || "used"} onChange={(e) => setAction((p) => ({ ...p, [a.id]: e.target.value }))} aria-label="Art">
                    <option value="used">Verbraucht</option>
                    <option value="returned">Zurück ins Lager</option>
                    <option value="damaged">Beschädigt</option>
                    <option value="left_on_site">Auf Baustelle gelassen</option>
                  </select>
                  <input
                    className="full"
                    placeholder="Notiz (optional)"
                    value={note[a.id] || ""}
                    onChange={(e) => setNote((p) => ({ ...p, [a.id]: e.target.value }))}
                    aria-label="Notiz"
                  />
                  <button type="button" className="btn btn-secondary full" onClick={() => book(a, open)} disabled={busyId === a.id}>
                    {busyId === a.id ? "Speichert …" : "Buchen"}
                  </button>
                </div>
              )
            )}

            {msg && <p className={`mt-msg ${msg.ok ? "ok" : "err"}`} style={{ margin: 0 }}>{msg.text}</p>}

            {own.length > 0 && (
              <ul className="em-logs">
                {own.map((l) => (
                  <li key={l.id}>
                    {new Date(l.created_at).toLocaleDateString("de-DE")} · <b>{mapi.USAGE_LABELS[l.action] || l.action}</b>: {mapi.fmtQty(l.quantity)} {a.unit}
                    {l.note ? ` – ${l.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
