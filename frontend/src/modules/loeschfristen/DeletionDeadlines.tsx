// Owner-Dashboard → „Löschfristen“ (AGB Punkt 21): Firmen 30 Tage nach Testphase/Vertragsende
import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseUrl } from "../../lib/supabase";
import { showAlert } from "../../lib/dialogs";

type Row = {
  tenant_id: number;
  company_name: string;
  email: string | null;
  plan: string | null;
  status: string | null;
  ended_at: string;
  due_at: string;
  reason: string | null;
  warned_at: string | null;
};

const d = (v: string | null) => (v ? new Date(v).toLocaleDateString("de-DE") : "–");
const daysUntil = (v: string) => Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);

export default function DeletionDeadlines(props: { reloadKey: number; onDelete: (tenantId: number, name: string) => Promise<void> }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("tenant_deletion_schedule");
    if (err) {
      setError(/does not exist|Could not find/i.test(err.message) ? "Für die Löschfristen fehlt noch das Datenbank-Update (20261107120000_loeschfristen.sql)." : err.message);
      setRows([]);
      return;
    }
    setError("");
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load, props.reloadKey]);

  const check = async () => {
    setChecking(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/deletion-check`, {
        method: "POST",
        headers: { authorization: `Bearer ${sess.session?.access_token ?? ""}`, "content-type": "application/json" },
        body: "{}",
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || `Fehler ${res.status}`);
      await showAlert(
        out.warned.length || out.failed.length
          ? `${out.warned.length ? `Vorwarnung gesendet an:\n• ${out.warned.join("\n• ")}` : ""}${out.failed.length ? `\n\nFehlgeschlagen:\n• ${out.failed.join("\n• ")}` : ""}`
          : "Es war keine neue Vorwarnung nötig.",
        { tone: out.failed.length ? "warning" : "success", title: "Löschfristen geprüft" }
      );
      await load();
    } catch (e) {
      await showAlert(`${e instanceof Error ? e.message : String(e)}\n\nIst die Funktion „deletion-check“ veröffentlicht?`, { tone: "error", title: "Das hat nicht geklappt" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="card" style={{ marginTop: 20, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Löschfristen</h3>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>
            30 Tage nach Ende der Testphase bzw. des Abos (AGB Punkt 21). Die Betriebe werden 7 Tage vorher per E-Mail gewarnt.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={check} disabled={checking}>
          {checking ? "Prüft …" : "Jetzt prüfen & Vorwarnungen senden"}
        </button>
      </div>
      {error && <p className="error-message" style={{ marginTop: 12 }}>{error}</p>}
      {rows === null ? (
        <p>Wird geladen …</p>
      ) : rows.length === 0 ? (
        !error && <p style={{ marginTop: 12 }}>Keine Firma mit abgelaufener Testphase oder beendetem Abo.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Firma</th>
                <th>Grund</th>
                <th>Ende</th>
                <th>Löschung am</th>
                <th>Vorwarnung</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const left = daysUntil(r.due_at);
                const due = left <= 0;
                return (
                  <tr key={r.tenant_id}>
                    <td>
                      <strong>{r.company_name}</strong>
                      <div style={{ color: "#64748b", fontSize: 13 }}>{r.email ?? "keine E-Mail"}</div>
                    </td>
                    <td>{r.reason}</td>
                    <td>{d(r.ended_at)}</td>
                    <td style={{ color: due ? "#b91c1c" : left <= 7 ? "#b45309" : undefined, fontWeight: due ? 700 : undefined }}>
                      {d(r.due_at)}
                      <div style={{ fontSize: 13 }}>{due ? "fällig" : `in ${left} Tag${left === 1 ? "" : "en"}`}</div>
                    </td>
                    <td>{d(r.warned_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!due}
                        title={due ? "Firma jetzt endgültig löschen" : "Erst nach Ablauf der Frist möglich"}
                        onClick={() => props.onDelete(r.tenant_id, r.company_name)}
                        style={due ? { background: "#dc2626", color: "#fff", border: "none" } : undefined}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
