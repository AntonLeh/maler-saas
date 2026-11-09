// Kontakt bearbeiten: Stammdaten, Grundlage für E-Mails, Widerspruch, Verlauf, Brief/E-Mail
import { useEffect, useState } from "react";
import { showConfirm, showPrompt } from "../../lib/dialogs";
import * as api from "./api";
import * as L from "./logic";
import type { Contact, ContactEvent, Template } from "./logic";
import { blobToBase64, buildLetters } from "./letter";

type Props = {
  contact: Contact | null; // null = neu
  templates: Template[];
  pingen: { configured: boolean; staging?: boolean } | null;
  onSaved: (c: Contact) => void;
  onDeleted: () => void;
  onClose: () => void;
};

const EMPTY: Partial<Contact> = { organisation: "", kind: "innung", country: "DE", status: "neu", salutation: "", blocked: false };
const todayIso = () => new Date().toISOString().slice(0, 10);

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function ContactPanel({ contact, templates, pingen, onSaved, onDeleted, onClose }: Props) {
  const [f, setF] = useState<Partial<Contact>>(contact ?? EMPTY);
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [tplId, setTplId] = useState<number | "">(templates.find((t) => t.kind === "brief")?.id ?? "");
  const [mail, setMail] = useState<{ subject: string; body: string } | null>(null);
  const id = contact?.id ?? null;
  const saved = contact ? { ...contact, ...f } as Contact : null;

  useEffect(() => {
    if (!id) return;
    api.loadEvents(id).then(setEvents).catch(() => setEvents([]));
  }, [id]);

  const set = (k: keyof Contact, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const reloadEvents = async () => id && setEvents(await api.loadEvents(id).catch(() => events));

  const save = async (extra: Partial<Contact> = {}) => {
    if (!String(f.organisation ?? "").trim()) return setMsg({ text: "Bitte den Namen der Organisation eintragen.", ok: false });
    if (f.email && !L.EMAIL_RE.test(String(f.email).trim())) return setMsg({ text: "Die E-Mail-Adresse ist ungültig.", ok: false });
    setBusy("save");
    try {
      const values = { ...f, ...extra, organisation: String(f.organisation).trim(), email: f.email ? String(f.email).trim().toLowerCase() : null };
      const c = await api.saveContact(id, values);
      setF(c);
      onSaved(c);
      setMsg({ text: "Gespeichert.", ok: true });
      return c;
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
      return null;
    } finally {
      setBusy("");
    }
  };

  const setConsent = async (basis: L.Consent | "") => {
    if (!id) return;
    if (!basis) {
      await save({ consent_basis: null, consent_date: null, consent_note: null });
      return;
    }
    const note = await showPrompt(`Grundlage „${L.CONSENT_LABELS[basis]}“ – kurz festhalten, wann und wie (Ihr Nachweis):`, {
      title: "Grundlage für E-Mails",
      placeholder: "z. B. Antwort per E-Mail von Frau Müller am 12.11.",
      multiline: true,
      validate: (v) => (v.trim().length < 5 ? "Bitte kurz beschreiben." : null),
    });
    if (note === null) return;
    const c = await save({ consent_basis: basis, consent_date: todayIso(), consent_note: note.trim(), status: f.status === "neu" || f.status === "brief" ? "antwort" : f.status });
    if (c) {
      await api.addEvent(c.id, "einwilligung", L.CONSENT_LABELS[basis], note.trim());
      await reloadEvents();
    }
  };

  const block = async () => {
    if (!id) return;
    if (f.blocked) {
      if (!(await showConfirm("Sperre wirklich aufheben? Nur wenn der Widerspruch zurückgenommen wurde.", { confirmLabel: "Aufheben" }))) return;
      await save({ blocked: false, blocked_at: null, blocked_reason: null });
      return;
    }
    const reason = await showPrompt("Widerspruch eintragen – dieser Kontakt wird danach weder per Brief noch per E-Mail angeschrieben.", {
      title: "Widerspruch / Sperre",
      placeholder: "z. B. „Bitte keine Werbung“ per Telefon am 15.11.",
      confirmLabel: "Sperren",
      danger: true,
    });
    if (reason === null) return;
    const c = await save({ blocked: true, blocked_at: new Date().toISOString(), blocked_reason: reason.trim() || "Widerspruch", status: "kein_interesse", next_followup: null });
    if (c) {
      await api.addEvent(c.id, "sperre", "Widerspruch", reason.trim());
      await reloadEvents();
    }
  };

  const addNote = async () => {
    if (!id) return;
    const t = await showPrompt("Notiz zum Kontakt (z. B. Telefonat, Antwort):", { title: "Notiz", multiline: true });
    if (!t?.trim()) return;
    await api.addEvent(id, "notiz", null, t.trim());
    await reloadEvents();
  };

  const tpl = templates.find((t) => t.id === tplId) ?? null;
  const letterTemplates = templates.filter((t) => t.kind === "brief");
  const mailTemplates = templates.filter((t) => t.kind === "email");

  const letterPdf = async () => {
    if (!saved || !tpl) return null;
    if (!L.addressComplete(saved)) {
      setMsg({ text: "Für einen Brief fehlen Straße, PLZ oder Ort.", ok: false });
      return null;
    }
    return buildLetters([saved], tpl.subject, tpl.body);
  };

  const downloadLetter = async () => {
    setBusy("pdf");
    try {
      const pdf = await letterPdf();
      if (!pdf || !saved) return;
      saveBlob(pdf, `Brief_${saved.organisation.replace(/[^\wäöüÄÖÜß-]+/g, "_").slice(0, 40)}.pdf`);
      if (await showConfirm("Brief heruntergeladen. Als „Brief verschickt“ eintragen, sobald er zur Post geht?", { confirmLabel: "Ja, eintragen", cancelLabel: "Noch nicht" })) {
        await api.addEvent(saved.id, "brief", L.fill(tpl!.subject, saved), null, { template: tpl!.name });
        await save({ status: saved.status === "neu" ? "brief" : saved.status, next_followup: saved.next_followup ?? new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10) });
        await reloadEvents();
      }
    } finally {
      setBusy("");
    }
  };

  const sendPingen = async (delivery: "cheap" | "fast") => {
    if (!saved || !tpl) return;
    const ok = await showConfirm(
      `Brief an „${saved.organisation}“ jetzt über Pingen drucken und verschicken (${delivery === "fast" ? "A-Post / Priority" : "Standard"})?${pingen?.staging ? "\n\nTestumgebung: Es wird nichts wirklich verschickt." : "\n\nEs entstehen Kosten bei Pingen."}`,
      { title: "Per Pingen senden", confirmLabel: "Jetzt senden" }
    );
    if (!ok) return;
    setBusy("pingen");
    try {
      const pdf = await letterPdf();
      if (!pdf) return;
      const r = await api.pingenSend(saved.id, await blobToBase64(pdf), `Brief_${saved.id}.pdf`, L.fill(tpl.subject, saved), delivery);
      setMsg({ text: `Brief an Pingen übergeben (${r.status})${r.staging ? " – Testumgebung" : ""}.`, ok: true });
      await save({ status: saved.status === "neu" ? "brief" : saved.status, next_followup: saved.next_followup ?? new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10) });
      await reloadEvents();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  const openMail = (t: Template | null) => setMail({ subject: t?.subject ?? "", body: t?.body ?? "{anrede},\n\n\n\nMit freundlichen Grüßen\nAnton Lehmann" });

  const sendMail = async () => {
    if (!saved || !mail) return;
    setBusy("mail");
    try {
      await api.sendEmail(saved.id, mail.subject, mail.body);
      setMail(null);
      setMsg({ text: `E-Mail an ${saved.email} gesendet.`, ok: true });
      await reloadEvents();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!id) return;
    if (!(await showConfirm(`Kontakt „${f.organisation}“ mit Verlauf löschen? Tipp: Bei Widerspruch lieber „Sperren“ – dann wird er nicht versehentlich neu angelegt.`, { danger: true, confirmLabel: "Löschen" }))) return;
    try {
      await api.deleteContact(id);
      onDeleted();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  };

  const mailBlock = saved ? L.emailBlocker(saved) : "Erst speichern.";
  const field = (k: keyof Contact, label: string, props: Record<string, unknown> = {}) => (
    <div className="ok-field">
      <label>{label}</label>
      <input value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value)} {...props} />
    </div>
  );

  return (
    <div className="ok-panel">
      <div className="ok-panel-head">
        <h3>{id ? f.organisation : "Neuer Kontakt"}</h3>
        <div className="ok-row-actions">
          {id && (
            <button type="button" className="btn btn-secondary" onClick={remove}>
              Löschen
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Schließen
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save()} disabled={busy === "save"}>
            {busy === "save" ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </div>
      {msg && <p className={`ok-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      {f.blocked && <p className="ok-msg err">⛔ Gesperrt (Widerspruch {f.blocked_at ? new Date(f.blocked_at).toLocaleDateString("de-DE") : ""}): {f.blocked_reason}</p>}

      <div className="ok-grid">
        <div className="ok-field full">
          <label>Organisation *</label>
          <input value={String(f.organisation ?? "")} onChange={(e) => set("organisation", e.target.value)} placeholder="z. B. Maler- und Lackiererinnung München" />
        </div>
        <div className="ok-field">
          <label>Art</label>
          <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            {(Object.keys(L.KIND_LABELS) as L.Kind[]).map((k) => (
              <option key={k} value={k}>
                {L.KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="ok-field">
          <label>Land</label>
          <select value={f.country} onChange={(e) => set("country", e.target.value)}>
            <option value="DE">Deutschland</option>
            <option value="AT">Österreich</option>
            <option value="CH">Schweiz</option>
          </select>
        </div>
        {field("region", "Region / Bundesland / Kanton")}
        <div className="ok-field">
          <label>Status</label>
          <select value={f.status} onChange={(e) => set("status", e.target.value)}>
            {(Object.keys(L.STATUS_LABELS) as L.Status[]).map((k) => (
              <option key={k} value={k}>
                {L.STATUS_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="ok-field">
          <label>Anrede</label>
          <select value={f.salutation ?? ""} onChange={(e) => set("salutation", e.target.value)}>
            <option value="">– (Sehr geehrte Damen und Herren)</option>
            <option value="herr">Herr</option>
            <option value="frau">Frau</option>
          </select>
        </div>
        {field("title", "Titel", { placeholder: "z. B. Dr." })}
        {field("first_name", "Vorname")}
        {field("last_name", "Nachname")}
        {field("position", "Funktion", { placeholder: "z. B. Obermeister, Geschäftsführer" })}
        {field("street", "Straße und Hausnummer")}
        {field("zip", "PLZ")}
        {field("city", "Ort")}
        {field("email", "E-Mail", { type: "email" })}
        {field("phone", "Telefon")}
        {field("website", "Website")}
        {field("source", "Quelle der Daten", { placeholder: "z. B. Website der Handwerkskammer" })}
        <div className="ok-field">
          <label>Wiedervorlage</label>
          <input type="date" value={f.next_followup ?? ""} onChange={(e) => set("next_followup", e.target.value || null)} />
        </div>
        <div className="ok-field full">
          <label>Notizen</label>
          <textarea rows={2} value={String(f.notes ?? "")} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>

      {id && saved && (
        <>
          <div className="ok-box">
            <h4>Grundlage für E-Mails</h4>
            <p className="ok-small">
              Werbe-E-Mails sind in DE, AT und CH nur mit Einwilligung erlaubt – auch an Organisationen. Tragen Sie hier ein, wenn die Organisation geantwortet, Informationen
              angefragt oder eingewilligt hat. Erst dann ist „E-Mail senden“ möglich.
            </p>
            <div className="ok-seg">
              {(Object.keys(L.CONSENT_LABELS) as L.Consent[]).map((k) => (
                <button key={k} type="button" className={f.consent_basis === k ? "on" : ""} onClick={() => setConsent(f.consent_basis === k ? "" : k)} disabled={!!f.blocked}>
                  {L.CONSENT_LABELS[k]}
                </button>
              ))}
            </div>
            {f.consent_basis && (
              <p className="ok-small">
                ✓ seit {f.consent_date ? new Date(`${f.consent_date}T12:00:00`).toLocaleDateString("de-DE") : "–"}: {f.consent_note}
              </p>
            )}
            <button type="button" className={`btn ${f.blocked ? "btn-secondary" : "btn-secondary ok-danger"}`} onClick={block}>
              {f.blocked ? "Sperre aufheben" : "⛔ Widerspruch eintragen (sperren)"}
            </button>
          </div>

          <div className="ok-box">
            <h4>Anschreiben</h4>
            <div className="ok-send">
              <div className="ok-field">
                <label>Brief-Vorlage</label>
                <select value={tplId} onChange={(e) => setTplId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Bitte wählen</option>
                  {letterTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-secondary" disabled={!tpl || !!f.blocked || !!busy} onClick={downloadLetter}>
                {busy === "pdf" ? "…" : "📄 Brief als PDF"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!tpl || !!f.blocked || !!busy || !pingen?.configured}
                onClick={() => sendPingen("cheap")}
                title={pingen?.configured ? "" : "Pingen ist noch nicht eingerichtet"}
              >
                {busy === "pingen" ? "Sendet …" : `📮 Per Pingen senden${pingen?.staging ? " (Test)" : ""}`}
              </button>
              <span className="ok-sep" />
              <button type="button" className="btn btn-primary" disabled={!!mailBlock || !!busy} onClick={() => openMail(mailTemplates[0] ?? null)} title={mailBlock ?? ""}>
                ✉️ E-Mail schreiben
              </button>
            </div>
            {mailBlock && <p className="ok-small">E-Mail: {mailBlock}</p>}
            {!pingen?.configured && <p className="ok-small">Pingen: noch nicht eingerichtet – Briefe als PDF herunterladen und selbst verschicken.</p>}
          </div>

          {mail && (
            <div className="ok-box ok-mail">
              <h4>E-Mail an {saved.email}</h4>
              <div className="ok-field">
                <label>Vorlage</label>
                <select onChange={(e) => openMail(mailTemplates.find((t) => t.id === Number(e.target.value)) ?? null)} defaultValue={mailTemplates[0]?.id ?? ""}>
                  {mailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value="">Leer</option>
                </select>
              </div>
              <div className="ok-field">
                <label>Betreff</label>
                <input value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
              </div>
              <div className="ok-field">
                <label>Text</label>
                <textarea rows={10} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
              </div>
              <p className="ok-small">
                Platzhalter werden ersetzt: {"{anrede}"} → „{L.anrede(saved)}“. Unter die E-Mail kommen automatisch Ihre Anschrift, das Impressum und ein Abmelde-Hinweis.
              </p>
              <div className="ok-row-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMail(null)}>
                  Abbrechen
                </button>
                <button type="button" className="btn btn-primary" onClick={sendMail} disabled={busy === "mail"}>
                  {busy === "mail" ? "Sendet …" : "Senden"}
                </button>
              </div>
            </div>
          )}

          <div className="ok-box">
            <div className="ok-row">
              <h4>Verlauf</h4>
              <button type="button" className="btn btn-secondary" onClick={addNote}>
                + Notiz
              </button>
            </div>
            {events.length === 0 ? (
              <p className="ok-small">Noch keine Einträge.</p>
            ) : (
              <ul className="ok-events">
                {events.map((e) => (
                  <li key={e.id}>
                    <b>{L.EVENT_LABELS[e.kind] ?? e.kind}</b>
                    <small>{new Date(e.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</small>
                    {e.subject && <span>{e.subject}</span>}
                    {e.body && <p>{e.body.length > 400 ? `${e.body.slice(0, 400)} …` : e.body}</p>}
                    {e.kind === "brief_pingen" && (
                      <small>
                        Pingen: {String(e.meta?.status ?? "")} {e.meta?.staging ? "(Testumgebung)" : ""}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
