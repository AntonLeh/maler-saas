// MalerTreff: Regeln, Benachrichtigungen mit Widerspruch, Profile
import { useEffect, useState } from "react";
import { showAlert, showPrompt } from "../../lib/dialogs";
import * as api from "./api";
import { Feed } from "./Feed";
import { CONTACT_EMAIL, initials, isDraftRules, MEMBER_KINDS, RULES, timeAgo } from "./logic";
import type { Member, Notice, Profile } from "./logic";
import { ReportDialog } from "./Shared";

export function RulesList({ version }: { version: string }) {
  return (
    <div className="cm-rules">
      {isDraftRules(version) && <p className="cm-msg warn">Entwurf – die Regeln werden vor dem offiziellen Start anwaltlich geprüft.</p>}
      <ol>
        {RULES.map((r) => (
          <li key={r.short}>
            <b>{r.short}.</b> {r.text}
          </li>
        ))}
      </ol>
      <p className="cm-small">
        Kontaktstelle für Nutzer und Behörden: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Wer nicht Mitglied ist, kann rechtswidrige Inhalte ebenfalls an diese
        Adresse melden.
      </p>
    </div>
  );
}

export function Notices({ onOpenPost, onRead }: { onOpenPost?: (id: number) => void; onRead?: () => void }) {
  const [list, setList] = useState<Notice[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancel = false;
    void api
      .notices()
      .then(async (l) => {
        if (cancel) return;
        setList(l);
        if (l.some((n) => !n.read)) {
          await api.noticesRead().catch(() => undefined);
          onRead?.();
        }
      })
      .catch((e: Error) => !cancel && setErr(e.message));
    return () => {
      cancel = true;
    };
  }, [reload, onRead]);

  const appeal = async (n: Notice) => {
    const text = await showPrompt("Warum ist die Entscheidung aus Ihrer Sicht falsch? Die Moderation prüft Ihren Widerspruch erneut.", {
      title: "Widerspruch einlegen",
      multiline: true,
      confirmLabel: "Widerspruch senden",
      validate: (v) => (v.trim().length < 10 ? "Bitte mindestens 10 Zeichen schreiben." : null),
    });
    if (!text || !n.decision) return;
    try {
      await api.appeal(n.decision.id, text.trim());
      await showAlert("Ihr Widerspruch ist eingegangen. Sie bekommen hier eine Nachricht mit dem Ergebnis.", { tone: "success" });
      setReload((r) => r + 1);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (err) return <p className="cm-msg err">{err}</p>;
  if (!list) return <p className="cm-muted">Lädt …</p>;
  if (!list.length) return <div className="cm-empty">Keine Benachrichtigungen.</div>;
  return (
    <div className="cm-notices">
      {list.map((n) => (
        <div key={n.id} className={`cm-notice k-${n.kind}${n.read ? "" : " unread"}`}>
          <p>{n.text}</p>
          <div className="cm-notice-foot">
            <small>{timeAgo(n.created_at)}</small>
            {n.post_id && onOpenPost && (
              <button type="button" className="cm-link" onClick={() => onOpenPost(n.post_id!)}>
                Zum Beitrag
              </button>
            )}
            {n.decision?.can_appeal && (
              <button type="button" className="btn btn-secondary" onClick={() => appeal(n)}>
                Widerspruch einlegen
              </button>
            )}
            {n.decision?.appeal_at && !n.decision.appeal_result && <small className="cm-pending">Widerspruch wird geprüft</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MyProfile({ me, onSaved }: { me: Member; onSaved: () => void }) {
  const [trade, setTrade] = useState(me.trade ?? "");
  const [region, setRegion] = useState(me.region ?? "");
  const [bio, setBio] = useState(me.bio ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    try {
      await api.updateProfile(trade, region, bio);
      setMsg({ ok: true, text: "Profil gespeichert." });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  return (
    <div className="cm-profile-edit">
      <div className="cm-profile-head">
        <span className={`cm-avatar big k-${me.kind}`}>{initials(me.display_name)}</span>
        <div>
          <b>{me.display_name}</b>
          <small>
            {MEMBER_KINDS[me.kind]}
            {me.company ? ` · ${me.company}` : ""}
          </small>
          <small className="cm-muted">Name und Firma kommen aus Ihrem MalerSaaS-Konto.</small>
        </div>
      </div>
      <label className="cm-field">
        <span>Gewerk / Spezialgebiet</span>
        <input value={trade} maxLength={80} onChange={(e) => setTrade(e.target.value)} placeholder="z. B. Malermeister, Fassaden, Lackierer" />
      </label>
      <label className="cm-field">
        <span>Region</span>
        <input value={region} maxLength={80} onChange={(e) => setRegion(e.target.value)} placeholder="z. B. Oberfranken" />
      </label>
      <label className="cm-field">
        <span>Über mich</span>
        <textarea rows={3} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ein, zwei Sätze für die Kollegen" />
      </label>
      {msg && <p className={`cm-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      <div className="cm-actions">
        <button type="button" className="btn btn-primary" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  );
}

export function ProfileView({ id, me, onBack, onOpenPost }: { id: number; me: Member; onBack: () => void; onOpenPost: (id: number) => void }) {
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [report, setReport] = useState(false);
  useEffect(() => {
    let cancel = false;
    void api
      .profile(id)
      .then((x) => !cancel && setP(x))
      .catch(() => !cancel && setP(null));
    return () => {
      cancel = true;
    };
  }, [id]);
  return (
    <div>
      <button type="button" className="cm-back" onClick={onBack}>
        ← Zurück
      </button>
      {p === undefined && <p className="cm-muted">Lädt …</p>}
      {p === null && <p className="cm-msg err">Dieses Profil ist nicht verfügbar.</p>}
      {p && (
        <div className="cm-card">
          <div className="cm-profile-head">
            <span className={`cm-avatar big k-${p.kind}`}>{initials(p.display_name)}</span>
            <div>
              <b>{p.display_name}</b>
              <small>
                {p.is_mod && p.kind !== "team" ? "Moderation · " : ""}
                {MEMBER_KINDS[p.kind]}
                {p.company ? ` · ${p.company}` : ""}
              </small>
              <small className="cm-muted">{[p.trade, p.region].filter(Boolean).join(" · ")}</small>
            </div>
          </div>
          {p.bio && <p className="cm-body full">{p.bio}</p>}
          <div className="cm-stats">
            <span>
              <b>{p.posts}</b> Beiträge
            </span>
            <span>
              <b>{p.solutions}</b> Lösungen
            </span>
            <span>Dabei seit {new Date(p.since).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</span>
          </div>
          {p.id !== me.id && (
            <div className="cm-foot">
              <button type="button" onClick={() => setReport(true)}>
                🚩 Mitglied melden
              </button>
            </div>
          )}
        </div>
      )}
      {p && (
        <>
          <h3 className="cm-h3">Beiträge</h3>
          <Feed me={me} author={p.id} onOpenPost={onOpenPost} onOpenProfile={() => undefined} />
        </>
      )}
      {report && p && <ReportDialog type="member" id={p.id} onClose={() => setReport(false)} />}
    </div>
  );
}
