// MalerTreff: Feed, neuer Beitrag, Beitrag mit Antworten
import { useEffect, useMemo, useRef, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import { allowedKinds, MAX_COMMENT, MAX_IMAGES, MAX_POST, PHOTO_HINT, POST_KINDS, TOPICS, topicLabel, validatePost } from "./logic";
import type { Member, Post, PostKind } from "./logic";
import { AuthorLine, Photos, ReportDialog } from "./Shared";

type FeedProps = { me: Member; author?: number | null; onOpenPost: (id: number) => void; onOpenProfile: (id: number) => void };

export function Feed({ me, author = null, onOpenPost, onOpenProfile }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [reload, setReload] = useState(0);
  const [composer, setComposer] = useState(false);

  useEffect(() => {
    let cancel = false;
    void api
      .feed({ topic: topic || null, author, query: q || null })
      .then((list) => {
        if (cancel) return;
        setPosts(list ?? []);
        setMore((list ?? []).length === 20);
        setErr(null);
      })
      .catch((e: Error) => !cancel && setErr(e.message))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [topic, author, q, reload]);

  const loadMore = async () => {
    const last = posts[posts.length - 1];
    if (!last) return;
    try {
      const list = await api.feed({ topic: topic || null, author, query: q || null, before: last.id });
      setPosts((p) => [...p, ...list]);
      setMore(list.length === 20);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const toggleHelpful = async (p: Post) => {
    try {
      const on = await api.helpful(p.id, null);
      setPosts((list) => list.map((x) => (x.id === p.id ? { ...x, helpful_by_me: on, helpful_count: x.helpful_count + (on ? 1 : -1) } : x)));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="cm-feed">
      {author == null && (
        <>
          {composer ? (
            <Composer
              me={me}
              onCancel={() => setComposer(false)}
              onCreated={() => {
                setComposer(false);
                setTopic("");
                setQ("");
                setQuery("");
                setReload((r) => r + 1);
              }}
            />
          ) : (
            <button type="button" className="cm-compose-open" onClick={() => setComposer(true)}>
              <span>✏️</span> Frage stellen, Projekt zeigen oder Tipp teilen …
            </button>
          )}
          <div className="cm-filter">
            <select value={topic} onChange={(e) => (setLoading(true), setTopic(e.target.value))} aria-label="Thema">
              <option value="">Alle Themen</option>
              {TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLoading(true);
                setQ(query.trim());
              }}
            >
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen, z. B. Nikotin" aria-label="Suchen" />
              <button type="submit" className="btn btn-secondary">
                Suchen
              </button>
            </form>
          </div>
        </>
      )}

      {err && <p className="cm-msg err">{err}</p>}
      {loading && <p className="cm-muted">Lädt …</p>}
      {!loading && !err && posts.length === 0 && (
        <div className="cm-empty">
          {q || topic ? "Keine Beiträge gefunden." : author != null ? "Noch keine Beiträge." : "Noch ist es ruhig hier – stellen Sie die erste Frage!"}
        </div>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} p={p} onOpen={() => onOpenPost(p.id)} onOpenProfile={onOpenProfile} onHelpful={() => toggleHelpful(p)} />
      ))}
      {more && (
        <button type="button" className="btn btn-secondary cm-more" onClick={loadMore}>
          Weitere Beiträge laden
        </button>
      )}
    </div>
  );
}

function PostCard({ p, onOpen, onOpenProfile, onHelpful }: { p: Post; onOpen: () => void; onOpenProfile: (id: number) => void; onHelpful: () => void }) {
  const long = p.body.length > 420;
  return (
    <article className={`cm-card${p.kind === "anzeige" ? " ad" : ""}`}>
      <AuthorLine a={p.author} at={p.created_at} edited={!!p.edited_at} onOpen={onOpenProfile} />
      <div className="cm-tags">
        <span className={`cm-kind k-${p.kind}`}>
          {POST_KINDS[p.kind].icon} {POST_KINDS[p.kind].label}
        </span>
        <span className="cm-topic">{topicLabel(p.topic)}</span>
        {p.solution_comment_id && <span className="cm-solved">✅ Gelöst</span>}
      </div>
      {p.status === "pruefung" && <p className="cm-msg warn">Wird von der Moderation geprüft – nur für Sie sichtbar.</p>}
      <button type="button" className="cm-body-btn" onClick={onOpen}>
        <p className="cm-body">{long ? `${p.body.slice(0, 400).trimEnd()} …` : p.body}</p>
        {long && <span className="cm-link">Weiterlesen</span>}
      </button>
      <Photos paths={p.images} small />
      <div className="cm-foot">
        <button type="button" onClick={onOpen}>
          💬 {p.comment_count} {p.comment_count === 1 ? "Antwort" : "Antworten"}
        </button>
        <button type="button" className={p.helpful_by_me ? "on" : ""} onClick={onHelpful} disabled={p.mine || p.status !== "sichtbar"} title={p.mine ? "Eigener Beitrag" : "Hilfreich"}>
          👍 Hilfreich{p.helpful_count > 0 ? ` · ${p.helpful_count}` : ""}
        </button>
      </div>
    </article>
  );
}

function Composer({ me, onCancel, onCreated }: { me: Member; onCancel: () => void; onCreated: (id: number) => void }) {
  const kinds = allowedKinds(me.kind);
  const [kind, setKind] = useState<PostKind>("frage");
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => ({ f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const addFiles = (list: FileList | null) => {
    const imgs = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    setFiles((cur) => [...cur, ...imgs].slice(0, MAX_IMAGES));
    if (input.current) input.current.value = "";
  };

  const submit = async () => {
    const v = validatePost(body, topic, files.length);
    if (v) return setErr(v);
    setBusy(true);
    setErr(null);
    let paths: string[] = [];
    try {
      paths = files.length ? await api.uploadImages(files) : [];
      const id = await api.createPost(kind, topic, body.trim(), paths);
      onCreated(id);
    } catch (e) {
      if (paths.length) await api.deleteImages(paths);
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cm-composer">
      <div className="cm-kinds" role="radiogroup" aria-label="Art des Beitrags">
        {kinds.map((k) => (
          <button type="button" key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)} role="radio" aria-checked={kind === k}>
            {POST_KINDS[k].icon} {POST_KINDS[k].label}
          </button>
        ))}
      </div>
      {kind === "anzeige" && <p className="cm-small">Anzeigen werden für alle sichtbar als „Anzeige“ mit Ihrem Firmennamen gekennzeichnet.</p>}
      <label className="cm-field">
        <span>Thema</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Bitte wählen …</option>
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="cm-field">
        <span>{kind === "frage" ? "Ihre Frage" : kind === "projekt" ? "Was zeigen Sie?" : kind === "tipp" ? "Ihr Tipp" : "Ihre Anzeige"}</span>
        <textarea
          rows={5}
          maxLength={MAX_POST}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={kind === "frage" ? "z. B. Wie bekomme ich Nikotinflecken an der Decke dauerhaft weg? Untergrund ist Raufaser …" : ""}
        />
        <small className="cm-count">
          {body.length} / {MAX_POST}
        </small>
      </label>
      <div className="cm-files">
        {previews.map((p, i) => (
          <div key={p.url} className="cm-thumb">
            <img src={p.url} alt="" />
            <button type="button" onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} aria-label="Foto entfernen">
              ✕
            </button>
          </div>
        ))}
        {files.length < MAX_IMAGES && (
          <button type="button" className="cm-add-photo" onClick={() => input.current?.click()}>
            📷 Foto
          </button>
        )}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>
      {files.length > 0 && <p className="cm-small">{PHOTO_HINT}</p>}
      {err && <p className="cm-msg err">{err}</p>}
      <div className="cm-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Abbrechen
        </button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Wird veröffentlicht …" : "Veröffentlichen"}
        </button>
      </div>
    </div>
  );
}

type DetailProps = { id: number; me: Member; onBack: () => void; onOpenProfile: (id: number) => void };

export function PostDetail({ id, me, onBack, onOpenProfile }: DetailProps) {
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ topic: string; body: string } | null>(null);
  const [report, setReport] = useState<{ type: "post" | "comment"; id: number } | null>(null);

  useEffect(() => {
    let cancel = false;
    void api
      .getPost(id)
      .then((p) => !cancel && setPost(p))
      .catch((e: Error) => !cancel && setErr(e.message));
    return () => {
      cancel = true;
    };
  }, [id, reload]);

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      setReload((r) => r + 1);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const sendAnswer = async () => {
    if (answer.trim().length < 2) return setErr("Bitte eine Antwort schreiben.");
    setBusy(true);
    await run(async () => {
      await api.createComment(id, answer.trim());
      setAnswer("");
    });
    setBusy(false);
  };

  const remove = async () => {
    if (!(await showConfirm("Beitrag mit allen Antworten und Fotos endgültig löschen?", { danger: true, confirmLabel: "Löschen" }))) return;
    try {
      await api.deletePost(id);
      onBack();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (post === undefined && !err) return <p className="cm-muted">Lädt …</p>;
  if (!post)
    return (
      <div>
        <button type="button" className="cm-back" onClick={onBack}>
          ← Zurück
        </button>
        <p className="cm-msg err">{err ?? "Dieser Beitrag ist nicht (mehr) verfügbar."}</p>
      </div>
    );

  const comments = post.comments ?? [];
  const solution = comments.find((c) => c.id === post.solution_comment_id);
  const ordered = solution ? [solution, ...comments.filter((c) => c.id !== solution.id)] : comments;

  return (
    <div className="cm-detail">
      <button type="button" className="cm-back" onClick={onBack}>
        ← Zurück zum Feed
      </button>
      <article className={`cm-card open${post.kind === "anzeige" ? " ad" : ""}`}>
        <AuthorLine a={post.author} at={post.created_at} edited={!!post.edited_at} onOpen={onOpenProfile} />
        <div className="cm-tags">
          <span className={`cm-kind k-${post.kind}`}>
            {POST_KINDS[post.kind].icon} {POST_KINDS[post.kind].label}
          </span>
          <span className="cm-topic">{topicLabel(post.topic)}</span>
          {post.solution_comment_id && <span className="cm-solved">✅ Gelöst</span>}
        </div>
        {post.status === "pruefung" && <p className="cm-msg warn">Wird von der Moderation geprüft – nur für Sie sichtbar.</p>}
        {edit ? (
          <div className="cm-composer flat">
            <label className="cm-field">
              <span>Thema</span>
              <select value={edit.topic} onChange={(e) => setEdit({ ...edit, topic: e.target.value })}>
                {TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <textarea rows={6} maxLength={MAX_POST} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} aria-label="Text" />
            <div className="cm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  run(async () => {
                    const v = validatePost(edit.body, edit.topic, 0);
                    if (v) throw new Error(v);
                    await api.updatePost(post.id, edit.topic, edit.body.trim());
                    setEdit(null);
                  })
                }
              >
                Speichern
              </button>
            </div>
          </div>
        ) : (
          <p className="cm-body full">{post.body}</p>
        )}
        <Photos paths={post.images} />
        <div className="cm-foot">
          <button
            type="button"
            className={post.helpful_by_me ? "on" : ""}
            disabled={post.mine || post.status !== "sichtbar"}
            onClick={() => run(() => api.helpful(post.id, null))}
          >
            👍 Hilfreich{post.helpful_count > 0 ? ` · ${post.helpful_count}` : ""}
          </button>
          {post.mine ? (
            <>
              {!edit && (
                <button type="button" onClick={() => setEdit({ topic: post.topic, body: post.body })}>
                  ✏️ Bearbeiten
                </button>
              )}
              <button type="button" className="danger" onClick={remove}>
                🗑 Löschen
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setReport({ type: "post", id: post.id })}>
              🚩 Melden
            </button>
          )}
        </div>
      </article>

      {err && <p className="cm-msg err">{err}</p>}

      <h3 className="cm-h3">
        {comments.length} {comments.length === 1 ? "Antwort" : "Antworten"}
      </h3>
      {ordered.map((c) => (
        <div key={c.id} className={`cm-comment${c.id === post.solution_comment_id ? " solution" : ""}`}>
          {c.id === post.solution_comment_id && <span className="cm-solved">✅ Lösung</span>}
          <AuthorLine a={c.author} at={c.created_at} onOpen={onOpenProfile} />
          {c.status === "pruefung" && <p className="cm-msg warn">Wird geprüft – nur für Sie sichtbar.</p>}
          <p className="cm-body full">{c.body}</p>
          <div className="cm-foot">
            <button type="button" className={c.helpful_by_me ? "on" : ""} disabled={c.mine || c.status !== "sichtbar"} onClick={() => run(() => api.helpful(null, c.id))}>
              👍 Hilfreich{c.helpful_count > 0 ? ` · ${c.helpful_count}` : ""}
            </button>
            {post.mine && post.status === "sichtbar" && c.status === "sichtbar" && (
              <button type="button" onClick={() => run(() => api.markSolution(post.id, c.id === post.solution_comment_id ? null : c.id))}>
                {c.id === post.solution_comment_id ? "Lösung entfernen" : "✅ Als Lösung markieren"}
              </button>
            )}
            {c.mine ? (
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  if (await showConfirm("Antwort löschen?", { danger: true, confirmLabel: "Löschen" })) void run(() => api.deleteComment(c.id));
                }}
              >
                🗑 Löschen
              </button>
            ) : (
              <button type="button" onClick={() => setReport({ type: "comment", id: c.id })}>
                🚩 Melden
              </button>
            )}
          </div>
        </div>
      ))}

      {post.status === "sichtbar" && (
        <div className="cm-answer">
          <textarea rows={3} maxLength={MAX_COMMENT} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={`Antworten als ${me.display_name} …`} aria-label="Antwort" />
          <div className="cm-actions">
            <button type="button" className="btn btn-primary" onClick={sendAnswer} disabled={busy || !answer.trim()}>
              {busy ? "Senden …" : "Antworten"}
            </button>
          </div>
        </div>
      )}
      {report && <ReportDialog type={report.type} id={report.id} onClose={() => setReport(null)} />}
    </div>
  );
}
