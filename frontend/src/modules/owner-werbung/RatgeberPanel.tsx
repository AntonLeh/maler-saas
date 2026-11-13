// SEO-Agent: Ratgeber-Artikel für maler-saas.com/ratgeber – Themen vorschlagen, schreiben lassen, prüfen, veröffentlichen
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import * as L from "./logic";
import type { Article, ArticleFaq, KeywordIdea } from "./logic";

type Props = { onClose: () => void };
const SITE = "https://maler-saas.com";
const INTENT: Record<KeywordIdea["intent"], string> = { information: "Information", vergleich: "Vergleich", kauf: "Kaufabsicht" };

/** **fett** und [Link](/pfad) für die Vorschau – ohne HTML */
function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[a-z0-9/-]*)\)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={k++}>{m[1]}</strong>);
    else
      parts.push(
        <a key={k++} href={`${SITE}${m[3]}`} target="_blank" rel="noreferrer">
          {m[2]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Preview({ a }: { a: Pick<Article, "title" | "intro" | "body" | "faq"> }) {
  return (
    <div className="ow2-art-preview">
      <h1>{a.title}</h1>
      {a.intro && (
        <p className="intro">
          <Inline text={a.intro} />
        </p>
      )}
      {L.mdBlocks(a.body).map((b, i) =>
        b.t === "ul" ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Inline text={it} />
              </li>
            ))}
          </ul>
        ) : b.t === "h2" ? (
          <h2 key={i}>{b.text}</h2>
        ) : b.t === "h3" ? (
          <h3 key={i}>{b.text}</h3>
        ) : (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        ),
      )}
      {a.faq.length > 0 && (
        <>
          <h2>Häufige Fragen</h2>
          {a.faq.map((f, i) => (
            <details key={i}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </>
      )}
    </div>
  );
}

function Editor({ article, onSaved, onClose, onDeleted }: { article: Article; onSaved: (a: Article) => void; onClose: () => void; onDeleted: () => void }) {
  const [a, setA] = useState<Article>(article);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"text" | "vorschau">("text");
  const set = (patch: Partial<Article>) => setA((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(a) !== JSON.stringify(article);
  const words = L.wordCount(a.body);
  const url = `${SITE}/ratgeber/${a.slug}`;

  const save = async (extra: Partial<Article> = {}) => {
    setBusy("save");
    setMsg(null);
    try {
      const next = { ...a, ...extra, slug: L.slugify(a.slug) || L.slugify(a.title) };
      const saved = await api.saveArticle(a.id, {
        slug: next.slug,
        keyword: next.keyword,
        title: next.title.trim(),
        meta_title: next.meta_title.trim(),
        meta_description: next.meta_description.trim(),
        intro: next.intro,
        body: next.body,
        faq: next.faq.filter((f) => f.q.trim() && f.a.trim()),
        related_pages: next.related_pages,
        status: next.status,
        published_at: next.published_at,
      });
      setA(saved);
      onSaved(saved);
      setMsg({ ok: true, text: extra.status === "veroeffentlicht" ? `Veröffentlicht: ${url}` : extra.status === "entwurf" ? "Zurückgezogen – der Artikel ist nicht mehr öffentlich." : "Gespeichert." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const publish = () => save({ status: "veroeffentlicht", published_at: a.published_at ?? new Date().toISOString() });
  const unpublish = () => save({ status: "entwurf" });
  const remove = async () => {
    if (!(await showConfirm(`Artikel „${a.title}“ löschen?${a.status === "veroeffentlicht" ? " Er ist dann auch nicht mehr öffentlich." : ""}`, { danger: true, confirmLabel: "Löschen" }))) return;
    try {
      await api.deleteArticle(a.id);
      onDeleted();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  const close = async () => {
    if (dirty && !(await showConfirm("Änderungen sind nicht gespeichert. Trotzdem schließen?", { confirmLabel: "Schließen", cancelLabel: "Weiter bearbeiten" }))) return;
    onClose();
  };
  const setFaq = (i: number, patch: Partial<ArticleFaq>) => set({ faq: a.faq.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  return (
    <div className="ow2-card ow2-art">
      <div className="ow2-ed-head">
        <input className="ow2-title" value={a.title} onChange={(e) => set({ title: e.target.value })} aria-label="Titel" />
        <div className="ow2-ed-actions">
          <button type="button" className="btn btn-secondary" onClick={remove}>
            Löschen
          </button>
          <button type="button" className="btn btn-secondary" onClick={close}>
            Schließen
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => save()} disabled={!!busy}>
            {busy === "save" ? "Speichert …" : dirty ? "Speichern •" : "Speichern"}
          </button>
          {a.status === "veroeffentlicht" ? (
            <button type="button" className="btn btn-secondary" onClick={unpublish} disabled={!!busy}>
              Zurückziehen
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={publish} disabled={!!busy || words < 300}>
              ✅ Geprüft – veröffentlichen
            </button>
          )}
        </div>
      </div>
      {msg && <p className={`ow2-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      {a.status === "veroeffentlicht" && (
        <p className="ow2-small">
          Öffentlich unter{" "}
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </p>
      )}

      <div className="ow2-serp">
        <small>So erscheint der Artikel ungefähr bei Google:</small>
        <span className="u">maler-saas.com › ratgeber › {a.slug || "…"}</span>
        <b>
          {(a.meta_title || a.title).slice(0, 60)} | MalerSaaS
        </b>
        <span>{a.meta_description || a.intro.slice(0, 155)}</span>
      </div>

      <div className="ow2-form">
        <div className="ow2-field">
          <label>Suchbegriff</label>
          <input value={a.keyword} onChange={(e) => set({ keyword: e.target.value })} />
        </div>
        <div className="ow2-field">
          <label>Adresse (Slug)</label>
          <input value={a.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} disabled={a.status === "veroeffentlicht"} />
          {a.status === "veroeffentlicht" && <small>Nach dem Veröffentlichen nicht mehr änderbar (sonst funktionieren Links nicht mehr).</small>}
        </div>
        <div className="ow2-field">
          <label>
            Meta-Titel <span className={a.meta_title.length > 60 ? "over" : ""}>{a.meta_title.length}/60</span>
          </label>
          <input value={a.meta_title} onChange={(e) => set({ meta_title: e.target.value })} />
        </div>
        <div className="ow2-field">
          <label>
            Meta-Beschreibung <span className={a.meta_description.length > 155 ? "over" : ""}>{a.meta_description.length}/155</span>
          </label>
          <input value={a.meta_description} onChange={(e) => set({ meta_description: e.target.value })} />
        </div>
      </div>

      <div className="ow2-tabs" role="tablist">
        <button type="button" className={tab === "text" ? "on" : ""} onClick={() => setTab("text")}>
          Text bearbeiten
        </button>
        <button type="button" className={tab === "vorschau" ? "on" : ""} onClick={() => setTab("vorschau")}>
          Vorschau
        </button>
        <span className="ow2-small">{words} Wörter</span>
      </div>

      {tab === "vorschau" ? (
        <Preview a={a} />
      ) : (
        <>
          <div className="ow2-field">
            <label>Einleitung</label>
            <textarea rows={3} value={a.intro} onChange={(e) => set({ intro: e.target.value })} />
          </div>
          <div className="ow2-field">
            <label>Artikel („## “ = Zwischenüberschrift, „- “ = Aufzählung, **fett**, [Linktext](/zeiterfassung) = Verweis)</label>
            <textarea rows={22} value={a.body} onChange={(e) => set({ body: e.target.value })} className="ow2-mono" />
          </div>
          <div className="ow2-field">
            <label>Häufige Fragen (FAQ)</label>
            {a.faq.map((f, i) => (
              <div key={i} className="ow2-faq">
                <input value={f.q} placeholder="Frage" onChange={(e) => setFaq(i, { q: e.target.value })} />
                <textarea rows={2} value={f.a} placeholder="Antwort" onChange={(e) => setFaq(i, { a: e.target.value })} />
                <button type="button" className="ow2-link" onClick={() => set({ faq: a.faq.filter((_, j) => j !== i) })}>
                  Entfernen
                </button>
              </div>
            ))}
            {a.faq.length < 6 && (
              <button type="button" className="ow2-link" onClick={() => set({ faq: [...a.faq, { q: "", a: "" }] })}>
                + Frage hinzufügen
              </button>
            )}
          </div>
          <div className="ow2-field">
            <label>Passende Funktionsseiten (unten im Artikel)</label>
            <div className="ow2-days">
              {Object.entries(L.FEATURE_PAGES).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  className={a.related_pages.includes(k) ? "on wide" : "wide"}
                  onClick={() => set({ related_pages: a.related_pages.includes(k) ? a.related_pages.filter((p) => p !== k) : [...a.related_pages, k].slice(0, 3) })}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <p className="ow2-note">
        Bitte vor dem Veröffentlichen lesen: Stimmen Fakten, Gesetze und Fristen? Der Artikel enthält automatisch den Hinweis, dass er keine Rechts- oder Steuerberatung ersetzt.
      </p>
    </div>
  );
}

export default function RatgeberPanel({ onClose }: Props) {
  const [articles, setArticles] = useState<Article[] | null | undefined>(undefined);
  const [ideas, setIdeas] = useState<KeywordIdea[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [own, setOwn] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const reload = async () => setArticles(await api.loadArticles());
  useEffect(() => {
    let cancel = false;
    void api.loadArticles().then((r) => !cancel && setArticles(r));
    return () => {
      cancel = true;
    };
  }, []);

  const suggest = async () => {
    setBusy("ideas");
    setMsg(null);
    try {
      setIdeas(await api.keywordIdeas());
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const write = async (keyword: string, title = "", reason: string | null = null) => {
    setBusy(`write:${keyword}`);
    setMsg(null);
    try {
      const d = await api.writeArticle(keyword, title);
      let slug = d.slug;
      const taken = new Set((articles ?? []).map((x) => x.slug));
      for (let i = 2; taken.has(slug); i++) slug = `${d.slug}-${i}`;
      const saved = await api.saveArticle(null, { ...d, slug, status: "entwurf", reason });
      setIdeas((list) => (list ?? []).filter((x) => x.keyword !== keyword));
      await reload();
      setOpenId(saved.id);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const open = (articles ?? []).find((x) => x.id === openId) ?? null;
  if (open)
    return (
      <Editor
        key={open.id}
        article={open}
        onSaved={(a) => setArticles((list) => (list ?? []).map((x) => (x.id === a.id ? a : x)))}
        onClose={() => setOpenId(null)}
        onDeleted={() => {
          setOpenId(null);
          void reload();
        }}
      />
    );

  return (
    <div className="ow2-card ow2-art">
      <div className="ow2-agent-head">
        <div>
          <h3>📝 Ratgeber (SEO-Agent)</h3>
          <p className="ow2-small">
            Artikel auf maler-saas.com/ratgeber bringen langfristig kostenlose Besucher über Google. Der Agent schlägt Suchbegriffe vor und schreibt die Artikel – veröffentlicht wird nur, was Sie
            freigeben.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy.startsWith("write")}>
          Schließen
        </button>
      </div>

      {articles === null ? (
        <p className="ow2-msg err">Für den Ratgeber fehlt noch das Datenbank-Update (SQL „Ratgeber“).</p>
      ) : (
        <>
          <div className="ow2-lib-bar">
            <button type="button" className="btn btn-primary" onClick={suggest} disabled={!!busy}>
              {busy === "ideas" ? "Agent sucht Themen … (ca. 30 Sek.)" : "🔎 Themen vorschlagen"}
            </button>
            <input className="ow2-lib-search" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Oder eigener Suchbegriff, z. B. Stundenzettel Maler Vorlage" />
            <button type="button" className="btn btn-secondary" onClick={() => own.trim() && write(own.trim())} disabled={!!busy || !own.trim()}>
              ✍️ Artikel schreiben
            </button>
          </div>
          {busy.startsWith("write:") && <p className="ow2-msg ok">✍️ Der Agent schreibt den Artikel „{busy.slice(6)}“ … das dauert etwa 1 Minute.</p>}
          {msg && <p className={`ow2-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}

          {ideas && ideas.length > 0 && (
            <div className="ow2-proposals">
              <b>Vorschläge für neue Artikel</b>
              {ideas.map((it) => (
                <div key={it.keyword} className="ow2-prop">
                  <div className="ow2-prop-main">
                    <div className="ow2-prop-row">
                      <span className={`ow2-prio p${it.priority}`}>{it.priority === 1 ? "zuerst" : it.priority === 2 ? "bald" : "später"}</span>
                      <span className="ow2-small">{INTENT[it.intent]}</span>
                    </div>
                    <b>„{it.keyword}“</b>
                    <span>{it.title}</span>
                    <small>💡 {it.reason}</small>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => write(it.keyword, it.title, it.reason)} disabled={!!busy}>
                    ✍️ Schreiben
                  </button>
                </div>
              ))}
            </div>
          )}

          <h4 className="ow2-h4">Artikel</h4>
          {articles === undefined ? (
            <p className="ow2-empty">Lädt …</p>
          ) : articles.length === 0 ? (
            <p className="ow2-empty">Noch keine Artikel. Tippen Sie auf „🔎 Themen vorschlagen“.</p>
          ) : (
            <ul className="ow2-list">
              {articles.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => setOpenId(x.id)}>
                    <span className={`ow2-status s-${x.status === "veroeffentlicht" ? "veroeffentlicht" : "freigabe"}`}>{x.status === "veroeffentlicht" ? "Online" : "Entwurf"}</span>
                    <span className="ow2-li-main">
                      <b>{x.title}</b>
                      <small>
                        „{x.keyword}“ · /ratgeber/{x.slug}
                        {x.published_at ? ` · seit ${new Date(x.published_at).toLocaleDateString("de-DE")}` : ""}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="ow2-note">
            Tipp: Nach dem ersten veröffentlichten Artikel in der Google Search Console unter „Sitemaps“ einmal <code>https://maler-saas.com/ratgeber/sitemap.xml</code> eintragen. Besucher, die
            über einen Artikel kommen und sich registrieren, erscheinen unter „📈 Erfolg“ als Kanal „Ratgeber“.
          </p>
        </>
      )}
    </div>
  );
}
