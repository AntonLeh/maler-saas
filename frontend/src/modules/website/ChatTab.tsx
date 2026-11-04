import { useEffect, useState } from "react";
import type { Website, WebsiteChat, WebsiteChatSettings } from "./types";
import { CHAT_MONTHLY_LIMIT } from "./types";
import * as api from "./api";

const fmt = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const firstQuestion = (c: WebsiteChat) => c.messages.find((m) => m.role === "user")?.text ?? "";

/** Website → Chat: KI-Assistent einschalten, Hinweise hinterlegen, Verläufe ansehen */
export default function ChatTab({
  tenantId,
  website,
  companyName,
  saving,
  onSave,
  onError,
}: {
  tenantId: number;
  website: Website;
  companyName?: string | null;
  saving: boolean;
  onSave: (values: Partial<Website>) => void;
  onError: (msg: string) => void;
}) {
  const initial: WebsiteChatSettings = { enabled: false, greeting: "", info: "", ...(website.chat ?? {}) };
  const [enabled, setEnabled] = useState(initial.enabled);
  const [greeting, setGreeting] = useState(initial.greeting);
  const [info, setInfo] = useState(initial.info);
  const [chats, setChats] = useState<WebsiteChat[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [onlyLeads, setOnlyLeads] = useState(false);
  const supported = website.chat !== undefined;
  const dirty = enabled !== initial.enabled || greeting !== initial.greeting || info !== initial.info;

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    api
      .loadChats(tenantId)
      .then((c) => !cancelled && setChats(c))
      .catch((e) => {
        if (cancelled) return;
        setChats([]);
        onError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, supported, onError]);

  if (!supported) {
    return (
      <div className="tk-notice tk-notice-info">
        Für den KI-Chat fehlt noch ein Datenbank-Update (20261104120000_website_chat.sql). Danach erscheint hier die Einstellung.
      </div>
    );
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const usedThisMonth = (chats ?? []).filter((c) => Date.parse(c.updated_at) >= monthStart).reduce((a, c) => a + (c.bot_replies || 0), 0);
  const visible = (chats ?? []).filter((c) => !onlyLeads || c.lead_id);
  const defaultGreeting = `Hallo! Ich bin der digitale KI-Assistent von ${companyName || "Ihrem Betrieb"}. Ich beantworte gern Ihre Fragen zu unseren Leistungen und nehme Ihre Anfrage auf.`;

  const remove = async (id: string) => {
    if (!window.confirm("Diesen Chat-Verlauf löschen?")) return;
    try {
      await api.deleteChat(tenantId, id);
      setChats((list) => (list ?? []).filter((c) => c.id !== id));
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <div className="ws-stack">
      <section className="ws-panel">
        <h3>KI-Chatassistent</h3>
        <p className="tk-muted ws-dom-intro">
          Auf Ihrer Website erscheint unten rechts ein Chat. Der Assistent beantwortet Fragen zu Ihren Leistungen, Ihrem Einsatzgebiet und Ihrer
          Erreichbarkeit – rund um die Uhr. Möchte jemand ein Angebot oder einen Rückruf, nimmt er die Anfrage auf: Sie landet unter „Anfragen“ und
          kommt per E-Mail. Er nennt keine Preise und erfindet nichts – er nutzt nur die Angaben Ihrer Website und die Hinweise unten.
        </p>
        <label className="tk-field ws-check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>
            <strong>Chat auf der Website anzeigen</strong>
          </span>
        </label>
        {enabled && !website.published && <p className="tk-muted">Hinweis: Der Chat funktioniert erst, wenn die Website veröffentlicht ist.</p>}

        <label className="tk-field">
          <span>Begrüßung (optional)</span>
          <input value={greeting} maxLength={300} placeholder={defaultGreeting} onChange={(e) => setGreeting(e.target.value)} />
          <small className="tk-muted">Leer lassen = Standardtext. Der Hinweis, dass es eine KI ist, steht immer im Chat.</small>
        </label>
        <label className="tk-field">
          <span>Was soll der Assistent zusätzlich wissen? (optional)</span>
          <textarea
            rows={5}
            maxLength={2000}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            placeholder={
              "z. B.\n- Termine auch samstags nach Absprache\n- Wir arbeiten nur mit Markenfarben (Caparol, Brillux)\n- Kleinaufträge unter 2 Stunden übernehmen wir leider nicht"
            }
          />
          <small className="tk-muted">
            Leistungen, häufige Fragen, Einsatzgebiet und Erreichbarkeit kennt er schon aus Ihrer Website. Preise nennt er nur, wenn Sie das hier
            ausdrücklich erlauben (z. B. „Richtpreis Innenanstrich: ab 12 € pro m²“).
          </small>
        </label>
        <div className="ws-row ws-bk-save">
          {dirty && <span className="tk-muted">Ungespeicherte Änderungen</span>}
          <button type="button" className="btn btn-primary" disabled={saving || !dirty} onClick={() => onSave({ chat: { enabled, greeting: greeting.trim(), info: info.trim() } })}>
            {saving ? "Speichert …" : "Einstellungen speichern"}
          </button>
        </div>
      </section>

      <section className="ws-panel">
        <div className="ws-row ws-bk-head">
          <h3>Chat-Verläufe</h3>
          <label className="ws-check-inline">
            <input type="checkbox" checked={onlyLeads} onChange={(e) => setOnlyLeads(e.target.checked)} /> Nur Chats anzeigen, aus denen eine Anfrage entstanden ist
          </label>
        </div>
        <p className="tk-muted">
          {usedThisMonth.toLocaleString("de-DE")} von {CHAT_MONTHLY_LIMIT.toLocaleString("de-DE")} Antworten in diesem Monat · Verläufe werden nach 90 Tagen
          automatisch gelöscht.
        </p>
        {chats === null ? (
          <p className="tk-muted">Wird geladen …</p>
        ) : visible.length === 0 ? (
          <p className="tk-muted">Noch keine Chats{onlyLeads ? " mit Anfrage" : ""}.</p>
        ) : (
          <ul className="ws-chat-list">
            {visible.map((c) => (
              <li key={c.id}>
                <button type="button" className="ws-chat-row" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                  <span className="ws-chat-date">{fmt(c.updated_at)}</span>
                  <span className="ws-chat-q">{firstQuestion(c) || "–"}</span>
                  <span className="ws-chat-meta">
                    {c.lead_id ? <span className="ws-app-badge neu">Anfrage</span> : null} {c.messages.filter((m) => m.role === "user").length} Nachr.
                  </span>
                </button>
                {open === c.id && (
                  <div className="ws-chat-log">
                    {c.messages.map((m, i) => (
                      <div key={i} className={`ws-chat-msg ${m.role === "user" ? "me" : "bot"}`}>
                        <small>{m.role === "user" ? "Besucher" : "Assistent"} · {new Date(m.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</small>
                        <p>{m.text}</p>
                      </div>
                    ))}
                    <div className="ws-row">
                      {c.page ? <span className="tk-muted">Seite: /{c.page}</span> : <span className="tk-muted">Seite: Startseite</span>}
                      <button type="button" className="ws-link ws-danger" onClick={() => remove(c.id)}>
                        Verlauf löschen
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
