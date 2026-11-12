// Nachweise: Bereich beim Subunternehmer/Leiharbeiter, Ampel, Erinnerung, Warnung bei Zuteilung
import { useMemo, useState } from "react";
import { showAlert, showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import {
  blockingIssues,
  currentByType,
  daysLeft,
  docLight,
  issueText,
  issuesFor,
  kindOf,
  labelOf,
  peopleIssues,
  personLight,
  typesFor,
  WARN_DAYS,
} from "./logic";
import type { Land, PartnerDoc } from "./logic";
import "./nw.css";

type P = { id: number; first_name?: string | null; last_name?: string | null; employment_type?: string | null; is_active?: boolean | null; role_id?: number };
const nameOf = (p: P) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `Person ${p.id}`;
const de = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE");

// ---------- Ampel in der Mitarbeiterliste ----------
export function DocsLight({ person, docs, land }: { person: P; docs: PartnerDoc[] | null; land: Land }) {
  const kind = kindOf(person.employment_type);
  if (!kind || !docs || person.is_active === false) return null;
  const issues = issuesFor(kind, land, docs.filter((d) => Number(d.user_id) === Number(person.id)));
  const light = personLight(issues);
  const text = light === "green" ? "Nachweise ok" : light === "yellow" ? "Nachweis läuft ab" : issues.some((i) => i.state === "missing") ? "Nachweis fehlt" : "Nachweis abgelaufen";
  return (
    <span className={`nw-light nw-${light}`} title={issues.map(issueText).join("\n") || "Alle Nachweise gültig"}>
      <i aria-hidden /> {text}
    </span>
  );
}

// ---------- Erinnerung im Dashboard / Terminkalender ----------
export function DocsReminder({ people, docs, land, onOpen }: { people: P[]; docs: PartnerDoc[] | null; land: Land; onOpen: (userId: number) => void }) {
  const list = useMemo(() => (docs ? peopleIssues(people, docs, land) : []), [people, docs, land]);
  if (!list.length) return null;
  const red = list.some((x) => personLight(x.issues) === "red");
  return (
    <div className={`nw-reminder ${red ? "nw-red" : "nw-yellow"}`}>
      <strong>📄 Nachweise prüfen</strong>
      <ul>
        {list.map(({ person, issues }) => (
          <li key={person.id}>
            <button type="button" onClick={() => onOpen(person.id)}>{nameOf(person)}</button>
            <span>{issues.map(issueText).join(" · ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Warnung bei der Zuteilung zu einem Auftrag ----------
export function AssignWarning({ selected, docs, land }: { selected: P[]; docs: PartnerDoc[] | null; land: Land }) {
  if (!docs) return null;
  const rows = peopleIssues(selected, docs, land)
    .map((x) => ({ ...x, issues: blockingIssues(x.issues) }))
    .filter((x) => x.issues.length);
  if (!rows.length) return null;
  return (
    <div className="nw-assign">
      <strong>⚠️ Achtung – Nachweis fehlt oder ist abgelaufen</strong>
      {rows.map(({ person, issues }) => (
        <p key={person.id}>
          <b>{nameOf(person)}:</b> {issues.map(issueText).join(", ")}.
        </p>
      ))}
      {land === "de" && rows.some((r) => r.issues.some((i) => i.type === "freistellung_48b")) && (
        <p className="nw-small">Ohne gültige Freistellungsbescheinigung müssen Sie von der Rechnung des Subunternehmers 15 % Bauabzugsteuer einbehalten und ans Finanzamt abführen.</p>
      )}
      {land === "at" && rows.some((r) => r.issues.some((i) => i.type === "hfu_liste")) && (
        <p className="nw-small">Steht der Subunternehmer nicht auf der HFU-Liste, haften Sie für seine Abgaben (Einbehalt 20 % bzw. 5 %).</p>
      )}
      <p className="nw-small">Die Zuteilung ist trotzdem möglich.</p>
    </div>
  );
}

// ---------- Bereich „Nachweise“ beim Bearbeiten ----------
export function DocsSection({
  tenantId,
  currentUserId,
  person,
  land,
  docs,
  onChanged,
}: {
  tenantId: number;
  currentUserId: number;
  person: P;
  land: Land;
  docs: PartnerDoc[] | null;
  onChanged: () => Promise<void> | void;
}) {
  const kind = kindOf(person.employment_type);
  const types = kind ? typesFor(land, kind) : [];
  const mine = useMemo(() => (docs ?? []).filter((d) => Number(d.user_id) === Number(person.id)), [docs, person.id]);
  const current = useMemo(() => currentByType(mine), [mine]);
  const issues = kind ? issuesFor(kind, land, mine) : [];
  const [type, setType] = useState(types[0]?.key ?? "sonstiges");
  const [title, setTitle] = useState("");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (!kind) return null;
  const def = types.find((t) => t.key === type);

  const save = async () => {
    setErr("");
    if (type === "sonstiges" && !title.trim()) return setErr("Bitte eine Bezeichnung eingeben.");
    if (!file && !until) return setErr("Bitte eine Datei wählen oder zumindest „gültig bis“ eintragen.");
    setBusy(true);
    try {
      await api.addDoc({ tenantId, userId: person.id, createdBy: currentUserId, docType: type, title, validUntil: until, note, file });
      setTitle(""); setUntil(""); setNote(""); setFile(null); setFileKey((k) => k + 1);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const open = async (d: PartnerDoc) => {
    if (!d.file_path) return;
    try {
      window.open(await api.docUrl(d.file_path), "_blank", "noopener");
    } catch (e) {
      await showAlert(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (d: PartnerDoc) => {
    if (!(await showConfirm(`„${labelOf(land, d.doc_type, d.title)}“ wirklich löschen?`, { danger: true, confirmLabel: "Löschen" }))) return;
    try {
      await api.deleteDoc(d);
      await onChanged();
    } catch (e) {
      await showAlert(e instanceof Error ? e.message : String(e));
    }
  };

  const status = (d: PartnerDoc) => {
    if (!d.valid_until) return <span className="nw-tag nw-green">ohne Ablauf</span>;
    const n = daysLeft(d.valid_until);
    const l = docLight(d);
    return <span className={`nw-tag nw-${l}`}>{n < 0 ? `abgelaufen ${de(d.valid_until)}` : `gültig bis ${de(d.valid_until)}`}</span>;
  };

  const sorted = [...mine].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const isCurrent = (d: PartnerDoc) => d.doc_type === "sonstiges" || current.get(d.doc_type)?.id === d.id;
  const visible = showAll ? sorted : sorted.filter(isCurrent);

  return (
    <section className="single-page-section nw-root">
      <div className="card form-page-card">
        <h3>📄 Nachweise {kind === "sub" ? "des Subunternehmers" : "der Zeitarbeitsfirma"}</h3>
        <p className="nw-small">Nur Sie als Inhaber sehen diese Nachweise. {WARN_DAYS} Tage vor Ablauf erscheint eine Erinnerung im Dashboard und im Terminkalender.</p>

        {docs === null ? (
          <p className="nw-msg err">{api.NEEDS_SQL}</p>
        ) : (
          <>
            <div className="nw-checklist">
              {types.filter((t) => t.key !== "sonstiges").map((t) => {
                const d = current.get(t.key);
                const l = d ? docLight(d) : t.key_doc ? "red" : "grey";
                return (
                  <div key={t.key} className={`nw-check nw-${l}`}>
                    <i aria-hidden />
                    <div>
                      <b>{t.label}{t.key_doc && <em> Pflicht</em>}</b>
                      <small>{d ? (d.valid_until ? `gültig bis ${de(d.valid_until)}` : "vorhanden") : "fehlt"}</small>
                    </div>
                  </div>
                );
              })}
            </div>

            {issues.length > 0 && (
              <div className="nw-msg warn">{issues.map(issueText).join(" · ")}</div>
            )}

            <div className="nw-form">
              <h4>Nachweis hinzufügen</h4>
              <div className="nw-grid">
                <label className="nw-field">
                  <span>Art</span>
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </label>
                {type === "sonstiges" ? (
                  <label className="nw-field">
                    <span>Bezeichnung</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Mindestlohn-Erklärung" />
                  </label>
                ) : (
                  <label className="nw-field">
                    <span>Gültig bis{def?.expires ? "" : " (falls angegeben)"}</span>
                    <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                  </label>
                )}
                {type === "sonstiges" && (
                  <label className="nw-field">
                    <span>Gültig bis (falls angegeben)</span>
                    <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                  </label>
                )}
                <label className="nw-field">
                  <span>Datei (PDF oder Foto)</span>
                  <input key={fileKey} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <label className="nw-field nw-wide">
                  <span>Notiz (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Sicherheitsnummer, Aussteller" />
                </label>
              </div>
              {def?.hint && <p className="nw-small">ℹ️ {def.hint}</p>}
              {err && <p className="nw-msg err">{err}</p>}
              <button type="button" className="btn btn-primary nw-save" disabled={busy} onClick={save}>{busy ? "Speichert …" : "Nachweis speichern"}</button>
            </div>

            {sorted.length > 0 && (
              <div className="nw-list">
                <div className="nw-list-head">
                  <h4>{showAll ? "Alle Nachweise (Verlauf)" : "Aktuelle Nachweise"}</h4>
                  {sorted.length > visible.length || showAll ? (
                    <button type="button" className="nw-link" onClick={() => setShowAll(!showAll)}>{showAll ? "Nur aktuelle" : `Verlauf anzeigen (${sorted.length})`}</button>
                  ) : null}
                </div>
                {visible.map((d) => (
                  <div key={d.id} className={`nw-row${isCurrent(d) ? "" : " old"}`}>
                    <div>
                      <b>{labelOf(land, d.doc_type, d.title)}</b>
                      <small>
                        hochgeladen {new Date(d.created_at).toLocaleDateString("de-DE")}
                        {d.note ? ` · ${d.note}` : ""}
                        {!isCurrent(d) ? " · ersetzt" : ""}
                      </small>
                    </div>
                    {status(d)}
                    <div className="nw-actions">
                      {d.file_path && <button type="button" className="btn btn-secondary btn-small" onClick={() => open(d)}>Öffnen</button>}
                      <button type="button" className="btn btn-danger btn-small" onClick={() => remove(d)}>Löschen</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
