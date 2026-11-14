// MalerTreff-Community (Stufe 1): Beitritt mit Regeln, Feed, Benachrichtigungen, Profil, Chef-Freigabe, Moderation, Owner-Einstellungen
import { useCallback, useEffect, useState } from "react";
import * as api from "./api";
import { ModerationPanel, OwnerSettings, StaffPanel, VerifyPanel } from "./Admin";
import { MalerSaaSHint, ProofCard } from "./External";
import { MyProfile, Notices, ProfileView, RulesList } from "./Extras";
import { Feed, PostDetail } from "./Feed";
import { COMMUNITY_NAME, needsJoin } from "./logic";
import type { Access } from "./logic";
import "./cm.css";

type Tab = "feed" | "notices" | "profile" | "staff" | "mod" | "verify" | "owner" | "rules";
type Props = { onBack?: () => void; isChef?: boolean; onAccountDeleted?: () => void };

export default function CommunityPage({ onBack, isChef = false, onAccountDeleted }: Props) {
  const [access, setAccess] = useState<Access | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("feed");
  const [postId, setPostId] = useState<number | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((r) => r + 1), []);

  useEffect(() => {
    let cancel = false;
    void api.loadAccess().then((a) => !cancel && setAccess(a));
    return () => {
      cancel = true;
    };
  }, [reload]);

  const go = (t: Tab) => {
    setTab(t);
    setPostId(null);
    setProfileId(null);
  };
  const openPost = (id: number) => {
    setTab("feed");
    setProfileId(null);
    setPostId(id);
  };
  const openProfile = (id: number) => {
    setPostId(null);
    setProfileId(id);
  };

  const me = access?.member ?? null;
  const active = !!access?.enabled && me?.status === "aktiv" && !needsJoin(access);

  return (
    <section className="single-page-section cm-root">
      <div className="card">
        <div className="page-topbar">
          <div>
            <h2>💬 {COMMUNITY_NAME}</h2>
            <p>Die Community für Maler, Lackierer und verwandte Gewerke – Fragen stellen, Projekte zeigen, voneinander lernen.</p>
          </div>
          {onBack && (
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={onBack}>
              Zurück
            </button>
          )}
        </div>

        {access === undefined && <p className="cm-muted">Lädt …</p>}
        {access === null && <p className="cm-msg err">{api.NEEDS_SQL}</p>}
        {access && !access.enabled && <p className="cm-msg warn">Die Community ist noch nicht freigeschaltet.</p>}
        {access?.enabled && needsJoin(access) && <JoinCard access={access} onJoined={setAccess} />}
        {access?.enabled && !needsJoin(access) && me?.status === "wartet" && access.external && (me.kind === "betrieb" || me.kind === "zulieferer") && (
          <ProofCard me={me} onDone={refresh} />
        )}
        {access?.enabled && !needsJoin(access) && me?.status === "wartet" && !access.external && (
          <div className="cm-msg warn">
            Ihre Anfrage ist eingegangen. Ihr Chef muss Sie noch freischalten – er hat eine Nachricht bekommen.
          </div>
        )}
        {access?.enabled && !needsJoin(access) && me?.status === "gesperrt" && (
          <>
            <div className="cm-msg err">Ihr Zugang zur Community ist gesperrt. Die Begründung und die Möglichkeit zum Widerspruch finden Sie hier:</div>
            <Notices onRead={refresh} />
          </>
        )}

        {active && access && me && (
          <>
            <nav className="cm-tabs" aria-label="Community-Bereiche">
              <button type="button" className={tab === "feed" ? "on" : ""} onClick={() => go("feed")}>
                Feed
              </button>
              <button type="button" className={tab === "notices" ? "on" : ""} onClick={() => go("notices")}>
                Benachrichtigungen{access.unread > 0 && <span className="cm-dot">{access.unread}</span>}
              </button>
              <button type="button" className={tab === "profile" ? "on" : ""} onClick={() => go("profile")}>
                Mein Profil
              </button>
              {isChef && (
                <button type="button" className={tab === "staff" ? "on" : ""} onClick={() => go("staff")}>
                  Mitarbeiter{access.staff_pending > 0 && <span className="cm-dot">{access.staff_pending}</span>}
                </button>
              )}
              {access.is_mod && (
                <button type="button" className={tab === "mod" ? "on" : ""} onClick={() => go("mod")}>
                  Moderation
                </button>
              )}
              {access.is_mod && (
                <button type="button" className={tab === "verify" ? "on" : ""} onClick={() => go("verify")}>
                  Freigaben{(access.verify_pending ?? 0) > 0 && <span className="cm-dot">{access.verify_pending}</span>}
                </button>
              )}
              {access.is_owner && (
                <button type="button" className={tab === "owner" ? "on" : ""} onClick={() => go("owner")}>
                  Einstellungen
                </button>
              )}
              <button type="button" className={tab === "rules" ? "on" : ""} onClick={() => go("rules")}>
                Regeln
              </button>
            </nav>

            {profileId != null ? (
              <ProfileView id={profileId} me={me} onBack={() => setProfileId(null)} onOpenPost={openPost} />
            ) : tab === "feed" && postId != null ? (
              <PostDetail id={postId} me={me} onBack={() => setPostId(null)} onOpenProfile={openProfile} />
            ) : tab === "feed" ? (
              <>
                {access.external && me.kind === "betrieb" && <MalerSaaSHint />}
                <Feed me={me} onOpenPost={openPost} onOpenProfile={openProfile} />
              </>
            ) : tab === "notices" ? (
              <Notices onOpenPost={openPost} onRead={refresh} />
            ) : tab === "profile" ? (
              <MyProfile me={me} onSaved={refresh} external={!!access.external} onDeleted={onAccountDeleted} />
            ) : tab === "staff" ? (
              <StaffPanel onChanged={refresh} />
            ) : tab === "mod" ? (
              <ModerationPanel onChanged={refresh} />
            ) : tab === "verify" ? (
              <VerifyPanel onChanged={refresh} />
            ) : tab === "owner" ? (
              <OwnerSettings onChanged={refresh} />
            ) : (
              <RulesList version={access.rules_version} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function JoinCard({ access, onJoined }: { access: Access; onJoined: (a: Access) => void }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const again = !!access.member;
  const join = async () => {
    setBusy(true);
    setErr(null);
    try {
      onJoined(await api.join(access.rules_version));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cm-join">
      <h3>{again ? "Die Community-Regeln wurden geändert" : `Willkommen im ${COMMUNITY_NAME}!`}</h3>
      {!again && (
        <ul className="cm-join-points">
          <li>Fachfragen stellen und Kollegen helfen</li>
          <li>Projekte mit Fotos zeigen</li>
          <li>
            {access.external
              ? "Sie erscheinen mit den Angaben aus Ihrer Anmeldung – E-Mail-Adresse bleibt verborgen"
              : "Sie erscheinen mit Ihrem Namen und Ihrer Firma aus MalerSaaS – Adresse und Telefon bleiben verborgen"}
          </li>
        </ul>
      )}
      <RulesList version={access.rules_version} />
      <label className="cm-check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        Ich habe die Community-Regeln gelesen und halte mich daran.
      </label>
      {err && <p className="cm-msg err">{err}</p>}
      <div className="cm-actions left">
        <button type="button" className="btn btn-primary" disabled={!ok || busy} onClick={join}>
          {busy ? "Einen Moment …" : again ? "Regeln bestätigen" : "Jetzt beitreten"}
        </button>
      </div>
    </div>
  );
}
