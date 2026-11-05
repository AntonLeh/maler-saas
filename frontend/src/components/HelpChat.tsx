import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseUrl } from "../lib/supabase";
import "./HelpChat.css";

// Hilfe-Chat von maler-saas.com: unten rechts auf der Startseite/den Funktionsseiten und in der App.
// Nicht im Kundenportal (/customer-view), im Fachkräfte-Pool (/fachkraefte) und nicht für Mitarbeiter (Rolle 4).

type Msg = { r: "u" | "b"; t: string };
type State = { id: string | null; m: Msg[] };
type Mode = "public" | "app";

const EMPLOYEE_ROLE_ID = 4;
const HIDDEN_PATHS = /^\/(customer-view|fachkraefte)(\/|$)/;

const GREETING: Record<Mode, string> = {
  public: "Hallo! Ich bin der KI-Assistent von MalerSaaS. Fragen Sie mich gern zu Funktionen, Tarifen und der kostenlosen Testphase.",
  app: "Hallo! Ich bin der KI-Hilfe-Assistent von MalerSaaS. Ich erkläre Ihnen gern Funktionen der App, helfe bei Problemen oder leite Ihre Frage an unser Team weiter.",
};
const SUGGESTIONS: Record<Mode, string[]> = {
  public: ["Welcher Tarif passt zu mir?", "Wie funktioniert die Testphase?", "Was kann der KI-Telefonassistent?"],
  app: ["Wie erstelle ich ein Angebot?", "Wie richte ich das KI-Telefon ein?", "Ich habe ein Problem"],
};

const load = (key: string): State => {
  try {
    const s = JSON.parse(sessionStorage.getItem(key) || "null");
    if (s && Array.isArray(s.m)) return s;
  } catch {
    /* Speicher nicht verfügbar */
  }
  return { id: null, m: [] };
};
const store = (key: string, s: State) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* Speicher nicht verfügbar */
  }
};

/** Links im Text klickbar machen (nur http/https) */
function Linkified({ text }: { text: string }) {
  const parts: (string | { href: string })[] = [];
  const re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ href: m[1] });
    last = m.index + m[1].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
            {p.href.replace(/^https?:\/\//, "")}
          </a>
        )
      )}
    </>
  );
}

