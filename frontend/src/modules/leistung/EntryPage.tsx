// Leistungsmanagement → Bewertung erfassen (manuelle Punkte für einen Mitarbeiter, nur Chef)
import { useEffect, useMemo, useState } from "react";
import { ClipboardPen } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { isAutomatic, signed } from "./logic";
import type { Criterion } from "./logic";
import "../bi/bi.css";
import "./lt.css";

type Person = { id: number; first_name: string | null; last_name: string | null };
type Recent = { id: number; employee_id: number; criterion_id: number | null; points: number; note: string | null; created_at: string };
const nameOf = (p?: Person) => (p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "Mitarbeiter");

export default function EntryPage({ tenantId, userId, onBack }: { tenantId: number; userId: number; onBack: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [orders, setOrders] = useState<{ id: number; title: string | null }[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [employee, setEmployee] = useState("");
  const [order, setOrder] = useState("");
  const [criterion, setCriterion] = useState("");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("employee_performance")
      .select("id, employee_id, criterion_id, points, note, created_at")
      .eq("tenant_id", tenantId)
      .eq("source_type", "manual")
      .order("created_at", { ascending: false })
      .limit(10);
    setRecent((data ?? []) as Recent[]);
  };

  useEffect(() => {
    void (async () => {
      const [p, o, c] = await Promise.all([
        supabase.from("app_users").select("id, first_name, last_name").eq("tenant_id", tenantId).eq("is_active", true).in("role_id", [3, 4]).order("first_name"),
        supabase.from("orders").select("id, title").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(300),
        supabase.from("performance_criteria").select("*").eq("tenant_id", tenantId).order("category").order("name"),
      ]);
      setPeople((p.data ?? []) as Person[]);
      setOrders((o.data ?? []) as { id: number; title: string | null }[]);
      setCriteria((c.data ?? []) as Criterion[]);
    })();
    void loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const manual = useMemo(() => criteria.filter((c) => !isAutomatic(c) && c.is_active !== false), [criteria]);
  const chosen = manual.find((c) => String(c.id) === criterion);

  const save = async () => {
    setMsg(null);
    if (!employee || !chosen) return setMsg({ ok: false, text: "Bitte Mitarbeiter und Kriterium auswählen." });
    const pts = points === "" ? Number(chosen.default_points ?? 0) : Number(points);
    if (!Number.isFinite(pts)) return setMsg({ ok: false, text: "Bitte eine gültige Punktzahl eingeben." });
    setBusy(true);
    const { error } = await supabase.from("employee_performance").insert({
      tenant_id: tenantId,
      employee_id: Number(employee),
      criterion_id: chosen.id,
      order_id: order ? Number(order) : null,
      points: Math.round(pts),
      note: note.trim() || null,
      created_by: userId,
      source_type: "manual",
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: "Die Bewertung konnte nicht gespeichert werden." });
    setMsg({ ok: true, text: `${signed(Math.round(pts))} Punkte für ${nameOf(people.find((p) => String(p.id) === employee))} gespeichert.` });
    setCriterion("");
    setPoints("");
    setNote("");
    setOrder("");
    void loadRecent();
  };

  return (
    <section className="single-page-section">
      <div className="bi2">
        <div className="bi2-top">
          <div>
            <h2>
              <ClipboardPen size={24} aria-hidden="true" /> Bewertung erfassen
            </h2>
            <p>Punkte von Hand vergeben – zum Beispiel für Lob, Einsatz oder auch einen Fehler (Minuspunkte).</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Zurück
          </button>
        </div>

        <section className="bi2-card">
          <div className="lt-grid">
            <label>
              <span>Mitarbeiter</span>
              <select value={employee} onChange={(e) => setEmployee(e.target.value)}>
                <option value="">Bitte auswählen</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {nameOf(p)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Auftrag (optional)</span>
              <select value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="">Kein Auftrag</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title || `Auftrag #${o.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Kriterium</span>
              <select
                value={criterion}
                onChange={(e) => {
                  setCriterion(e.target.value);
                  setPoints("");
                }}
              >
                <option value="">{manual.length ? "Bitte auswählen" : "Noch keine manuellen Kriterien angelegt"}</option>
                {manual.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category ? `${c.category} – ` : ""}
                    {c.name} ({signed(c.default_points ?? 0)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Punkte</span>
              <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder={chosen ? `Standard: ${signed(chosen.default_points ?? 0)}` : "zuerst Kriterium wählen"} />
            </label>
            <label className="wide">
              <span>Kommentar (optional)</span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wofür gibt es die Punkte?" />
            </label>
          </div>
          {msg && <p className={`bi2-msg${msg.ok ? " ok" : ""}`}>{msg.text}</p>}
          <div className="lt-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? "Speichert …" : "Bewertung speichern"}
            </button>
          </div>
          <p className="bi2-small">Nur manuelle Kriterien sind wählbar – automatische Regeln werden je Auftrag selbst berechnet. Neue Kriterien legen Sie unter „Leistungsregeln“ an.</p>
        </section>

        {recent.length > 0 && (
          <section className="bi2-card">
            <h3>Zuletzt erfasst</h3>
            <ul className="bi2-list">
              {recent.map((r) => (
                <li key={r.id}>
                  <span>
                    {nameOf(people.find((p) => p.id === r.employee_id))} · {criteria.find((c) => c.id === r.criterion_id)?.name ?? "Bewertung"}
                    <small>
                      {new Date(r.created_at).toLocaleDateString("de-DE")}
                      {r.note ? ` · ${r.note}` : ""}
                    </small>
                  </span>
                  <b className={r.points < 0 ? "tone-red" : "tone-green"}>{signed(r.points)}</b>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
