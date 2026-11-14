// MalerTreff: Moderation, Owner-Einstellungen, Mitarbeiter-Freigabe durch den Chef
import { useEffect, useMemo, useState } from "react";
import { showConfirm, showPrompt } from "../../lib/dialogs";
import * as api from "./api";
import { ACTION_LABEL, MEMBER_KINDS, reasonLabel, RULES, timeAgo, topicLabel } from "./logic";
import type { ModAction, OwnerOverview, Queue, QueueItem, StaffEntry, VerifyEntry } from "./logic";
import { AuthorLine, Photos } from "./Shared";

const TYPE_LABEL = { post: "Beitrag", comment: "Antwort", member: "Mitglied" } as const;
const STATUS_LABEL: Record<string, string> = { sichtbar: "sichtbar", pruefung: "vorläufig ausgeblendet", ausgeblendet: "ausgeblendet", geloescht: "entfernt", aktiv: "Mitglied aktiv", gesperrt: "gesperrt", wartet: "wartet auf Freigabe" };

export function ModerationPanel({ onChanged }: { onChanged?: () => void }) {
  const [q, setQ] = useState<Queue | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancel = false;
    void api
      .modQueue()
      .then((x) => !cancel && (setQ(x), setErr(null)))
      .catch((e: Error) => !cancel && setErr(e.message));
    return () => {
      cancel = true;
    };
  }, [reload]);
  const done = () => {
    setReload((r) => r + 1);
    onChanged?.();
  };

  const appealDecide = async (id: number, uphold: boolean) => {
    const note = await showPrompt(uphold ? "Kurze Begründung, warum die Entscheidung bestehen bleibt:" : "Kurze Erläuterung für das Mitglied (freiwillig):", {
      multiline: true,
      confirmLabel: uphold ? "Bestätigen" : "Aufheben",
      validate: (v) => (uphold && v.trim().length < 5 ? "Bitte kurz begründen." : null),
    });
    if (note === null) return;
    try {
      await api.modAppeal(id, uphold, note);
      done();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (err) return <p className="cm-msg err">{err}</p>;
  if (!q) return <p className="cm-muted">Lädt …</p>;
  return (
    <div className="cm-mod">
      <p className="cm-small">
        Jede Entscheidung wird mit Begründung an das betroffene Mitglied und an alle Meldenden geschickt und protokolliert. Das Mitglied kann einmal widersprechen.
      </p>
      <h3 className="cm-h3">Zu prüfen ({q.items.length})</h3>
      {q.items.length === 0 && <div className="cm-empty">Alles erledigt – keine offenen Meldungen. 🎉</div>}
      {q.items.map((it) => (
        <ModItem key={`${it.type}-${it.id}`} it={it} onDone={done} onError={setErr} />
      ))}

      {q.appeals.length > 0 && (
        <>
          <h3 className="cm-h3">Widersprüche ({q.appeals.length})</h3>
          {q.appeals.map((a) => (
            <div key={a.id} className="cm-card">
              <AuthorLine a={a.member} />
              <p className="cm-small">
                {TYPE_LABEL[a.type]} {ACTION_LABEL[a.action]} am {new Date(a.created_at).toLocaleDateString("de-DE")} · Regel „{a.rule}“
                {a.note ? ` · ${a.note}` : ""}
              </p>
              {a.excerpt && <blockquote className="cm-quote">{a.excerpt}</blockquote>}
              <p className="cm-body">
                <b>Widerspruch:</b> {a.appeal_text}
              </p>
              <div className="cm-actions left">
                <button type="button" className="btn btn-secondary" onClick={() => appealDecide(a.id, true)}>
                  Entscheidung bestätigen
                </button>
                <button type="button" className="btn btn-primary" onClick={() => appealDecide(a.id, false)}>
                  Maßnahme aufheben
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {q.recent.length > 0 && (
        <>
          <h3 className="cm-h3">Letzte Entscheidungen</h3>
          <div className="cm-table-wrap">
            <table className="cm-table">
              <thead>
                <tr>
                  <th>Wann</th>
                  <th>Was</th>
                  <th>Mitglied</th>
                  <th>Regel</th>
                  <th>Von</th>
                </tr>
              </thead>
              <tbody>
                {q.recent.map((d) => (
                  <tr key={d.id}>
                    <td>{timeAgo(d.created_at)}</td>
                    <td>
                      {TYPE_LABEL[d.type]} {ACTION_LABEL[d.action]}
                      {d.appeal_result ? ` (Widerspruch ${d.appeal_result})` : ""}
                    </td>
                    <td>{d.member?.name ?? "–"}</td>
                    <td>{d.rule}</td>
                    <td>{d.by?.name ?? "Owner"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ModItem({ it, onDone, onError }: { it: QueueItem; onDone: () => void; onError: (m: string) => void }) {
  const [rule, setRule] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const c = it.content;
  const author = c?.author ?? null;

  const decide = async (type: "post" | "comment" | "member", id: number, action: ModAction) => {
    if (action !== "freigeben" && action !== "entsperren" && !rule) return onError("Bitte die verletzte Regel wählen.");
    if (action === "sperren" && !(await showConfirm(`${author?.name ?? "Mitglied"} wirklich sperren?`, { danger: true, confirmLabel: "Sperren" }))) return;
    setBusy(true);
    try {
      await api.modDecide(type, id, action, action === "freigeben" ? "" : rule, note);
      onDone();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`cm-card cm-mod-item${it.danger ? " danger" : ""}`}>
      <div className="cm-mod-head">
        <b>{TYPE_LABEL[it.type]}</b>
        {it.report_count > 0 ? <span>{it.report_count} Meldung(en)</span> : <span>vorläufig ausgeblendet</span>}
        {c?.status && <span className="cm-topic">{STATUS_LABEL[c.status] ?? c.status}</span>}
        {c?.topic && <span className="cm-topic">{topicLabel(c.topic)}</span>}
      </div>
      {it.danger && (
        <p className="cm-msg err">
          Gefahr für Leib und Leben gemeldet. Besteht der Verdacht einer Straftat, die Leben oder Sicherheit bedroht, müssen Sie die Polizei bzw. zuständige Behörde
          sofort informieren (DSA Art. 18).
        </p>
      )}
      <AuthorLine a={author} at={c?.created_at} />
      {c ? <p className="cm-body full">{c.body || "(kein Text)"}</p> : <p className="cm-muted">Inhalt nicht mehr vorhanden.</p>}
      {c?.images && <Photos paths={c.images} small />}
      {Object.keys(it.reasons).length > 0 && (
        <div className="cm-reason-chips">
          {Object.entries(it.reasons).map(([r, n]) => (
            <span key={r}>
              {reasonLabel(r)} · {n}
            </span>
          ))}
        </div>
      )}
      {it.notes.length > 0 && (
        <ul className="cm-notes">
          {it.notes.slice(0, 5).map((n, i) => (
            <li key={i}>„{n}“</li>
          ))}
        </ul>
      )}
      <div className="cm-mod-form">
        <label className="cm-field">
          <span>Verletzte Regel (für Ausblenden, Entfernen, Verwarnen, Sperren)</span>
          <select value={rule} onChange={(e) => setRule(e.target.value)}>
            <option value="">– wählen –</option>
            {RULES.map((r) => (
              <option key={r.short} value={r.short}>
                {r.short}
              </option>
            ))}
            <option value="Gesetzesverstoß">Gesetzesverstoß</option>
          </select>
        </label>
        <label className="cm-field">
          <span>Erläuterung für das Mitglied (freiwillig)</span>
          <input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Auf dem Foto ist ein Kfz-Kennzeichen zu sehen." />
        </label>
      </div>
      <div className="cm-actions left">
        {it.type !== "member" ? (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => decide(it.type, it.id, "freigeben")}>
              ✓ Kein Verstoß
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => decide(it.type, it.id, "ausblenden")}>
              Ausblenden
            </button>
            <button type="button" className="btn btn-secondary danger" disabled={busy} onClick={() => decide(it.type, it.id, "loeschen")}>
              Entfernen
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => decide("member", it.id, "freigeben")}>
            ✓ Kein Verstoß
          </button>
        )}
        {author && author.kind !== "team" && (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => decide("member", author.id, "verwarnen")}>
              Autor verwarnen
            </button>
            <button type="button" className="btn btn-secondary danger" disabled={busy} onClick={() => decide("member", author.id, "sperren")}>
              Autor sperren
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function OwnerSettings({ onChanged }: { onChanged?: () => void }) {
  const [o, setO] = useState<OwnerOverview | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [beta, setBeta] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [extOpen, setExtOpen] = useState<boolean | null>(null);
  useEffect(() => {
    let cancel = false;
    void api.signupOpen().then((v) => !cancel && setExtOpen(v));
    void api
      .ownerOverview()
      .then((x) => {
        if (cancel) return;
        setO(x);
        setEnabled(x.enabled);
        setBeta(x.beta_tenants);
      })
      .catch((e: Error) => !cancel && setMsg({ ok: false, text: e.message }));
    return () => {
      cancel = true;
    };
  }, [reload]);

  const tenants = useMemo(() => (o?.tenants ?? []).filter((t) => t.name.toLowerCase().includes(search.toLowerCase())), [o, search]);

  const save = async () => {
    if (enabled && !o?.enabled) {
      const ok = await showConfirm("Die Community für ALLE Kunden freischalten? Bitte erst, wenn der Anwalt die Community-Regeln geprüft hat.", {
        confirmLabel: "Für alle freischalten",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await api.saveSettings(enabled, beta);
      setMsg({ ok: true, text: "Gespeichert." });
      setReload((r) => r + 1);
      onChanged?.();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const toggleExternal = async (on: boolean) => {
    if (on) {
      const ok = await showConfirm(
        "Anmeldung für Externe öffnen? Dann können sich Betriebe ohne MalerSaaS, Zulieferer und Privatpersonen unter maler-saas.com/malertreff registrieren und die Community sehen. Für Tests kurz öffnen und danach wieder schließen.",
        { confirmLabel: "Öffnen" },
      );
      if (!ok) return;
    }
    try {
      await api.externalSet(on);
      setExtOpen(on);
      onChanged?.();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const toggleMod = async (id: number, on: boolean) => {
    try {
      await api.setModerator(id, on);
      setReload((r) => r + 1);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  if (!o) return msg ? <p className="cm-msg err">{msg.text}</p> : <p className="cm-muted">Lädt …</p>;
  return (
    <div className="cm-owner">
      <div className="cm-kpis">
        <div>
          <span>Aktive Mitglieder</span>
          <b>{o.stats.members_active}</b>
        </div>
        <div>
          <span>Beiträge (7 Tage)</span>
          <b>{o.stats.posts_7d}</b>
        </div>
        <div>
          <span>Antworten (7 Tage)</span>
          <b>{o.stats.comments_7d}</b>
        </div>
        <div className={o.stats.reports_open ? "warn" : ""}>
          <span>Offene Meldungen</span>
          <b>{o.stats.reports_open}</b>
        </div>
        <div>
          <span>Entscheidungen {new Date().getFullYear()}</span>
          <b>{o.stats.decisions_year}</b>
        </div>
      </div>

      <h3 className="cm-h3">Freischaltung</h3>
      <label className="cm-switch">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>
          <b>Für alle Kunden sichtbar</b>
          <small>Aus = nur Sie und die unten gewählten Test-Betriebe sehen die Community.</small>
        </span>
      </label>
      <div className="cm-field">
        <span>Test-Betriebe (Beta)</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Betrieb suchen …" />
      </div>
      <div className="cm-beta">
        {tenants.map((t) => (
          <label key={t.id}>
            <input type="checkbox" checked={beta.includes(t.id)} onChange={(e) => setBeta((b) => (e.target.checked ? [...b, t.id] : b.filter((x) => x !== t.id)))} />
            {t.name}
          </label>
        ))}
        {tenants.length === 0 && <span className="cm-muted">Keine Betriebe gefunden.</span>}
      </div>
      {msg && <p className={`cm-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      <div className="cm-actions left">
        <button type="button" className="btn btn-primary" onClick={save}>
          Speichern
        </button>
      </div>

      <h3 className="cm-h3">Konten für Externe</h3>
      <label className="cm-switch">
        <input type="checkbox" checked={!!extOpen} disabled={extOpen === null} onChange={(e) => toggleExternal(e.target.checked)} />
        <span>
          <b>Anmeldung für Externe offen</b>
          <small>
            Betriebe ohne MalerSaaS, Zulieferer und Privatpersonen unter <a href="/malertreff" target="_blank" rel="noreferrer">maler-saas.com/malertreff</a>. Aus = die Seite zeigt
            „Demnächst“, und externe Konten sehen die Community nicht.
          </small>
        </span>
      </label>

      <h3 className="cm-h3">Mitglieder ({o.members.length})</h3>
      <p className="cm-small">Moderatoren (z. B. Ihre Frau) sehen den Reiter „Moderation“, aber nichts aus Ihrem Owner-Dashboard. Sie müssen dafür Mitglied sein.</p>
      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Art</th>
              <th>Status</th>
              <th>Verwarnungen</th>
              <th>Moderator</th>
            </tr>
          </thead>
          <tbody>
            {o.members.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.display_name}
                  {m.company ? <small className="cm-muted"> · {m.company}</small> : null}
                </td>
                <td>{MEMBER_KINDS[m.kind]}</td>
                <td>{m.status}</td>
                <td>{m.warnings}</td>
                <td>
                  {m.kind === "team" ? (
                    "immer"
                  ) : (
                    <input type="checkbox" checked={m.is_moderator} disabled={m.status !== "aktiv"} onChange={(e) => toggleMod(m.id, e.target.checked)} aria-label="Moderator" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StaffPanel({ onChanged }: { onChanged?: () => void }) {
  const [list, setList] = useState<StaffEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancel = false;
    void api
      .staffList()
      .then((l) => !cancel && setList(l))
      .catch((e: Error) => !cancel && setErr(e.message));
    return () => {
      cancel = true;
    };
  }, [reload]);

  const act = async (s: StaffEntry, action: "freigeben" | "ablehnen" | "entziehen") => {
    let confirm16 = false;
    if (action === "freigeben") {
      confirm16 = await showConfirm(`Ich bestätige, dass ${s.display_name} mindestens 16 Jahre alt ist und der Community beitreten darf.`, {
        title: "Mitarbeiter freigeben",
        confirmLabel: "Freigeben",
      });
      if (!confirm16) return;
    } else if (!(await showConfirm(action === "ablehnen" ? `Anfrage von ${s.display_name} ablehnen?` : `${s.display_name} die Freigabe entziehen?`, { danger: true }))) {
      return;
    }
    try {
      await api.staffDecide(s.id, action, confirm16);
      setReload((r) => r + 1);
      onChanged?.();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (err) return <p className="cm-msg err">{err}</p>;
  if (!list) return <p className="cm-muted">Lädt …</p>;
  return (
    <div>
      <p className="cm-small">Ihre Mitarbeiter treten über ihre App bei. Sie entscheiden, wer mitmachen darf – nur ab 16 Jahren.</p>
      {list.length === 0 && <div className="cm-empty">Noch keine Anfragen von Mitarbeitern.</div>}
      {list.map((s) => (
        <div key={s.id} className="cm-staff">
          <div>
            <b>{s.display_name}</b>
            <small>{s.status === "wartet" ? `möchte beitreten · ${timeAgo(s.created_at)}` : s.status === "aktiv" ? "freigeschaltet" : "von der Moderation gesperrt"}</small>
          </div>
          <div className="cm-actions">
            {s.status === "wartet" && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => act(s, "ablehnen")}>
                  Ablehnen
                </button>
                <button type="button" className="btn btn-primary" onClick={() => act(s, "freigeben")}>
                  Freigeben
                </button>
              </>
            )}
            {s.status === "aktiv" && (
              <button type="button" className="btn btn-secondary" onClick={() => act(s, "entziehen")}>
                Freigabe entziehen
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Moderation: Nachweise externer Betriebe und Zulieferer prüfen */
export function VerifyPanel({ onChanged }: { onChanged?: () => void }) {
  const [list, setList] = useState<VerifyEntry[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    let cancel = false;
    void api
      .verifyList()
      .then((l) => !cancel && setList(l))
      .catch((e: Error) => !cancel && setMsg({ ok: false, text: e.message }));
    return () => {
      cancel = true;
    };
  }, [reload]);

  const open = async (path: string) => {
    const win = window.open("", "_blank");
    try {
      const url = await api.proofUrl(path);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      win?.close();
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const decide = async (v: VerifyEntry, approve: boolean) => {
    let reason = "";
    if (approve) {
      if (!(await showConfirm(`${v.company ?? v.display_name} freischalten?`, { confirmLabel: "Freischalten" }))) return;
    } else {
      const r = await showPrompt("Warum wird der Nachweis abgelehnt? Die Person bekommt den Grund per E-Mail und kann einen neuen Nachweis hochladen.", {
        title: "Nachweis ablehnen",
        multiline: true,
        confirmLabel: "Ablehnen",
        validate: (x) => (x.trim().length < 5 ? "Bitte kurz begründen." : null),
      });
      if (r === null) return;
      reason = r.trim();
    }
    setBusy(v.id);
    setMsg(null);
    try {
      const res = await api.verifyDecide(v.id, approve, reason);
      setMsg({ ok: true, text: `${approve ? "Freigeschaltet" : "Abgelehnt"}.${res.mailed ? " E-Mail wurde verschickt." : " Hinweis: Die E-Mail konnte nicht verschickt werden – die Person sieht das Ergebnis beim nächsten Anmelden."}` });
      setReload((x) => x + 1);
      onChanged?.();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  if (!list) return msg ? <p className="cm-msg err">{msg.text}</p> : <p className="cm-muted">Lädt …</p>;
  const ready = list.filter((v) => v.proof_status === "eingereicht");
  const waiting = list.filter((v) => v.proof_status !== "eingereicht");
  return (
    <div>
      <p className="cm-small">
        Prüfen Sie, ob der Nachweis zum Firmennamen passt und ein Gewerbe im Maler-, Lackierer- oder verwandten Handwerk bzw. ein Zulieferer ist. Nachweise werden 30 Tage nach
        Ihrer Entscheidung automatisch gelöscht.
      </p>
      {msg && <p className={`cm-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      <h3 className="cm-h3">Zu prüfen ({ready.length})</h3>
      {ready.length === 0 && <div className="cm-empty">Keine Nachweise zu prüfen.</div>}
      {ready.map((v) => (
        <div key={v.id} className="cm-card">
          <div className="cm-mod-head">
            <b>{v.company ?? v.display_name}</b>
            <span className="cm-topic">{MEMBER_KINDS[v.kind]}</span>
            <span>seit {timeAgo(v.created_at)}</span>
          </div>
          <p className="cm-small">
            {v.display_name}
            {v.trade ? ` · ${v.trade}` : ""}
            {v.region ? ` · ${v.region}` : ""}
          </p>
          {(v.website || v.impressum_url) && (
            <p className="cm-small">
              {v.website && (
                <a href={v.website} target="_blank" rel="noreferrer nofollow">
                  Website
                </a>
              )}
              {v.website && v.impressum_url && " · "}
              {v.impressum_url && (
                <a href={v.impressum_url} target="_blank" rel="noreferrer nofollow">
                  Impressum
                </a>
              )}
            </p>
          )}
          <div className="cm-actions left">
            {v.proof_path && (
              <button type="button" className="btn btn-secondary" onClick={() => open(v.proof_path!)}>
                📄 Nachweis ansehen
              </button>
            )}
            <button type="button" className="btn btn-secondary danger" disabled={busy === v.id} onClick={() => decide(v, false)}>
              Ablehnen
            </button>
            <button type="button" className="btn btn-primary" disabled={busy === v.id} onClick={() => decide(v, true)}>
              Freischalten
            </button>
          </div>
        </div>
      ))}
      {waiting.length > 0 && (
        <>
          <h3 className="cm-h3">Warten auf Nachweis ({waiting.length})</h3>
          {waiting.map((v) => (
            <div key={v.id} className="cm-staff">
              <div>
                <b>{v.company ?? v.display_name}</b>
                <small>
                  {MEMBER_KINDS[v.kind]} · {v.proof_status === "abgelehnt" ? `abgelehnt: ${v.proof_note ?? ""}` : "noch kein Nachweis hochgeladen"} · {timeAgo(v.created_at)}
                </small>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