/** Aufruf der Funktion help-chat – mit der aktuellen Anmeldung (wie KI-Telefon und Website) */
async function callHelpChat(body: Record<string, unknown>, forceRefresh: boolean): Promise<Response> {
  let token: string | undefined;
  if (body.app) {
    const { data } = forceRefresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
    token = data.session?.access_token;
    // läuft die Anmeldung in der nächsten Minute ab, gleich erneuern
    const exp = data.session?.expires_at;
    if (token && !forceRefresh && exp && exp * 1000 < Date.now() + 60_000) {
      const { data: fresh } = await supabase.auth.refreshSession();
      token = fresh.session?.access_token ?? token;
    }
  }
  return fetch(`${supabaseUrl}/functions/v1/help-chat`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" />
    <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
  </svg>
);

export default function HelpChat() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [mode, setMode] = useState<Mode | null>(null); // null = noch unklar bzw. ausgeblendet

  // Pfad beobachten (die App wechselt Seiten teils per history.replaceState)
  useEffect(() => {
    const t = window.setInterval(() => setPath(window.location.pathname), 1500);
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // Angemeldet? Und welche Rolle?
  useEffect(() => {
    let cancelled = false;
    const decide = async (userId: string | null) => {
      if (!userId) {
        if (!cancelled) setMode("public");
        return;
      }
      const { data } = await supabase.from("app_users").select("role_id").eq("auth_user_id", userId).maybeSingle();
      if (cancelled) return;
      if (!data) setMode(null); // z. B. Kundenportal-Konto oder Profil noch nicht angelegt
      else setMode(Number(data.role_id) === EMPLOYEE_ROLE_ID ? null : "app");
    };
    supabase.auth.getSession().then(({ data }) => decide(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      decide(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!mode || HIDDEN_PATHS.test(path)) return null;
  return <ChatBox key={mode} mode={mode} />;
}

function ChatBox({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false);
  const key = `helpchat:${mode}`;
  const [state, setState] = useState<State>(() => load(key));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);


  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, state, busy]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => taRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ask = useCallback(
    async (raw: string) => {
      const msg = raw.trim();
      if (!msg || busy) return;
      setBusy(true);
      setText("");
      if (taRef.current) taRef.current.style.height = "";
      const before: State = { ...state, m: [...state.m, { r: "u", t: msg }] };
      setState(before);
      store(key, before);
      let reply = "";
      let id = state.id;
      try {
        const body = { chat_id: state.id, message: msg, page: window.location.pathname, app: mode === "app" };
        let res = await callHelpChat(body, false);
        // Anmeldung abgelaufen? Einmal erneuern und nochmal versuchen
        if (res.status === 401 && mode === "app") res = await callHelpChat(body, true);
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && mode === "app") reply = "Ihre Anmeldung ist abgelaufen. Bitte laden Sie die Seite neu oder melden Sie sich erneut an.";
        else {
          reply = data?.reply || data?.error || "Das hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal oder schreiben Sie an info@maler-saas.com.";
          if (data?.chat_id) id = data.chat_id;
        }
      } catch {
        reply = "Die Verbindung hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal.";
      }
      const after: State = { id, m: [...before.m, { r: "b" as const, t: reply }].slice(-60) };
      setState(after);
      store(key, after);
      setBusy(false);
      window.setTimeout(() => taRef.current?.focus(), 0);
    },
    [busy, state, key, mode]
  );

  const reset = () => {
    if (busy) return;
    const s: State = { id: null, m: [] };
    setState(s);
    store(key, s);
    setText("");
    taRef.current?.focus();
  };

  return (
    <div className={`hc${open ? " is-open" : ""}`}>
      {open && (
        <div className="hc-panel" id="hc-panel" role="dialog" aria-label="Hilfe-Chat mit dem KI-Assistenten">
          <div className="hc-head">
            <span className="hc-ava" aria-hidden="true">
              <ChatIcon />
            </span>
            <div>
              <strong>MalerSaaS Hilfe</strong>
              <small>KI-Assistent</small>
            </div>
            <button type="button" className="hc-new" title="Neuen Chat beginnen" aria-label="Neuen Chat beginnen" onClick={reset}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Neu</span>
            </button>
            <button
              type="button"
              className="hc-close"
              aria-label="Chat schließen"
              onClick={() => {
                setOpen(false);
                btnRef.current?.focus();
              }}
            >
              ×
            </button>
          </div>
          <div className="hc-log" ref={logRef} aria-live="polite">
            <div className="hc-msg bot">{GREETING[mode]}</div>
            {state.m.map((x, i) => (
              <div key={i} className={`hc-msg ${x.r === "u" ? "me" : "bot"}`}>
                <Linkified text={x.t} />
              </div>
            ))}
            {busy && <div className="hc-msg bot typing">…</div>}
          </div>
          {state.m.length === 0 && (
            <div className="hc-sug">
              {SUGGESTIONS[mode].map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="hc-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
          >
            <textarea
              ref={taRef}
              rows={1}
              maxLength={1000}
              value={text}
              placeholder="Ihre Frage …"
              aria-label="Ihre Nachricht"
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(text);
                }
              }}
            />
            <button type="submit" aria-label="Senden" disabled={busy || !text.trim()}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
          <p className="hc-note">
            Sie chatten mit einer KI – Antworten können Fehler enthalten. Bitte keine Passwörter oder sensiblen Daten eingeben.{" "}
            <button type="button" className="hc-link" onClick={() => window.dispatchEvent(new Event("malersaas:datenschutz"))}>
              Datenschutz
            </button>
          </p>
        </div>
      )}
      <button ref={btnRef} type="button" className="hc-open" aria-expanded={open} aria-controls="hc-panel" onClick={() => setOpen((o) => !o)}>
        <ChatIcon />
        <span>Hilfe</span>
      </button>
    </div>
  );
}
