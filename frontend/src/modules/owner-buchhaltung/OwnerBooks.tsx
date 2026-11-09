// Owner-Buchhaltung Spanien – Oberfläche (deutsch), Werte für die Agencia Tributaria
import { useCallback, useEffect, useMemo, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import * as L from "./logic";
import type { Expense, Income, IncomeTreatment, Quarter, Settings } from "./logic";
import ExpenseDialog from "./ExpenseDialog";
import "./ob.css";

type Tab = "uebersicht" | "einnahmen" | "ausgaben" | "m303" | "m130" | "m349" | "gestoria" | "einstellungen";

const TABS: [Tab, string][] = [
  ["uebersicht", "Übersicht"],
  ["einnahmen", "Einnahmen"],
  ["ausgaben", "Ausgaben"],
  ["m303", "IVA · Modelo 303"],
  ["m130", "IRPF · Modelo 130"],
  ["m349", "EU · Modelo 349"],
  ["gestoria", "Gestoría-Paket"],
  ["einstellungen", "Einstellungen"],
];

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n || 0);
const dateDe = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE");
const daysUntil = (d: string) => Math.ceil((new Date(`${d}T23:59:59`).getTime() - Date.now()) / 86400000);

function Casillas({ rows, hideZero }: { rows: L.Row[]; hideZero?: boolean }) {
  return (
    <table className="ob-cas">
      <tbody>
        {rows
          .filter((r) => !hideZero || r.value !== 0 || r.strong)
          .map((r) => (
            <tr key={r.c} className={r.strong ? "strong" : ""}>
              <td className="c">[{r.c}]</td>
              <td>{r.label}</td>
              <td className="v">{r.c === "65" ? "100 %" : eur(r.value)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

export default function OwnerBooks({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<{ settings: Settings; income: Income[]; expenses: Expense[] } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("uebersicht");
  const [qq, setQq] = useState<Quarter>(() => L.quarterOf(new Date().toISOString().slice(0, 10)));
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [hideZero, setHideZero] = useState(true);
  const [zipBusy, setZipBusy] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Settings | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.loadAll();
      setData(d);
      setSettingsForm(d.settings);
      setError("");
      return d;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const sync = useCallback(
    async (quiet = false) => {
      setSyncing(true);
      try {
        const r = await api.syncStripe();
        if (!quiet || r.warnings.length)
          setNotice({ text: `Stripe abgeglichen: ${r.count} Rechnung(en)/Gutschrift(en).${r.warnings.length ? " " + r.warnings.join(" · ") : ""}`, ok: !r.warnings.length });
        await load();
      } catch (err) {
        if (!quiet) setNotice({ text: (err as Error).message, ok: false });
      } finally {
        setSyncing(false);
      }
    },
    [load]
  );

  useEffect(() => {
    void load().then((d) => {
      if (!d) return;
      const last = d.settings.last_sync_at ? new Date(d.settings.last_sync_at).getTime() : 0;
      if (Date.now() - last > 6 * 3600 * 1000) void sync(true); // automatisch, wenn älter als 6 Stunden
    });
  }, [load, sync]);

  const s = data?.settings;
  const income = useMemo(() => data?.income ?? [], [data]);
  const expenses = useMemo(() => data?.expenses ?? [], [data]);

  const quarters = useMemo(() => {
    if (!s) return [qq];
    const today = new Date().toISOString().slice(0, 10);
    return L.quartersFrom(s.books_start, today > s.books_start ? today : s.books_start).reverse();
  }, [s, qq]);

  const r303 = useMemo(() => (s ? L.modelo303(income, expenses, qq, s.books_start) : null), [income, expenses, qq, s]);
  const r130 = useMemo(() => (s ? L.modelo130(income, expenses, qq, s) : null), [income, expenses, qq, s]);
  const r349 = useMemo(() => L.modelo349(income, expenses, qq), [income, expenses, qq]);

  const qIncome = income.filter((i) => L.inQuarter(i.issue_date, qq));
  const qExpenses = expenses.filter((e) => L.inQuarter(e.issue_date, qq));
  const sumIncome = qIncome.reduce((a, i) => a + i.net_eur, 0);
  const sumExpense = qExpenses.reduce((a, e) => a + L.irpfCost(e), 0);
  const dl = L.deadline(qq);
  const left = daysUntil(dl.to);
  const qKey = `${qq.year}-${qq.q}`;

  const changeTreatment = async (i: Income, t: IncomeTreatment) => {
    try {
      await api.updateIncome(i.id, { treatment: t });
      await load();
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    }
  };

  const changeRetencion = async (i: Income, v: string) => {
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n === i.retencion) return;
    try {
      await api.updateIncome(i.id, { retencion: n });
      await load();
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    }
  };

  const removeExpense = async (e: Expense) => {
    if (!(await showConfirm(`Ausgabe „${e.supplier}“ vom ${dateDe(e.issue_date)} löschen?`, { danger: true, confirmLabel: "Löschen" }))) return;
    try {
      await api.deleteExpense(e);
      await load();
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    }
  };

  const openReceipt = async (path: string) => {
    try {
      window.open(await api.receiptUrl(path), "_blank", "noopener");
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    }
  };

  const zip = async () => {
    if (!s) return;
    setZipBusy(true);
    try {
      const r = await api.gestoriaZip(income, expenses, qq, s);
      api.download(r.name, r.blob, "application/zip");
      setNotice({ text: r.missing.length ? `Paket erstellt. Ohne Beleg-Datei: ${r.missing.join(", ")}` : "Paket für die Gestoría erstellt.", ok: !r.missing.length });
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    } finally {
      setZipBusy(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    try {
      await api.saveSettings({
        nif: settingsForm.nif?.trim().toUpperCase() || null,
        full_name: settingsForm.full_name?.trim() || null,
        address: settingsForm.address?.trim() || null,
        difficult_pct: Number(settingsForm.difficult_pct),
        difficult_cap: Number(settingsForm.difficult_cap),
        minoracion: Number(settingsForm.minoracion),
        books_start: settingsForm.books_start,
      });
      setNotice({ text: "Einstellungen gespeichert.", ok: true });
      await load();
    } catch (err) {
      setNotice({ text: (err as Error).message, ok: false });
    }
  };

  const warnings: string[] = [];
  if (s && !s.nif) warnings.push("NIF fehlt in den Einstellungen.");
  if (r303?.review.length) warnings.push(`${r303.review.length} Rechnung(en) mit unklarer Steuerart – bitte unter „Einnahmen“ prüfen.`);
  if (r303 && r303.oss > 0) warnings.push("Es gibt Rechnungen mit ausländischer MwSt (OSS) – dafür ist zusätzlich das Modelo 369 nötig. Bitte mit der Gestoría klären.");
  const noFile = qExpenses.filter((e) => !e.file_path).length;
  if (noFile) warnings.push(`${noFile} Ausgabe(n) ohne Beleg-Datei.`);
  if (r349.some((r) => r.missingId)) warnings.push("Im Modelo 349 fehlt bei mindestens einem Partner die USt-IdNr.");
  if (qIncome.some((i) => i.currency !== "EUR")) warnings.push("Einnahmen in Fremdwährung wurden zum EZB-Kurs in Euro umgerechnet.");

  return (
    <section className="single-page-section ob-root">
      <div className="card form-page-card ob-card">
        <div className="ob-top">
          <div>
            <h2>Buchhaltung · Spanien</h2>
            <p>
              Autónomo · IVA vierteljährlich · IRPF estimación directa simplificada
              {s?.last_sync_at ? ` · Stripe abgeglichen ${new Date(s.last_sync_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : ""}
            </p>
          </div>
          <div className="ob-top-actions">
            <select value={qKey} onChange={(e) => {
              const [y, q] = e.target.value.split("-").map(Number);
              setQq({ year: y, q: q as Quarter["q"] });
            }} aria-label="Quartal">
              {quarters.map((p) => (
                <option key={`${p.year}-${p.q}`} value={`${p.year}-${p.q}`}>
                  {p.q}. Quartal {p.year}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={() => void sync()} disabled={syncing}>
              {syncing ? "Gleicht ab …" : "↻ Mit Stripe abgleichen"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        <div className="ob-tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>

        {error && <p className="ob-msg err">{error}</p>}
        {notice && <p className={`ob-msg ${notice.ok ? "ok" : "err"}`}>{notice.text}</p>}
        {!data && !error && <p className="ob-empty">Wird geladen …</p>}

        {data && r303 && r130 && (
          <>
            {tab === "uebersicht" && (
              <>
                <div className="ob-kpis">
                  <div>
                    <span>Einnahmen netto</span>
                    <b>{eur(sumIncome)}</b>
                    <small>{qIncome.length} Rechnung(en)</small>
                  </div>
                  <div>
                    <span>Ausgaben</span>
                    <b>{eur(sumExpense)}</b>
                    <small>{qExpenses.length} Beleg(e)</small>
                  </div>
                  <div>
                    <span>Gewinn im Quartal</span>
                    <b>{eur(sumIncome - sumExpense)}</b>
                    <small>vor Steuern</small>
                  </div>
                  <button type="button" className={r303.final > 0 ? "pay" : "ok"} onClick={() => setTab("m303")}>
                    <span>IVA (303)</span>
                    <b>{eur(Math.abs(r303.final))}</b>
                    <small>{r303.final > 0 ? "zu zahlen" : r303.final < 0 ? "zu kompensieren" : "Ergebnis 0"}</small>
                  </button>
                  <button type="button" className={r130.result > 0 ? "pay" : "ok"} onClick={() => setTab("m130")}>
                    <span>IRPF (130)</span>
                    <b>{eur(Math.max(0, r130.result))}</b>
                    <small>{r130.result > 0 ? "zu zahlen" : "nichts zu zahlen"}</small>
                  </button>
                </div>

                <div className={`ob-deadline${left <= 10 && left >= 0 ? " soon" : ""}`}>
                  <b>Abgabe {qq.q}. Quartal {qq.year}:</b> {dateDe(dl.from)} – {dateDe(dl.to)}
                  {left >= 0 ? ` · noch ${left} Tag(e)` : " · Frist abgelaufen"}
                  <span>Modelo 303 · Modelo 130 · {r349.length ? "Modelo 349" : "kein Modelo 349 nötig"}{qq.q === 4 ? " · im Januar zusätzlich Modelo 390 (Jahreszusammenfassung IVA)" : ""}</span>
                </div>

                {warnings.length > 0 && (
                  <ul className="ob-warn">
                    {warnings.map((w) => (
                      <li key={w}>⚠️ {w}</li>
                    ))}
                  </ul>
                )}
                <p className="ob-note">
                  Alle Werte sind eine Vorbereitung für Ihre Gestoría und keine Steuerberatung. Die Gestoría prüft und reicht ein.
                </p>
              </>
            )}

            {tab === "einnahmen" && (
              <>
                <p className="ob-hint">
                  Einnahmen kommen automatisch aus Stripe (bezahlte Rechnungen und Gutschriften ab {dateDe(s!.books_start)}). Die Steuerart wird automatisch bestimmt – ändern Sie sie nur, wenn sie nicht stimmt.
                </p>
                {qIncome.length === 0 ? (
                  <p className="ob-empty">Keine Einnahmen in diesem Quartal.</p>
                ) : (
                  <div className="ob-table-wrap">
                    <table className="ob-table">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Nr.</th>
                          <th>Kunde</th>
                          <th>Steuerart</th>
                          <th className="r">Netto</th>
                          <th className="r">IVA</th>
                          <th className="r">Retención</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {qIncome.map((i) => (
                          <tr key={i.id} className={i.treatment === "eu_no_vat_id" || i.treatment === "other" ? "warn" : ""}>
                            <td>{dateDe(i.issue_date)}</td>
                            <td>
                              {i.number ?? "–"}
                              {i.kind === "credit_note" && <small> Gutschrift</small>}
                            </td>
                            <td>
                              {i.customer_name || i.customer_email || "–"}
                              <small>
                                {[i.customer_country, i.customer_tax_id].filter(Boolean).join(" · ")}
                                {i.currency !== "EUR" ? ` · ${i.total.toFixed(2)} ${i.currency}` : ""}
                              </small>
                            </td>
                            <td>
                              <select value={i.treatment} onChange={(e) => changeTreatment(i, e.target.value as IncomeTreatment)} aria-label="Steuerart">
                                {(Object.keys(L.INCOME_LABELS) as IncomeTreatment[]).map((t) => (
                                  <option key={t} value={t}>
                                    {L.INCOME_LABELS[t]}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="r">{eur(i.net_eur)}</td>
                            <td className="r">{i.tax_eur ? eur(i.tax_eur) : "–"}</td>
                            <td className="r">
                              {i.customer_country === "ES" ? (
                                <input
                                  className="ob-mini"
                                  defaultValue={i.retencion ? String(i.retencion).replace(".", ",") : ""}
                                  placeholder="0"
                                  inputMode="decimal"
                                  onBlur={(e) => changeRetencion(i, e.target.value || "0")}
                                  aria-label="Retención"
                                />
                              ) : (
                                "–"
                              )}
                            </td>
                            <td>
                              {i.invoice_pdf && (
                                <a href={i.invoice_pdf} target="_blank" rel="noreferrer">
                                  PDF
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4}>Summe {qq.q}. Quartal</td>
                          <td className="r">{eur(sumIncome)}</td>
                          <td className="r">{eur(qIncome.reduce((a, i) => a + i.tax_eur, 0))}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}

            {tab === "ausgaben" && (
              <>
                <div className="ob-row">
                  <p className="ob-hint">Rechnungen Ihrer Dienstleister (Server, KI, Werbung, Gestoría …) und die Cuota de autónomos.</p>
                  <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
                    + Ausgabe erfassen
                  </button>
                </div>
                {qExpenses.length === 0 ? (
                  <p className="ob-empty">Keine Ausgaben in diesem Quartal.</p>
                ) : (
                  <div className="ob-table-wrap">
                    <table className="ob-table">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Lieferant</th>
                          <th>Kategorie</th>
                          <th>Steuerart</th>
                          <th className="r">Netto</th>
                          <th className="r">IVA</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {qExpenses.map((e) => (
                          <tr key={e.id}>
                            <td>{dateDe(e.issue_date)}</td>
                            <td>
                              {e.supplier}
                              <small>{[e.supplier_country, e.invoice_number, e.currency !== "EUR" && e.amount_original != null ? `${e.amount_original} ${e.currency}` : ""].filter(Boolean).join(" · ")}</small>
                            </td>
                            <td>{L.CATEGORY_LABELS[e.category] ?? e.category}</td>
                            <td>{L.EXPENSE_LABELS[e.treatment]}</td>
                            <td className="r">{eur(e.net)}</td>
                            <td className="r">{e.treatment === "es_iva" ? eur(e.iva) : e.treatment === "sin_iva" ? "–" : `${eur(L.ispQuota(e))} ISP`}</td>
                            <td className="ob-acts">
                              {e.file_path ? (
                                <button type="button" onClick={() => openReceipt(e.file_path!)} title="Beleg öffnen">
                                  📎
                                </button>
                              ) : (
                                <span title="Kein Beleg">⚠️</span>
                              )}
                              <button type="button" onClick={() => setEditing(e)} title="Bearbeiten">
                                ✏️
                              </button>
                              <button type="button" onClick={() => removeExpense(e)} title="Löschen">
                                🗑
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4}>Summe {qq.q}. Quartal</td>
                          <td className="r">{eur(qExpenses.reduce((a, e) => a + e.net, 0))}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}

            {tab === "m303" && (
              <>
                <div className={`ob-result ${r303.final > 0 ? "pay" : "ok"}`}>
                  <span>Modelo 303 · {qq.q}T {qq.year}</span>
                  <b>
                    {r303.final > 0 ? `${eur(r303.final)} zu zahlen` : r303.final < 0 ? `${eur(-r303.final)} zu kompensieren` : "Ergebnis 0 €"}
                  </b>
                  <small>{r303.final < 0 ? (qq.q === 4 ? "Im 4. Quartal kann die Gestoría auch eine Erstattung (devolución) beantragen." : "Wird automatisch mit dem nächsten Quartal verrechnet (Casilla 110).") : "Frist " + dateDe(dl.to)}</small>
                </div>
                <label className="ob-toggle">
                  <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} /> Leere Casillas ausblenden
                </label>
                <Casillas rows={r303.rows} hideZero={hideZero} />
              </>
            )}

            {tab === "m130" && (
              <>
                <div className={`ob-result ${r130.result > 0 ? "pay" : "ok"}`}>
                  <span>Modelo 130 · {qq.q}T {qq.year}</span>
                  <b>{r130.result > 0 ? `${eur(r130.result)} zu zahlen` : "0 € zu zahlen"}</b>
                  <small>
                    Kumuliert seit 1. Januar · 20 % vom Gewinn minus bisherige Vorauszahlungen · minoración {eur(s!.minoracion)} je Quartal
                  </small>
                </div>
                <Casillas rows={r130.rows} />
              </>
            )}

            {tab === "m349" && (
              <>
                <p className="ob-hint">
                  Zusammenfassende Meldung der EU-Geschäfte: <b>S</b> = Dienstleistungen an EU-Firmen, <b>I</b> = Dienstleistungen von EU-Firmen bezogen (z. B. Google Ireland).
                </p>
                {r349.length === 0 ? (
                  <p className="ob-empty">Keine EU-Geschäfte in diesem Quartal – kein Modelo 349 nötig.</p>
                ) : (
                  <div className="ob-table-wrap">
                    <table className="ob-table">
                      <thead>
                        <tr>
                          <th>Clave</th>
                          <th>NIF-IVA</th>
                          <th>Name</th>
                          <th>Land</th>
                          <th className="r">Base</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r349.map((r) => (
                          <tr key={`${r.clave}${r.nif}${r.name}`} className={r.missingId ? "warn" : ""}>
                            <td>{r.clave}</td>
                            <td>{r.nif || "fehlt"}</td>
                            <td>{r.name}</td>
                            <td>{r.country}</td>
                            <td className="r">{eur(r.base)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {tab === "gestoria" && (
              <div className="ob-pack">
                <p className="ob-hint">
                  Alles für Ihre Gestoría zum {qq.q}. Quartal {qq.year} – Dateien auf Spanisch, Excel öffnet sie direkt.
                </p>
                <button type="button" className="btn btn-primary" onClick={zip} disabled={zipBusy}>
                  {zipBusy ? "Erstellt …" : "📦 Komplettes Paket (ZIP inkl. Belege)"}
                </button>
                <div className="ob-pack-row">
                  <button type="button" className="btn btn-secondary" onClick={() => api.download(`libro_facturas_emitidas_${qq.year}-${qq.q}T.csv`, L.libroEmitidas(income, L.quarterRange(qq).from, L.quarterRange(qq).to))}>
                    Libro facturas emitidas
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => api.download(`libro_facturas_recibidas_${qq.year}-${qq.q}T.csv`, L.libroRecibidas(expenses, L.quarterRange(qq).from, L.quarterRange(qq).to))}>
                    Libro facturas recibidas
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => api.download(`resumen_${qq.year}-${qq.q}T.csv`, L.resumenCsv(qq, r303, r130, r349))}>
                    Resumen 303 / 130 / 349
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => api.download(`libro_facturas_emitidas_${qq.year}.csv`, L.libroEmitidas(income, `${qq.year}-01-01`, `${qq.year}-12-31`))}>
                    Ganzes Jahr {qq.year}: emitidas
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => api.download(`libro_facturas_recibidas_${qq.year}.csv`, L.libroRecibidas(expenses, `${qq.year}-01-01`, `${qq.year}-12-31`))}>
                    Ganzes Jahr {qq.year}: recibidas
                  </button>
                </div>
              </div>
            )}

            {tab === "einstellungen" && settingsForm && (
              <form className="ob-form ob-settings" onSubmit={saveSettings}>
                <div className="ob-field">
                  <label>NIF / NIE</label>
                  <input value={settingsForm.nif ?? ""} onChange={(e) => setSettingsForm({ ...settingsForm, nif: e.target.value })} />
                </div>
                <div className="ob-field">
                  <label>Name (wie beim Finanzamt)</label>
                  <input value={settingsForm.full_name ?? ""} onChange={(e) => setSettingsForm({ ...settingsForm, full_name: e.target.value })} />
                </div>
                <div className="ob-field full">
                  <label>Adresse</label>
                  <input value={settingsForm.address ?? ""} onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })} />
                </div>
                <div className="ob-field">
                  <label>Beginn der Tätigkeit (Alta)</label>
                  <input type="date" value={settingsForm.books_start} onChange={(e) => setSettingsForm({ ...settingsForm, books_start: e.target.value })} />
                </div>
                <div className="ob-field">
                  <label>Minoración Modelo 130 je Quartal</label>
                  <select value={String(settingsForm.minoracion)} onChange={(e) => setSettingsForm({ ...settingsForm, minoracion: Number(e.target.value) })}>
                    <option value="100">100 € (Gewinn Vorjahr bis 9.000 € oder keine Tätigkeit)</option>
                    <option value="75">75 € (9.000–10.000 €)</option>
                    <option value="50">50 € (10.000–11.000 €)</option>
                    <option value="25">25 € (11.000–12.000 €)</option>
                    <option value="0">0 € (über 12.000 €)</option>
                  </select>
                </div>
                <div className="ob-field">
                  <label>Gastos de difícil justificación (%)</label>
                  <input inputMode="decimal" value={String(settingsForm.difficult_pct)} onChange={(e) => setSettingsForm({ ...settingsForm, difficult_pct: Number(e.target.value.replace(",", ".")) || 0 })} />
                </div>
                <div className="ob-field">
                  <label>Höchstbetrag pro Jahr (€)</label>
                  <input inputMode="decimal" value={String(settingsForm.difficult_cap)} onChange={(e) => setSettingsForm({ ...settingsForm, difficult_cap: Number(e.target.value.replace(",", ".")) || 0 })} />
                </div>
                <p className="ob-note full">
                  Die Minoración richtet sich nach dem Gewinn des Vorjahres (Modelo 100). 5 % / 2.000 € gelten für die estimación directa simplificada – bitte mit der Gestoría bestätigen.
                </p>
                <div className="ob-actions full">
                  <button type="submit" className="btn btn-primary">
                    Speichern
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {editing && (
        <ExpenseDialog
          expense={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice({ text: "Ausgabe gespeichert.", ok: true });
            void load();
          }}
        />
      )}
    </section>
  );
}
