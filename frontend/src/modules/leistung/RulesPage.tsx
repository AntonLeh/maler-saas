// Leistungsmanagement → Leistungsregeln & Bonusregeln (zwei Reiter, nur Chef)
import { useCallback, useEffect, useState } from "react";
import { Gift, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { showAlert, showConfirm } from "../../lib/dialogs";
import { METRICS, OPERATORS, REWARD_TYPES, isAutomatic, overlaps, pointsText, rangeText, rewardName, rewardText, ruleText } from "./logic";
import type { Criterion, Reward } from "./logic";
import "../bi/bi.css";
import "./lt.css";

type Tab = "rules" | "bonus";
type CForm = { id: number | null; category: string; name: string; description: string; mode: "manual" | "automatic"; points: string; key: string; op: string; value: string; success: string; failure: string; active: boolean };
type RForm = { id: number | null; name: string; stars: number; min: string; max: string; type: string; value: string; description: string; active: boolean };

const emptyC: CForm = { id: null, category: "", name: "", description: "", mode: "manual", points: "", key: "", op: "=", value: "1", success: "10", failure: "0", active: true };
const emptyR: RForm = { id: null, name: "", stars: 1, min: "", max: "", type: "money", value: "", description: "", active: true };
const errText = (e: unknown) => (e as { message?: string })?.message?.replace(/^.*?: /, "") || "Das hat nicht geklappt.";
const NEEDS_SQL = "Die neue Speicherfunktion fehlt noch in der Datenbank – bitte zuerst die SQL-Anweisung „Leistungsregeln speichern“ ausführen.";

export default function RulesPage({ tenantId, currency, initialTab = "rules", onBack }: { tenantId: number; currency: string; initialTab?: Tab; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [cForm, setCForm] = useState<CForm | null>(null);
  const [rForm, setRForm] = useState<RForm | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(
    () =>
      Promise.all([
        supabase.from("performance_criteria").select("*").eq("tenant_id", tenantId).order("category").order("name"),
        supabase.from("performance_rewards").select("*").eq("tenant_id", tenantId).order("min_points"),
      ]),
    [tenantId],
  );
  const apply = ([c, r]: Awaited<ReturnType<typeof fetchAll>>) => {
    setCriteria((c.data ?? []) as Criterion[]);
    setRewards((r.data ?? []) as Reward[]);
  };
  const load = async () => apply(await fetchAll());
  useEffect(() => {
    let cancel = false;
    void fetchAll().then((x) => !cancel && apply(x));
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAll]);

  const rpcError = (e: { message?: string; code?: string }) => (e.code === "PGRST202" || /perf_save_/.test(e.message ?? "") && /not find|does not exist/i.test(e.message ?? "") ? NEEDS_SQL : errText(e));

  const saveC = async () => {
    if (!cForm) return;
    const auto = cForm.mode === "automatic";
    setBusy(true);
    const { error } = await supabase.rpc("perf_save_criterion", {
      p_id: cForm.id,
      p_category: cForm.category,
      p_name: cForm.name,
      p_description: cForm.description,
      p_mode: cForm.mode,
      p_default_points: auto ? null : cForm.points === "" ? null : Number(cForm.points),
      p_evaluation_key: auto ? cForm.key : null,
      p_operator: auto ? cForm.op : null,
      p_value: auto && cForm.value !== "" ? Number(cForm.value.replace(",", ".")) : null,
      p_points_success: auto && cForm.success !== "" ? Number(cForm.success) : null,
      p_points_failure: auto && cForm.failure !== "" ? Number(cForm.failure) : null,
      p_active: cForm.active,
    });
    setBusy(false);
    if (error) return void showAlert(rpcError(error), { tone: "error", title: "Nicht gespeichert" });
    setCForm(null);
    await load();
  };

  const saveR = async () => {
    if (!rForm) return;
    setBusy(true);
    const { error } = await supabase.rpc("perf_save_reward", {
      p_id: rForm.id,
      p_name: rForm.name,
      p_stars: rForm.stars,
      p_min_points: rForm.min === "" ? null : Number(rForm.min),
      p_max_points: rForm.max === "" ? null : Number(rForm.max),
      p_type: rForm.type,
      p_value: rForm.value === "" ? null : Number(rForm.value.replace(",", ".")),
      p_description: rForm.description,
      p_active: rForm.active,
    });
    setBusy(false);
    if (error) return void showAlert(rpcError(error), { tone: "error", title: "Nicht gespeichert" });
    setRForm(null);
    await load();
  };

  const act = async (fn: string, arg: Record<string, number>, confirmText?: string) => {
    if (confirmText && !(await showConfirm(confirmText, { danger: true, confirmLabel: "Ja, löschen" }))) return;
    const { error } = await supabase.rpc(fn, arg);
    if (error) await showAlert(errText(error), { tone: "error", title: "Das hat nicht geklappt" });
    await load();
  };

  const editC = (c: Criterion) =>
    setCForm({
      id: c.id,
      category: c.category ?? "",
      name: c.name ?? "",
      description: c.description ?? "",
      mode: isAutomatic(c) ? "automatic" : "manual",
      points: String(c.default_points ?? ""),
      key: c.evaluation_key ?? "",
      op: c.evaluation_operator ?? "=",
      value: c.evaluation_value != null ? String(c.evaluation_value) : "1",
      success: String(c.points_on_success ?? c.default_points ?? ""),
      failure: String(c.points_on_failure ?? 0),
      active: c.is_active !== false,
    });
  const editR = (r: Reward) =>
    setRForm({
      id: r.id,
      name: rewardName(r),
      stars: Math.min(Math.max(Number(r.stars ?? 1), 1), 5),
      min: String(r.min_points ?? ""),
      max: r.max_points != null ? String(r.max_points) : "",
      type: r.reward_type ?? "money",
      value: String(r.reward_value ?? ""),
      description: r.description ?? "",
      active: r.is_active !== false,
    });

  const metric = cForm ? METRICS[cForm.key] : undefined;
  const ov = overlaps(rewards ?? []);
  const categories = [...new Set((criteria ?? []).map((c) => c.category).filter(Boolean))] as string[];

  return (
    <section className="single-page-section">
      <div className="bi2">
        <div className="bi2-top">
          <div>
            <h2>
              {tab === "rules" ? <Settings2 size={24} aria-hidden="true" /> : <Gift size={24} aria-hidden="true" />} {tab === "rules" ? "Leistungsregeln" : "Bonusregeln"}
            </h2>
            <p>{tab === "rules" ? "Wofür es Punkte gibt – automatisch je Auftrag oder von Ihnen vergeben." : "Welche Belohnung es für wie viele Punkte je Auftrag gibt."}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Zurück
          </button>
        </div>

        <div className="bi2-periods" role="tablist" aria-label="Bereich">
          <button type="button" role="tab" aria-selected={tab === "rules"} className={tab === "rules" ? "on" : ""} onClick={() => setTab("rules")}>
            Leistungsregeln
          </button>
          <button type="button" role="tab" aria-selected={tab === "bonus"} className={tab === "bonus" ? "on" : ""} onClick={() => setTab("bonus")}>
            Bonusregeln
          </button>
        </div>

        {tab === "rules" && (
          <section className="bi2-card">
            <div className="bi2-tablebar">
              <h3>Ihre Leistungsregeln</h3>
              {!cForm && (
                <button type="button" className="btn btn-primary lt-add" onClick={() => setCForm({ ...emptyC })}>
                  <Plus size={16} aria-hidden="true" /> Neue Regel
                </button>
              )}
            </div>

            {cForm && (
              <div className="lt-form">
                <h4>{cForm.id ? "Regel bearbeiten" : "Neue Regel"}</h4>
                <div className="lt-seg" role="radiogroup" aria-label="Regeltyp">
                  <button type="button" role="radio" aria-checked={cForm.mode === "manual"} className={cForm.mode === "manual" ? "on" : ""} onClick={() => setCForm({ ...cForm, mode: "manual" })}>
                    ✋ Manuell <small>Sie vergeben die Punkte von Hand</small>
                  </button>
                  <button type="button" role="radio" aria-checked={cForm.mode === "automatic"} className={cForm.mode === "automatic" ? "on" : ""} onClick={() => setCForm({ ...cForm, mode: "automatic" })}>
                    ⚙ Automatisch <small>wird je Auftrag selbst geprüft</small>
                  </button>
                </div>
                <div className="lt-grid">
                  <label>
                    <span>Kategorie</span>
                    <input list="lt-cats" value={cForm.category} onChange={(e) => setCForm({ ...cForm, category: e.target.value })} placeholder="z. B. Qualität" />
                    <datalist id="lt-cats">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    <span>Kriterium</span>
                    <input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} placeholder="z. B. Baustelle sauber übergeben" />
                  </label>
                  <label className="wide">
                    <span>Beschreibung (optional)</span>
                    <input value={cForm.description} onChange={(e) => setCForm({ ...cForm, description: e.target.value })} />
                  </label>

                  {cForm.mode === "manual" ? (
                    <label>
                      <span>Punkte</span>
                      <input type="number" value={cForm.points} onChange={(e) => setCForm({ ...cForm, points: e.target.value })} placeholder="z. B. 5 oder -3" />
                    </label>
                  ) : (
                    <>
                      <label>
                        <span>Messwert</span>
                        <select
                          value={cForm.key}
                          onChange={(e) => {
                            const m = METRICS[e.target.value];
                            setCForm({ ...cForm, key: e.target.value, op: m?.kind === "bool" ? "=" : cForm.op === "=" ? ">=" : cForm.op, value: m?.kind === "bool" ? "1" : "" });
                          }}
                        >
                          <option value="">Bitte auswählen …</option>
                          {Object.entries(METRICS).map(([k, m]) => (
                            <option key={k} value={k}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {metric?.kind === "bool" ? (
                        <label>
                          <span>Erfüllt, wenn</span>
                          <select value={cForm.value} onChange={(e) => setCForm({ ...cForm, op: "=", value: e.target.value })}>
                            <option value="1">ja</option>
                            <option value="0">nein</option>
                          </select>
                        </label>
                      ) : (
                        <div className="lt-pair">
                          <label>
                            <span>Vergleich</span>
                            <select value={cForm.op} onChange={(e) => setCForm({ ...cForm, op: e.target.value })}>
                              {Object.entries(OPERATORS).map(([k, l]) => (
                                <option key={k} value={k}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Wert{metric?.hint ? ` (${metric.hint})` : ""}</span>
                            <input inputMode="decimal" value={cForm.value} onChange={(e) => setCForm({ ...cForm, value: e.target.value })} />
                          </label>
                        </div>
                      )}
                      <div className="lt-pair">
                        <label>
                          <span>Punkte bei Erfolg</span>
                          <input type="number" value={cForm.success} onChange={(e) => setCForm({ ...cForm, success: e.target.value })} />
                        </label>
                        <label>
                          <span>Punkte sonst</span>
                          <input type="number" value={cForm.failure} onChange={(e) => setCForm({ ...cForm, failure: e.target.value })} />
                        </label>
                      </div>
                    </>
                  )}
                  <label className="lt-check">
                    <input type="checkbox" checked={cForm.active} onChange={(e) => setCForm({ ...cForm, active: e.target.checked })} /> Regel ist aktiv
                  </label>
                </div>
                <div className="lt-actions">
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={saveC}>
                    {busy ? "Speichert …" : "Speichern"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setCForm(null)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {criteria === null ? (
              <p className="bi2-muted">Lädt …</p>
            ) : criteria.length === 0 ? (
              <p className="bi2-muted">Noch keine Leistungsregeln. Legen Sie die erste mit „Neue Regel“ an.</p>
            ) : (
              <div className="bi2-table-wrap">
                <table className="bi2-table lt-table">
                  <thead>
                    <tr>
                      <th>Kriterium</th>
                      <th>Regel</th>
                      <th className="num">Punkte</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map((c) => (
                      <tr key={c.id} className={c.is_active === false ? "off" : ""}>
                        <td className="name" data-label="Kriterium">
                          {c.name}
                          <small className="sub">
                            <span className="bi2-chip">{c.category || "Ohne Kategorie"}</span>
                            {isAutomatic(c) ? "⚙ automatisch" : "✋ manuell"}
                          </small>
                        </td>
                        <td data-label="Regel">
                          {ruleText(c)}
                          {c.description && <small className="lt-desc">{c.description}</small>}
                        </td>
                        <td className="num strong" data-label="Punkte" title={isAutomatic(c) ? "bei Erfolg / sonst" : undefined}>
                          {pointsText(c)}
                        </td>
                        <td data-label="Status">
                          <button type="button" className={`lt-toggle${c.is_active === false ? "" : " on"}`} onClick={() => act("toggle_performance_criterion", { p_criterion_id: c.id })}>
                            {c.is_active === false ? "Inaktiv" : "Aktiv"}
                          </button>
                        </td>
                        <td className="lt-row-actions">
                          <button type="button" aria-label="Bearbeiten" title="Bearbeiten" onClick={() => editC(c)}>
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label="Löschen"
                            title="Löschen"
                            onClick={() => act("delete_performance_criterion", { p_criterion_id: c.id }, `Leistungsregel „${c.name}“ wirklich löschen?`)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="bi2-small">Automatische Regeln werden je Auftrag berechnet. „+10 / 0“ heißt: 10 Punkte, wenn die Regel erfüllt ist, sonst 0.</p>
          </section>
        )}

        {tab === "bonus" && (
          <section className="bi2-card">
            <div className="bi2-tablebar">
              <h3>Ihre Bonusstufen</h3>
              {!rForm && (
                <button type="button" className="btn btn-primary lt-add" onClick={() => setRForm({ ...emptyR })}>
                  <Plus size={16} aria-hidden="true" /> Neue Bonusstufe
                </button>
              )}
            </div>

            {ov.length > 0 && (
              <p className="bi2-msg warn">
                ⚠ Punktebereiche überschneiden sich: {ov.map(([a, b]) => `„${rewardName(a) || rangeText(a)}“ und „${rewardName(b) || rangeText(b)}“`).join(", ")}. Dann gilt die Stufe mit der
                höheren Mindestpunktzahl.
              </p>
            )}

            {rForm && (
              <div className="lt-form">
                <h4>{rForm.id ? "Bonusstufe bearbeiten" : "Neue Bonusstufe"}</h4>
                <div className="lt-grid">
                  <label>
                    <span>Name</span>
                    <input value={rForm.name} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} placeholder="z. B. Bronze, Silber, Gold" />
                  </label>
                  <div className="lt-field">
                    <span>Sterne</span>
                    <div className="lt-starpick" role="radiogroup" aria-label="Sterne">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" role="radio" aria-checked={rForm.stars === n} aria-label={`${n} Sterne`} className={n <= rForm.stars ? "on" : ""} onClick={() => setRForm({ ...rForm, stars: n })}>
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="lt-pair">
                    <label>
                      <span>Ab Punkten</span>
                      <input type="number" value={rForm.min} onChange={(e) => setRForm({ ...rForm, min: e.target.value })} />
                    </label>
                    <label>
                      <span>Bis Punkte (leer = offen)</span>
                      <input type="number" value={rForm.max} onChange={(e) => setRForm({ ...rForm, max: e.target.value })} />
                    </label>
                  </div>
                  <div className="lt-pair">
                    <label>
                      <span>Art</span>
                      <select value={rForm.type} onChange={(e) => setRForm({ ...rForm, type: e.target.value })}>
                        {Object.entries(REWARD_TYPES).map(([k, t]) => (
                          <option key={k} value={k}>
                            {t.icon} {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{rForm.type === "vacation" ? "Tage" : `Wert (${currency || "EUR"})`}</span>
                      <input inputMode="decimal" value={rForm.value} onChange={(e) => setRForm({ ...rForm, value: e.target.value })} />
                    </label>
                  </div>
                  <label className="wide">
                    <span>Beschreibung (optional)</span>
                    <input value={rForm.description} onChange={(e) => setRForm({ ...rForm, description: e.target.value })} placeholder="z. B. Tankgutschein" />
                  </label>
                  <label className="lt-check">
                    <input type="checkbox" checked={rForm.active} onChange={(e) => setRForm({ ...rForm, active: e.target.checked })} /> Bonusstufe ist aktiv
                  </label>
                </div>
                <div className="lt-actions">
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={saveR}>
                    {busy ? "Speichert …" : "Speichern"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setRForm(null)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {rewards === null ? (
              <p className="bi2-muted">Lädt …</p>
            ) : rewards.length === 0 ? (
              <p className="bi2-muted">Noch keine Bonusstufen. Legen Sie z. B. Bronze, Silber und Gold an.</p>
            ) : (
              <ul className="lt-rewards">
                {rewards.map((r) => (
                  <li key={r.id} className={r.is_active === false ? "off" : ""}>
                    <span className="lt-reward-stars" aria-label={`${r.stars ?? 0} Sterne`}>
                      {"★".repeat(Math.max(0, Math.min(5, Number(r.stars ?? 0))))}
                    </span>
                    <span className="lt-reward-main">
                      <b>{rewardName(r) || <em className="lt-missing">Name fehlt – bitte bearbeiten</em>}</b>
                      <small>
                        {rangeText(r)} · {rewardText(r, currency)}
                        {r.description ? ` · ${r.description}` : ""}
                      </small>
                    </span>
                    <button type="button" className={`lt-toggle${r.is_active === false ? "" : " on"}`} onClick={() => act("toggle_performance_reward", { p_reward_id: r.id })}>
                      {r.is_active === false ? "Inaktiv" : "Aktiv"}
                    </button>
                    <span className="lt-row-actions">
                      <button type="button" aria-label="Bearbeiten" title="Bearbeiten" onClick={() => editR(r)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Löschen"
                        title="Löschen"
                        onClick={() => act("delete_performance_reward", { p_reward_id: r.id }, `Bonusstufe „${rewardName(r) || rangeText(r)}“ wirklich löschen?`)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="bi2-small">Die Bonusstufe wird je Auftrag anhand der automatisch berechneten Punkte vergeben und erscheint im Ranking unter „Belohnungen“.</p>
          </section>
        )}
      </div>
    </section>
  );
}
