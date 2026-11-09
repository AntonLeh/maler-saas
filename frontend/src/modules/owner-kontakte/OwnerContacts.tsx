// Owner: Kontakte & Anschreiben (Innungen, Kammern, Verbände)
import { useEffect, useMemo, useRef, useState } from "react";
import { showAlert, showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import * as L from "./logic";
import type { Contact, Template } from "./logic";
import { blobToBase64, buildLetters } from "./letter";
import ContactPanel from "./ContactPanel";
import TemplateManager from "./TemplateManager";
import "./ok.css";

type Panel = { type: "contact"; contact: Contact | null } | { type: "templates" } | { type: "import"; rows: L.ImportRow[]; unknown: string[]; skipped: number } | { type: "serial" } | null;

const todayIso = () => new Date().toISOString().slice(0, 10);
const in21 = () => new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);

export default function OwnerContacts({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pingen, setPingen] = useState<{ configured: boolean; staging?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fCountry, setFCountry] = useState("");
  const [fKind, setFKind] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [panel, setPanel] = useState<Panel>(null);
  const [serialTpl, setSerialTpl] = useState<number | "">("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [c, t] = await Promise.all([api.loadContacts(), api.loadTemplates()]);
      setList(c);
      setTemplates(t);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    api.pingenStatus().then(setPingen).catch(() => setPingen({ configured: false }));
  }, []);

  const today = todayIso();
  const due = useMemo(() => L.dueFollowups(list, today), [list, today]);
  const kpi = {
    total: list.length,
    letters: list.filter((c) => c.status !== "neu").length,
    answers: list.filter((c) => ["antwort", "gespraech", "partner"].includes(c.status)).length,
    partner: list.filter((c) => c.status === "partner").length,
  };

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter(
      (c) =>
        (!fStatus || (fStatus === "faellig" ? due.includes(c) : fStatus === "gesperrt" ? c.blocked : c.status === fStatus)) &&
        (!fCountry || c.country === fCountry) &&
        (!fKind || c.kind === fKind) &&
        (!s || [c.organisation, c.city, c.region, c.last_name, c.email].some((v) => String(v ?? "").toLowerCase().includes(s)))
    );
  }, [list, q, fStatus, fCountry, fKind, due]);

  const toggle = (id: number) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((c) => c.id)));

  const upsertLocal = (c: Contact) => setList((p) => (p.some((x) => x.id === c.id) ? p.map((x) => (x.id === c.id ? c : x)) : [c, ...p]));

  // ---------- CSV ----------
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf); // Excel-CSV
    const r = L.parseCsv(text);
    if (!r.rows.length) return showAlert("In der Datei wurden keine Kontakte gefunden. Die erste Zeile muss Spaltennamen enthalten, z. B. Organisation;Straße;PLZ;Ort;E-Mail.");
    setPanel({ type: "import", rows: r.rows, unknown: r.unknownColumns, skipped: r.skipped });
  };

  const doImport = async (rows: L.ImportRow[]) => {
    const known = new Set(list.map((c) => `${c.organisation.toLowerCase()}|${(c.zip ?? "").trim()}`));
    const fresh = rows.filter((r) => !known.has(`${r.organisation.toLowerCase()}|${(r.zip ?? "").trim()}`));
    setBusy("import");
    try {
      const n = fresh.length ? await api.importContacts(fresh) : 0;
      setPanel(null);
      setMsg({ text: `${n} Kontakte importiert${rows.length - fresh.length ? `, ${rows.length - fresh.length} schon vorhanden (übersprungen)` : ""}.`, ok: true });
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  // ---------- Serienbrief ----------
  const chosen = list.filter((c) => selected.has(c.id));
  const sendable = chosen.filter((c) => !c.blocked && L.addressComplete(c));
  const serialTemplate = templates.find((t) => t.id === serialTpl) ?? null;

  const markSent = async (contacts: Contact[], tpl: Template, kind: "brief" | "brief_pingen", extra: Record<string, unknown> = {}) => {
    for (const c of contacts) {
      if (kind === "brief") await api.addEvent(c.id, "brief", L.fill(tpl.subject, c), null, { template: tpl.name, ...extra });
      const u = await api.saveContact(c.id, { status: c.status === "neu" ? "brief" : c.status, next_followup: c.next_followup ?? in21() });
      upsertLocal(u);
    }
  };

  const serialPdf = async () => {
    if (!serialTemplate || !sendable.length) return;
    setBusy("pdf");
    try {
      const pdf = await buildLetters(sendable, serialTemplate.subject, serialTemplate.body);
      const url = URL.createObjectURL(pdf);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Serienbrief_${today}_${sendable.length}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      if (await showConfirm(`${sendable.length} Briefe als PDF heruntergeladen (eine Seite pro Brief, Fenster-Kuvert DIN lang). Alle als „Brief verschickt“ eintragen?`, { confirmLabel: "Ja, eintragen", cancelLabel: "Später" })) {
        await markSent(sendable, serialTemplate, "brief");
        setMsg({ text: `${sendable.length} Kontakte als „Brief verschickt“ eingetragen, Wiedervorlage in 3 Wochen.`, ok: true });
        setSelected(new Set());
        setPanel(null);
      }
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  const serialPingen = async (delivery: "cheap" | "fast") => {
    if (!serialTemplate || !sendable.length) return;
    const ok = await showConfirm(
      `${sendable.length} Briefe über Pingen drucken und verschicken (${delivery === "fast" ? "Priority" : "Standard"})?${pingen?.staging ? "\n\nTestumgebung: Es wird nichts wirklich verschickt." : `\n\nEs entstehen Kosten bei Pingen (je Brief ca. 1–2 €).`}`,
      { title: "Serienbrief per Pingen", confirmLabel: "Jetzt senden" }
    );
    if (!ok) return;
    setBusy("pingen");
    let done = 0;
    const failed: string[] = [];
    for (const c of sendable) {
      setMsg({ text: `Pingen: ${done + 1} von ${sendable.length} …`, ok: true });
      try {
        const pdf = await buildLetters([c], serialTemplate.subject, serialTemplate.body);
        await api.pingenSend(c.id, await blobToBase64(pdf), `Brief_${c.id}.pdf`, L.fill(serialTemplate.subject, c), delivery);
        await markSent([c], serialTemplate, "brief_pingen");
        done++;
      } catch (e) {
        failed.push(`${c.organisation}: ${(e as Error).message}`);
        if (done === 0) break; // erster Brief scheitert → wahrscheinlich Einrichtung, nicht weitermachen
      }
    }
    setBusy("");
    setMsg({ text: `${done} Briefe an Pingen übergeben.${failed.length ? ` Fehler: ${failed.join(" · ")}` : ""}`, ok: failed.length === 0 });
    if (!failed.length) {
      setSelected(new Set());
      setPanel(null);
    }
  };

  const exportCsv = () => {
    const cols: (keyof Contact)[] = ["organisation", "kind", "country", "region", "salutation", "title", "first_name", "last_name", "position", "street", "zip", "city", "email", "phone", "website", "status", "next_followup", "blocked", "consent_basis", "consent_date"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "﻿" + [cols.join(";"), ...list.map((c) => cols.map((k) => esc(c[k])).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kontakte-${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("de-DE") : "");

  return (
    <section className="single-page-section ok-root">
      <div className="card form-page-card ok-main">
        <div className="ok-top">
          <div>
            <h2>Kontakte & Anschreiben</h2>
            <p>Innungen, Kammern und Verbände – Erstkontakt per Brief, E-Mail erst nach Antwort oder Einwilligung.</p>
          </div>
          <div className="ok-row-actions">
            <button type="button" className="btn btn-primary" onClick={() => setPanel({ type: "contact", contact: null })}>
              + Kontakt
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              CSV importieren
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPanel({ type: "templates" })}>
              Vorlagen
            </button>
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!list.length}>
              CSV-Export
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {error && <p className="ok-msg err">{error}</p>}
        {msg && <p className={`ok-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}

        <div className="ok-kpis">
          <div>
            <b>{kpi.total}</b>
            <span>Kontakte</span>
          </div>
          <div>
            <b>{kpi.letters}</b>
            <span>angeschrieben</span>
          </div>
          <div>
            <b>{kpi.answers}</b>
            <span>Antworten</span>
          </div>
          <div>
            <b>{kpi.partner}</b>
            <span>Partner</span>
          </div>
          <button type="button" className={`ok-kpi-btn${due.length ? " warn" : ""}`} onClick={() => setFStatus(fStatus === "faellig" ? "" : "faellig")}>
            <b>{due.length}</b>
            <span>Wiedervorlage fällig</span>
          </button>
        </div>

        {panel?.type === "contact" && (
          <ContactPanel
            key={panel.contact?.id ?? "neu"}
            contact={panel.contact}
            templates={templates}
            pingen={pingen}
            onSaved={(c) => {
              upsertLocal(c);
              if (!panel.contact) setPanel({ type: "contact", contact: c });
            }}
            onDeleted={() => {
              setList((p) => p.filter((x) => x.id !== panel.contact?.id));
              setPanel(null);
            }}
            onClose={() => setPanel(null)}
          />
        )}

        {panel?.type === "templates" && <TemplateManager templates={templates} onChange={setTemplates} onClose={() => setPanel(null)} />}

        {panel?.type === "import" && (
          <div className="ok-panel">
            <div className="ok-panel-head">
              <h3>CSV-Import: {panel.rows.length} Kontakte erkannt</h3>
              <div className="ok-row-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setPanel(null)}>
                  Abbrechen
                </button>
                <button type="button" className="btn btn-primary" onClick={() => doImport(panel.rows)} disabled={busy === "import"}>
                  {busy === "import" ? "Importiert …" : "Importieren"}
                </button>
              </div>
            </div>
            {panel.unknown.length > 0 && <p className="ok-small">Nicht übernommene Spalten: {panel.unknown.join(", ")}</p>}
            {panel.skipped > 0 && <p className="ok-small">{panel.skipped} Zeilen ohne Organisation übersprungen.</p>}
            <div className="ok-table-wrap">
              <table className="ok-table">
                <thead>
                  <tr>
                    <th>Organisation</th>
                    <th>Art</th>
                    <th>Land</th>
                    <th>Anschrift</th>
                    <th>Ansprechpartner</th>
                    <th>E-Mail</th>
                  </tr>
                </thead>
                <tbody>
                  {panel.rows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td>{r.organisation}</td>
                      <td>{L.KIND_LABELS[(r.kind ?? "innung") as L.Kind]}</td>
                      <td>{r.country ?? "DE"}</td>
                      <td>{[r.street, [r.zip, r.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</td>
                      <td>{[r.first_name, r.last_name].filter(Boolean).join(" ")}</td>
                      <td>{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {panel.rows.length > 50 && <p className="ok-small">… und {panel.rows.length - 50} weitere.</p>}
            <p className="ok-small">Bereits vorhandene Kontakte (gleiche Organisation + PLZ) werden übersprungen. Die E-Mail-Adresse wird nur gespeichert – sie wird nicht automatisch angeschrieben.</p>
          </div>
        )}

        {panel?.type === "serial" && (
          <div className="ok-panel">
            <div className="ok-panel-head">
              <h3>Serienbrief an {chosen.length} ausgewählte Kontakte</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setPanel(null)}>
                Schließen
              </button>
            </div>
            {chosen.length !== sendable.length && (
              <p className="ok-msg err">
                {chosen.length - sendable.length} ausgewählte Kontakte werden übersprungen (gesperrt oder Anschrift unvollständig).
              </p>
            )}
            <div className="ok-send">
              <div className="ok-field">
                <label>Brief-Vorlage</label>
                <select value={serialTpl} onChange={(e) => setSerialTpl(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Bitte wählen</option>
                  {templates
                    .filter((t) => t.kind === "brief")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
              <button type="button" className="btn btn-primary" disabled={!serialTemplate || !sendable.length || !!busy} onClick={serialPdf}>
                {busy === "pdf" ? "Erstellt …" : `📄 ${sendable.length} Briefe als PDF`}
              </button>
              <button type="button" className="btn btn-secondary" disabled={!serialTemplate || !sendable.length || !!busy || !pingen?.configured} onClick={() => serialPingen("cheap")}>
                {busy === "pingen" ? "Sendet …" : `📮 Per Pingen senden${pingen?.staging ? " (Test)" : ""}`}
              </button>
            </div>
            <p className="ok-small">
              a) PDF: selbst drucken, falten, in Fensterkuverts (DIN lang) – die Anschrift sitzt genau im Fenster. b) Pingen druckt, kuvertiert und frankiert für Sie
              {pingen?.configured ? "." : " – noch nicht eingerichtet."}
            </p>
          </div>
        )}

        <div className="ok-filters">
          <input type="search" placeholder="Suchen: Organisation, Ort, Name …" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Alle Status</option>
            {(Object.keys(L.STATUS_LABELS) as L.Status[]).map((k) => (
              <option key={k} value={k}>
                {L.STATUS_LABELS[k]}
              </option>
            ))}
            <option value="faellig">Wiedervorlage fällig</option>
            <option value="gesperrt">Gesperrt</option>
          </select>
          <select value={fCountry} onChange={(e) => setFCountry(e.target.value)}>
            <option value="">Alle Länder</option>
            <option value="DE">Deutschland</option>
            <option value="AT">Österreich</option>
            <option value="CH">Schweiz</option>
          </select>
          <select value={fKind} onChange={(e) => setFKind(e.target.value)}>
            <option value="">Alle Arten</option>
            {(Object.keys(L.KIND_LABELS) as L.Kind[]).map((k) => (
              <option key={k} value={k}>
                {L.KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={!selected.size} onClick={() => setPanel({ type: "serial" })}>
            📄 Serienbrief ({selected.size})
          </button>
        </div>

        {loading ? (
          <p className="ok-empty">Lädt …</p>
        ) : !list.length ? (
          <div className="ok-empty">
            <b>Noch keine Kontakte.</b> Legen Sie Innungen einzeln an oder importieren Sie eine CSV-Liste (z. B. aus Excel: Organisation; Ansprechpartner; Straße; PLZ; Ort; E-Mail).
            Adressen finden Sie auf den Websites der Handwerkskammern, des Bundesverbands Farbe Gestaltung Bautenschutz, der WKO (AT) und des SMGV (CH).
          </div>
        ) : !shown.length ? (
          <p className="ok-empty">Keine Kontakte für diesen Filter.</p>
        ) : (
          <div className="ok-table-wrap">
            <table className="ok-table ok-list">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Alle auswählen" />
                  </th>
                  <th>Organisation</th>
                  <th>Ort</th>
                  <th>Ansprechpartner</th>
                  <th>Status</th>
                  <th>Wiedervorlage</th>
                  <th>E-Mail</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className={c.blocked ? "blocked" : ""} onClick={() => setPanel({ type: "contact", contact: c })}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`${c.organisation} auswählen`} />
                    </td>
                    <td>
                      <b>{c.organisation}</b>
                      <small>
                        {L.KIND_LABELS[c.kind]} · {c.country}
                        {c.region ? ` · ${c.region}` : ""}
                      </small>
                    </td>
                    <td>{[c.zip, c.city].filter(Boolean).join(" ") || <span className="ok-miss">Anschrift fehlt</span>}</td>
                    <td>{[c.first_name, c.last_name].filter(Boolean).join(" ") || "–"}</td>
                    <td>
                      {c.blocked ? <span className="ok-chip s-blocked">⛔ gesperrt</span> : <span className={`ok-chip s-${c.status}`}>{L.STATUS_LABELS[c.status]}</span>}
                    </td>
                    <td className={c.next_followup && c.next_followup <= today && !c.blocked ? "ok-due" : ""}>{fmtDate(c.next_followup)}</td>
                    <td>{c.consent_basis ? <span className="ok-chip s-partner">✓ erlaubt</span> : c.email ? <span className="ok-small">nur Brief</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ok-small ok-legal">
          Rechtlich: Werbebriefe an Organisationen sind in DE, AT und CH erlaubt, solange kein Widerspruch vorliegt. Werbe-E-Mails und Werbeanrufe ohne vorherige Einwilligung sind
          nicht erlaubt (DE § 7 UWG, AT § 174 TKG, CH Art. 3 lit. o UWG) – darum ist „E-Mail“ erst nach eingetragener Grundlage möglich.
        </p>
      </div>
    </section>
  );
}
