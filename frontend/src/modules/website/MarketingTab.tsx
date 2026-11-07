// Reiter „Werbung“: KI erstellt aus Baustellenfotos Beiträge für Website, Instagram, Facebook, Google-Profil und WhatsApp.
// Veröffentlichen auf der eigenen Website = Referenz anlegen; soziale Netzwerke über das Teilen-Menü des Handys.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketingChannel, MarketingImage, MarketingPost, OrderImage, OrderOption, Website, WebsiteImage, WebsiteReference } from "./types";
import { publicUrl } from "./types";
import * as api from "./api";
import { SOCIAL_CHANNELS, buildShareFiles, canShareFiles, copyText, downloadFiles, fileBaseName } from "./share";
import { showConfirm } from "../../lib/dialogs";

type Props = {
  tenantId: number;
  userId: number;
  website: Website;
  references: WebsiteReference[];
  saving: boolean;
  onSaveWebsite: (values: Partial<Website>) => Promise<void> | void;
  onRefsChanged: () => Promise<void> | void;
  onSuggestionCount: (n: number) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
};

const MAX_UPLOADS = 10;
const STATUS_LABEL: Record<MarketingPost["status"], string> = {
  vorschlag: "Vorschlag der KI",
  entwurf: "Entwurf",
  veroeffentlicht: "Auf der Website",
  verworfen: "Verworfen",
};
const CHANNEL_LABEL: Record<MarketingChannel, string> = {
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  whatsapp: "WhatsApp",
};

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "");

function imageKey(im: MarketingImage) {
  return im.image_id != null ? `o${im.image_id}` : `u${im.path}`;
}

// =====================================================================
// Neuer Beitrag
// =====================================================================
function Creator({
  tenantId,
  website,
  onCreated,
  onCancel,
  onError,
}: {
  tenantId: number;
  website: Website;
  onCreated: (post: MarketingPost, used: number, limit: number) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [orderId, setOrderId] = useState("");
  const [orderImages, setOrderImages] = useState<OrderImage[] | null>(null);
  const [uploads, setUploads] = useState<WebsiteImage[]>([]);
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.loadOrders(tenantId).then(setOrders).catch((e) => onError((e as Error).message));
  }, [tenantId, onError]);

  useEffect(() => {
    if (!orderId) {
      setOrderImages(null);
      return;
    }
    let cancelled = false;
    setOrderImages(null);
    api
      .loadOrderImages(tenantId, orderId)
      .then((imgs) => !cancelled && setOrderImages(imgs))
      .catch((e) => onError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [tenantId, orderId, onError]);

  const addFiles = async (list: File[]) => {
    const room = MAX_UPLOADS - uploads.length;
    const pick = list.slice(0, room);
    const done: WebsiteImage[] = [];
    try {
      let n = 0;
      for (const f of pick) {
        setBusy(`Fotos werden vorbereitet (${++n}/${pick.length}) …`);
        done.push(await api.uploadImage(tenantId, await api.processImage(f), "werbung"));
      }
      setUploads((prev) => [...prev, ...done]);
    } catch (e) {
      await api.removeImages(done.map((d) => d.path));
      onError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const order = orders.find((o) => o.id === orderId);
  const ready = (!!orderId && (orderImages?.length ?? 0) > 0) || uploads.length > 0;

  const run = async () => {
    setBusy("Die KI sieht sich die Fotos an und schreibt die Texte … (ca. 20–60 Sekunden)");
    try {
      const { post, used, limit } = await api.aiMarketingPost({
        order_id: orderId || null,
        uploads,
        keywords,
        title: order?.title ?? "",
        city: order?.address_city ?? "",
        site_url: publicUrl(website),
      });
      onCreated(post, used, limit);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="ws-panel ws-editor">
      <h3>Neuer Beitrag</h3>
      <label className="tk-field">
        <span>Fotos aus einem Auftrag</span>
        <select value={orderId} onChange={(e) => setOrderId(e.target.value)} disabled={!!busy}>
          <option value="">– ohne Auftrag, nur eigene Fotos –</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
              {o.address_city ? ` · ${o.address_city}` : ""} · {o.status}
            </option>
          ))}
        </select>
      </label>
      {orderId && (
        <div className="ws-pick">
          {orderImages === null ? (
            <p className="tk-muted">Bilder werden geladen …</p>
          ) : orderImages.length === 0 ? (
            <p className="tk-muted">Zu diesem Auftrag gibt es noch keine Fotos. Fügen Sie unten eigene Fotos hinzu.</p>
          ) : (
            <>
              <span className="ws-label">{orderImages.length} Baustellenbild(er) – die KI wählt die besten aus</span>
              <div className="ws-grid ws-grid-small">
                {orderImages.slice(0, 12).map((im) => (
                  <div key={im.id} className="ws-tile">
                    <img src={im.url} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="ws-pick">
        {uploads.length > 0 && (
          <div className="ws-grid ws-grid-small">
            {uploads.map((u) => (
              <div key={u.path} className="ws-tile selected">
                <img src={u.url} alt="" />
                <button
                  type="button"
                  className="ws-tile-remove"
                  aria-label="Foto entfernen"
                  onClick={() => {
                    setUploads((p) => p.filter((x) => x.path !== u.path));
                    api.removeImages([u.path]).catch(() => undefined);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="ws-row">
          <label className={`btn btn-secondary btn-small${busy || uploads.length >= MAX_UPLOADS ? " disabled" : ""}`}>
            + Eigene Fotos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              disabled={!!busy || uploads.length >= MAX_UPLOADS}
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (list.length) addFiles(list);
              }}
            />
          </label>
          <span className="tk-muted">
            {uploads.length}/{MAX_UPLOADS} eigene Fotos
          </span>
        </div>
      </div>

      <label className="tk-field">
        <span>Was sollte die KI wissen? (optional)</span>
        <textarea
          rows={3}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          maxLength={1200}
          placeholder="z. B. Altbau-Fassade, Risse saniert, Silikatfarbe in Hellgrau, Fenster lackiert, 2 Wochen Bauzeit"
          disabled={!!busy}
        />
      </label>

      {busy && <p className="ws-busy">{busy}</p>}
      <div className="ws-row">
        <button type="button" className="btn btn-primary" onClick={run} disabled={!!busy || !ready}>
          ✨ Beitrag mit KI erstellen
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={!!busy}>
          Abbrechen
        </button>
      </div>
    </section>
  );
}

// =====================================================================
// Beitrag bearbeiten, veröffentlichen, teilen
// =====================================================================
function Editor({
  tenantId,
  userId,
  website,
  initial,
  references,
  onClose,
  onChanged,
  onRefsChanged,
  onError,
  onSuccess,
}: {
  tenantId: number;
  userId: number;
  website: Website;
  initial: MarketingPost;
  references: WebsiteReference[];
  onClose: () => void;
  onChanged: (post: MarketingPost | null) => void;
  onRefsChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  const [post, setPost] = useState(initial);
  const [title, setTitle] = useState(initial.title ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [texts, setTexts] = useState<Partial<Record<MarketingChannel, string>>>(initial.texts ?? {});
  const [images, setImages] = useState<MarketingImage[]>(initial.images ?? []);
  const [consent, setConsent] = useState(initial.consent_confirmed);
  const [orderImages, setOrderImages] = useState<OrderImage[]>([]);
  const [busy, setBusy] = useState("");
  const [files, setFiles] = useState<File[] | null>(null);
  const [filesError, setFilesError] = useState("");

  useEffect(() => {
    if (!initial.order_id) return;
    api
      .loadOrderImages(tenantId, initial.order_id)
      .then(setOrderImages)
      .catch((e) => onError((e as Error).message));
  }, [tenantId, initial.order_id, onError]);

  const urlOf = useCallback(
    (im: MarketingImage) => (im.image_id != null ? orderImages.find((o) => o.id === im.image_id)?.url : im.url) ?? "",
    [orderImages]
  );
  const shareUrls = useMemo(() => images.map(urlOf).filter(Boolean), [images, urlOf]);
  const imagesReady = images.every((im) => !!urlOf(im));

  // Bilder fürs Teilen vorbereiten, sobald die Zustimmung bestätigt ist (Teilen muss direkt nach dem Antippen starten)
  useEffect(() => {
    setFiles(null);
    setFilesError("");
    if (!consent || !imagesReady || !shareUrls.length) return;
    let cancelled = false;
    buildShareFiles(shareUrls, fileBaseName(title))
      .then((f) => !cancelled && setFiles(f))
      .catch((e) => !cancelled && setFilesError((e as Error).message));
    return () => {
      cancelled = true;
    };
    // Dateiname ändert sich mit dem Titel – deswegen nicht neu bauen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent, imagesReady, shareUrls.join("|")]);

  const values = (): Partial<MarketingPost> => ({
    title: title.trim() || null,
    city: city.trim() || null,
    texts,
    images,
    consent_confirmed: consent,
    status: post.status === "vorschlag" ? "entwurf" : post.status,
  });

  const persist = async (extra: Partial<MarketingPost> = {}) => {
    const saved = await api.saveMarketingPost(tenantId, post.id, { ...values(), ...extra });
    setPost(saved);
    onChanged(saved);
    return saved;
  };

  const save = async () => {
    setBusy("Wird gespeichert …");
    try {
      await persist();
      onSuccess("Beitrag gespeichert.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const publish = async () => {
    if (!consent) return onError("Bitte zuerst bestätigen, dass der Kunde mit der Veröffentlichung einverstanden ist.");
    if (!title.trim()) return onError("Bitte einen Titel eingeben.");
    if (!images.length) return onError("Bitte mindestens ein Bild auswählen.");
    const existing = post.reference_id ? references.find((r) => r.id === post.reference_id) ?? null : null;
    const uploaded: WebsiteImage[] = [];
    try {
      let refImages: WebsiteImage[];
      if (existing) {
        refImages = existing.images;
      } else {
        let n = 0;
        for (const im of images.slice(0, 8)) {
          setBusy(`Bilder werden für die Website vorbereitet (${++n}/${Math.min(images.length, 8)}) …`);
          const copy = await api.copyOrderImage(tenantId, urlOf(im));
          uploaded.push(copy);
        }
        refImages = uploaded.map((u, i) => ({ ...u, kind: images[i].kind ?? null, alt: `${title.trim()}${city.trim() ? ` in ${city.trim()}` : ""}` }));
      }
      setBusy("Wird veröffentlicht …");
      const ref = await api.saveReference(
        tenantId,
        userId,
        {
          order_id: post.order_id,
          title: title.trim(),
          text: (texts.website ?? "").trim() || null,
          city: city.trim() || null,
          images: refImages,
          consent_confirmed: true,
          status: "veroeffentlicht",
        },
        existing
      );
      await persist({ status: "veroeffentlicht", reference_id: ref.id, shared: { ...post.shared, website: new Date().toISOString() } });
      await onRefsChanged();
      onSuccess(
        website.published
          ? "Das Projekt ist jetzt auf Ihrer Website zu sehen."
          : "Das Projekt ist gespeichert. Sichtbar wird es, sobald Ihre Website veröffentlicht ist."
      );
    } catch (e) {
      await api.removeImages(uploaded.map((u) => u.path));
      onError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const discard = async () => {
    const msg = post.status === "veroeffentlicht" ? "Beitrag verwerfen? Das Projekt auf der Website bleibt erhalten (im Reiter „Referenzen“ verwalten)." : "Beitrag verwerfen?";
    if (!(await showConfirm(msg, { danger: true, confirmLabel: "Verwerfen" }))) return;
    try {
      await api.saveMarketingPost(tenantId, post.id, { status: "verworfen" });
      onChanged(null);
      onClose();
      onSuccess("Beitrag verworfen.");
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const markShared = async (ch: MarketingChannel) => {
    try {
      await persist({ shared: { ...post.shared, [ch]: new Date().toISOString() } });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const share = async (ch: Exclude<MarketingChannel, "website">, label: string) => {
    if (!files) return;
    const text = texts[ch] ?? "";
    const copying = copyText(text); // noch im Antippen starten – sonst blockiert der Browser
    if (canShareFiles(files)) {
      try {
        await navigator.share({ files, text, title: title || undefined });
        await copying;
        await markShared(ch);
        onSuccess(`${label}: Der Text ist kopiert – beim Posten in das Textfeld tippen und „Einfügen“ wählen.`);
      } catch (e) {
        if ((e as Error).name !== "AbortError") onError("Teilen ist auf diesem Gerät nicht möglich. Bitte „Bilder laden“ und „Text kopieren“ verwenden.");
      }
      return;
    }
    const ok = await copying;
    downloadFiles(files);
    onSuccess(`${label}: ${files.length} Bild(er) werden heruntergeladen${ok ? ", der Text ist kopiert" : ""}. Jetzt ${label} öffnen, Bilder hochladen und Text einfügen.`);
  };

  const toggleImage = (im: MarketingImage) => {
    const key = imageKey(im);
    setImages((prev) => (prev.some((p) => imageKey(p) === key) ? prev.filter((p) => imageKey(p) !== key) : prev.length >= 10 ? prev : [...prev, { ...im, kind: null }]));
  };
  const cycleKind = (key: string) =>
    setImages((prev) => prev.map((p) => (imageKey(p) === key ? { ...p, kind: p.kind === "vorher" ? "nachher" : p.kind === "nachher" ? null : "vorher" } : p)));
  const moveFirst = (key: string) => setImages((prev) => [...prev.filter((p) => imageKey(p) === key), ...prev.filter((p) => imageKey(p) !== key)]);

  const unused = orderImages.filter((o) => !images.some((im) => im.image_id === o.id));
  const shareReady = consent && !!files;
  const mobileShare = !!files && canShareFiles(files);

  return (
    <section className="ws-panel ws-editor ws-mk-editor">
      <div className="ws-row ws-row-between">
        <h3>{post.status === "vorschlag" ? "Vorschlag der KI prüfen" : "Beitrag bearbeiten"}</h3>
        <button type="button" className="btn btn-secondary btn-small" onClick={onClose} disabled={!!busy}>
          Zur Übersicht
        </button>
      </div>

      {post.warnings?.length > 0 && (
        <div className="tk-notice ws-mk-warn" role="alert">
          <div>
            <strong>Bitte Fotos prüfen – die KI hat Folgendes bemerkt:</strong>
            <ul>
              {post.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <small>Die Bildnummern beziehen sich auf die Reihenfolge, in der die KI die Fotos gesehen hat. Im Zweifel das Foto entfernen.</small>
          </div>
        </div>
      )}

      <div className="ws-pick">
        <span className="ws-label">Bilder im Beitrag ({images.length}/10) – das erste ist das Hauptbild</span>
        {images.length === 0 ? (
          <p className="tk-muted">Keine Bilder ausgewählt.</p>
        ) : (
          <div className="ws-grid">
            {images.map((im, i) => {
              const key = imageKey(im);
              const url = urlOf(im);
              return (
                <div key={key} className="ws-tile selected">
                  {url ? <img src={url} alt="" /> : <div className="ws-ref-noimg">…</div>}
                  <span className="ws-tile-badge">{i + 1}</span>
                  <button type="button" className={`ws-tile-kind${im.kind ? ` on ${im.kind}` : ""}`} onClick={() => cycleKind(key)} title="Als Vorher- bzw. Nachher-Bild markieren">
                    {im.kind === "vorher" ? "Vorher" : im.kind === "nachher" ? "Nachher" : "Vorher/Nachher?"}
                  </button>
                  {i > 0 && (
                    <button type="button" className="ws-mk-first" onClick={() => moveFirst(key)} title="Als Hauptbild verwenden">
                      ★
                    </button>
                  )}
                  <button type="button" className="ws-tile-remove" onClick={() => toggleImage(im)} aria-label="Bild entfernen">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {unused.length > 0 && (
          <details className="ws-mk-more">
            <summary>Weitere Fotos aus dem Auftrag ({unused.length}) – zum Hinzufügen antippen</summary>
            <div className="ws-grid ws-grid-small">
              {unused.map((o) => (
                <button key={o.id} type="button" className="ws-tile" onClick={() => toggleImage({ image_id: o.id })}>
                  <img src={o.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="tk-form">
        <label className="tk-field">
          <span>Titel</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} />
        </label>
        <label className="tk-field">
          <span>Ort (nur der Ort, keine Straße!)</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
        </label>
      </div>

      <div className="ws-mk-texts">
        {(["website", ...SOCIAL_CHANNELS.map((c) => c.key)] as MarketingChannel[]).map((ch) => {
          const max = ch === "website" ? 2000 : SOCIAL_CHANNELS.find((c) => c.key === ch)!.max;
          const v = texts[ch] ?? "";
          return (
            <label key={ch} className="tk-field">
              <span>
                {ch === "website" ? "Text für die Projektseite auf Ihrer Website" : CHANNEL_LABEL[ch]}
                <small className={`tk-muted ws-mk-count${v.length > max ? " over" : ""}`}>
                  {v.length}/{max}
                </small>
              </span>
              <textarea rows={ch === "whatsapp" ? 2 : 5} value={v} onChange={(e) => setTexts((t) => ({ ...t, [ch]: e.target.value }))} />
            </label>
          );
        })}
      </div>

      <label className="ws-check ws-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Der Kunde ist einverstanden, dass Fotos seines Projekts (ohne Adresse) auf unserer Website und in sozialen Netzwerken gezeigt werden.{" "}
          <em>Pflicht zum Veröffentlichen und Teilen.</em>
        </span>
      </label>

      {busy && <p className="ws-busy">{busy}</p>}
      <div className="ws-row">
        <button type="button" className="btn btn-primary" onClick={publish} disabled={!!busy || !consent}>
          {post.reference_id ? "Website-Projekt aktualisieren" : "Auf Website veröffentlichen"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={save} disabled={!!busy}>
          Speichern
        </button>
        <button type="button" className="ws-link ws-danger" onClick={discard} disabled={!!busy}>
          Verwerfen
        </button>
      </div>

      <div className="ws-mk-share">
        <h4>In sozialen Netzwerken teilen</h4>
        {!consent ? (
          <p className="tk-muted">Zum Teilen bitte oben die Zustimmung des Kunden bestätigen.</p>
        ) : filesError ? (
          <p className="ws-warn">{filesError}</p>
        ) : !files ? (
          <p className="tk-muted">Bilder werden vorbereitet …</p>
        ) : (
          <p className="tk-muted">
            {mobileShare
              ? "„Teilen“ öffnet die App mit den Bildern. Der Text wird dabei kopiert – beim Posten in das Textfeld tippen und „Einfügen“ wählen."
              : "Am Computer: „Bilder laden“ speichert die Fotos, der Text wird kopiert. Dann die Seite öffnen, Fotos hochladen und Text einfügen. Am Handy geht es mit einem Fingertipp über „Teilen“."}
          </p>
        )}
        <div className="ws-mk-channels">
          {SOCIAL_CHANNELS.map((c) => (
            <div key={c.key} className="ws-mk-channel">
              <div className="ws-row ws-row-between">
                <strong>{c.label}</strong>
                {post.shared?.[c.key] ? (
                  <span className="tk-badge tk-status-bestaetigt">geteilt {fmt(post.shared[c.key])}</span>
                ) : (
                  <button type="button" className="ws-link" onClick={() => markShared(c.key)} disabled={!shareReady}>
                    als geteilt markieren
                  </button>
                )}
              </div>
              <small className="tk-muted">{c.hint}</small>
              <div className="ws-row">
                <button type="button" className="btn btn-primary btn-small" onClick={() => share(c.key, c.label)} disabled={!shareReady}>
                  {mobileShare ? "Teilen" : "Bilder laden + Text kopieren"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  disabled={!consent}
                  onClick={async () => onSuccess((await copyText(texts[c.key] ?? "")) ? `${c.label}: Text kopiert.` : "Kopieren nicht möglich – bitte Text markieren und kopieren.")}
                >
                  Text kopieren
                </button>
                {c.open && (
                  <a className="btn btn-secondary btn-small" href={c.open} target="_blank" rel="noopener noreferrer">
                    {c.label} öffnen ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Übersicht
// =====================================================================
export default function MarketingTab({ tenantId, userId, website, references, saving, onSaveWebsite, onRefsChanged, onSuggestionCount, onError, onSuccess }: Props) {
  const [posts, setPosts] = useState<MarketingPost[] | null>(null);
  const [view, setView] = useState<"list" | "new" | MarketingPost>("list");
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [usage, setUsage] = useState<{ used: number | null; limit: number | null }>({ used: null, limit: null });

  const reload = useCallback(async () => {
    try {
      const list = await api.loadMarketingPosts(tenantId);
      setPosts(list);
      onSuggestionCount(list.filter((p) => p.status === "vorschlag").length);
      const ids = list.map((p) => p.images?.[0]?.image_id).filter((n): n is number => typeof n === "number");
      setThumbs(await api.orderImageUrls(ids));
    } catch (e) {
      setPosts([]);
      onError((e as Error).message);
    }
  }, [tenantId, onError, onSuggestionCount]);

  useEffect(() => {
    // reload setzt den Zustand erst nach dem Laden (asynchron)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    api.aiUsageThisMonth(tenantId).then((used) => setUsage((u) => ({ ...u, used })));
  }, [reload, tenantId]);

  const thumbOf = (p: MarketingPost) => {
    const im = p.images?.[0];
    if (!im) return "";
    return im.image_id != null ? thumbs[im.image_id] ?? "" : im.url ?? "";
  };

  if (view === "new") {
    return (
      <Creator
        tenantId={tenantId}
        website={website}
        onCancel={() => setView("list")}
        onError={onError}
        onCreated={(post, used, limit) => {
          setUsage({ used, limit });
          setPosts((prev) => [post, ...(prev ?? [])]);
          setView(post);
          onSuccess("Die KI hat einen Beitrag vorbereitet. Bitte prüfen und anpassen.");
        }}
      />
    );
  }

  if (typeof view === "object") {
    return (
      <Editor
        key={view.id}
        tenantId={tenantId}
        userId={userId}
        website={website}
        initial={view}
        references={references}
        onClose={() => {
          setView("list");
          reload();
        }}
        onChanged={(p) => {
          if (p) setPosts((prev) => (prev ?? []).map((x) => (x.id === p.id ? p : x)));
        }}
        onRefsChanged={onRefsChanged}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <div className="ws-stack">
      <div className="ws-row ws-row-between">
        <p className="tk-muted ws-intro">
          Die KI macht aus Ihren Baustellenfotos fertige Beiträge – für Ihre Website, Instagram, Facebook, Ihr Google-Profil und den WhatsApp-Status.
          Sie prüfen, veröffentlichen und teilen mit wenigen Fingertipps.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setView("new")}>
          ✨ Neuer Beitrag
        </button>
      </div>

      <div className="ws-mk-settings">
        <label className="ws-check">
          <input type="checkbox" checked={website.marketing_auto !== false} disabled={saving} onChange={(e) => onSaveWebsite({ marketing_auto: e.target.checked })} />
          <span>
            <strong>Automatische Vorschläge:</strong> Die KI bereitet aus neu abgeschlossenen Aufträgen mit Fotos bis zu 2 Beiträge pro Woche vor und
            schickt Ihnen eine E-Mail.
          </span>
        </label>
        {usage.used != null && (
          <small className="tk-muted">
            KI-Texte diesen Monat: {usage.used}
            {usage.limit ? ` von ${usage.limit}` : ""} (gemeinsam mit der Schreibhilfe)
          </small>
        )}
      </div>

      {posts === null ? (
        <p className="tk-empty">Wird geladen …</p>
      ) : posts.length === 0 ? (
        <p className="tk-empty">Noch keine Beiträge. Tipp: Nach jedem abgeschlossenen Auftrag einige Fotos machen – vorher und nachher.</p>
      ) : (
        <div className="ws-refs">
          {posts.map((p) => {
            const thumb = thumbOf(p);
            const shared = (Object.keys(p.shared ?? {}) as MarketingChannel[]).filter((k) => p.shared[k]);
            return (
              <article key={p.id} className={`ws-ref${p.status === "vorschlag" ? " ws-mk-new" : ""}`}>
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : <div className="ws-ref-noimg">{p.images?.length ? "…" : "kein Bild"}</div>}
                <div className="ws-ref-body">
                  <span className={`tk-badge ${p.status === "veroeffentlicht" ? "tk-status-bestaetigt" : p.status === "vorschlag" ? "tk-status-weitergeleitet" : "tk-status-geplant"}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  <strong>{p.title || "Ohne Titel"}</strong>
                  <span className="tk-muted">
                    {p.city || "ohne Ort"} · {p.images?.length ?? 0} Bild(er) · {fmt(p.created_at)}
                  </span>
                  {shared.length > 0 && <span className="tk-muted">Geteilt: {shared.map((k) => CHANNEL_LABEL[k]).join(", ")}</span>}
                  {p.warnings?.length > 0 && <span className="ws-warn">⚠ {p.warnings.length} Hinweis(e) zu den Fotos</span>}
                  <div className="ws-ref-actions">
                    <button type="button" className="btn btn-primary btn-small" onClick={() => setView(p)}>
                      {p.status === "vorschlag" ? "Prüfen" : "Öffnen"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
