import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import DeliveryNoteImport from "../modules/lieferscheine/DeliveryNoteImport";
import * as mapi from "../modules/material/api";
import type { HistoryEntry, Material } from "../modules/material/api";
import "../modules/material/material.css";

type Props = {
  tenantId: number;
  onBack: () => void;
  /** Währung der Firma (z. B. EUR, CHF) */
  currency?: string;
};

type Filter = "aktiv" | "nachbestellen" | "inaktiv" | "alle";

type FormState = {
  name: string;
  unit: string;
  category: string;
  minimum: string;
  price: string;
  supplier: string;
  location: string;
  description: string;
  initialStock: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  unit: "Stk",
  category: "",
  minimum: "0",
  price: "",
  supplier: "",
  location: "",
  description: "",
  initialStock: "",
  active: true,
};

const UNIT_SUGGESTIONS = ["Stk", "Eimer", "Liter", "kg", "Rolle", "Karton", "m", "m²", "Sack", "Dose"];

export default function MaterialsPage({ tenantId, onBack, currency = "EUR" }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [filter, setFilter] = useState<Filter>("aktiv");

  // Dialoge
  const [editing, setEditing] = useState<Material | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [categoryNewMode, setCategoryNewMode] = useState(false);
  const categoryRef = useRef<HTMLInputElement | null>(null);

  const [stockFor, setStockFor] = useState<Material | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockNote, setStockNote] = useState("");

  const [historyFor, setHistoryFor] = useState<Material | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState("");

  const loadMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });
    setLoading(false);
    if (error) {
      console.error("Fehler beim Laden der Materialien:", error);
      setNotice({ text: "Materialien konnten nicht geladen werden.", ok: false });
      setMaterials([]);
      return;
    }
    setMaterials((data as Material[]) || []);
  };

  useEffect(() => {
    loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (!notice?.ok) return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const active = materials.filter((m) => m.is_active);
  const lowCount = active.filter(mapi.isLow).length;
  const stockValue = active.reduce((s, m) => s + Number(m.stock_quantity || 0) * Number(m.purchase_price || 0), 0);
  const categories = useMemo(
    () => [...new Set(materials.map((m) => m.category).filter((c): c is string => !!c))].sort(),
    [materials]
  );

  const visible = materials.filter((m) => {
    if (filter === "aktiv" && !m.is_active) return false;
    if (filter === "inaktiv" && m.is_active) return false;
    if (filter === "nachbestellen" && !(m.is_active && mapi.isLow(m))) return false;
    if (category !== "Alle" && m.category !== category) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [m.name, m.supplier, m.storage_location, m.category].some((v) => (v || "").toLowerCase().includes(q));
  });

  // ---------- Anlegen / Bearbeiten ----------

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setCategoryNewMode(false);
    setEditing("new");
  };

  const openEdit = (m: Material) => {
    setForm({
      name: m.name,
      unit: m.unit || "Stk",
      category: m.category || "",
      minimum: String(m.minimum_quantity ?? 0),
      price: m.purchase_price != null ? String(m.purchase_price).replace(".", ",") : "",
      supplier: m.supplier || "",
      location: m.storage_location || "",
      description: m.description || "",
      initialStock: "",
      active: m.is_active,
    });
    setFormError("");
    setCategoryNewMode(false);
    setEditing(m);
  };

  const saveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const name = form.name.trim();
    if (!name) return setFormError("Bitte einen Materialnamen eingeben.");
    const minimum = form.minimum.trim() ? mapi.parseNum(form.minimum) : 0;
    if (!Number.isFinite(minimum) || minimum < 0) return setFormError("Der Mindestbestand muss 0 oder größer sein.");
    const price = form.price.trim() ? mapi.parseNum(form.price) : null;
    if (price !== null && (!Number.isFinite(price) || price < 0)) return setFormError("Bitte einen gültigen Einkaufspreis eingeben.");
    const initial = form.initialStock.trim() ? mapi.parseNum(form.initialStock) : 0;
    if (!Number.isFinite(initial) || initial < 0) return setFormError("Bitte einen gültigen Anfangsbestand eingeben.");
    const duplicate = materials.find(
      (m) => m.name.trim().toLowerCase() === name.toLowerCase() && (editing === "new" || m.id !== editing?.id)
    );
    if (duplicate) return setFormError(`Ein Material „${duplicate.name}“ gibt es schon.`);

    const data = {
      name,
      unit: form.unit.trim() || "Stk",
      // Schreibweise an vorhandene Kategorie angleichen („farbe“ → „Farbe“)
      category: (() => {
        const typed = form.category.trim().replace(/\s+/g, " ");
        if (!typed) return null;
        return categories.find((c) => c.toLowerCase() === typed.toLowerCase()) ?? typed.charAt(0).toUpperCase() + typed.slice(1);
      })(),
      minimum_quantity: minimum,
      purchase_price: price,
      supplier: form.supplier.trim() || null,
      storage_location: form.location.trim() || null,
      description: form.description.trim() || null,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (editing === "new") {
        const { data: created, error } = await supabase
          .from("materials")
          .insert({ ...data, tenant_id: tenantId, stock_quantity: 0, is_active: true })
          .select("id")
          .single();
        if (error) throw error;
        if (initial > 0 && created?.id) {
          try {
            await mapi.stockIn(Number(created.id), initial, true, "");
          } catch (err) {
            setNotice({ text: `Material angelegt, aber der Anfangsbestand wurde nicht gebucht: ${(err as Error).message}`, ok: false });
            setEditing(null);
            await loadMaterials();
            return;
          }
        }
        setNotice({ text: `„${name}“ wurde angelegt.`, ok: true });
      } else if (editing) {
        const { error } = await supabase
          .from("materials")
          .update({ ...data, is_active: form.active })
          .eq("id", editing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        setNotice({ text: `„${name}“ wurde gespeichert.`, ok: true });
      }
      setEditing(null);
      await loadMaterials();
    } catch (err) {
      console.error("Material speichern:", err);
      setFormError(mapi.materialError(err, "Das Material konnte nicht gespeichert werden."));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Wareneingang ----------

  const bookStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFor) return;
    const qty = mapi.parseNum(stockQty);
    if (!Number.isFinite(qty) || qty <= 0) return setFormError("Bitte eine Menge größer als 0 eingeben.");
    setSaving(true);
    setFormError("");
    try {
      await mapi.stockIn(stockFor.id, qty, false, stockNote.trim());
      setNotice({ text: `${mapi.fmtQty(qty)} ${stockFor.unit} „${stockFor.name}“ eingebucht.`, ok: true });
      setStockFor(null);
      await loadMaterials();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- Verlauf ----------

  const openHistory = async (m: Material) => {
    setHistoryFor(m);
    setHistory(null);
    setHistoryError("");
    try {
      setHistory(await mapi.loadHistory(tenantId, m.id));
    } catch (err) {
      setHistoryError((err as Error).message);
      setHistory([]);
    }
  };

  const field = (key: keyof FormState) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <section className="single-page-section mt-root">
      <div className="card form-page-card mt-card">
        <div className="page-topbar">
          <div>
            <h2>Materialverwaltung</h2>
            <p>Lagerbestand, Wareneingang und Nachbestellungen.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Zurück zum Dashboard
          </button>
        </div>

        <div className="mt-kpis">
          <button type="button" onClick={() => setFilter("aktiv")}>
            <span>Materialien</span>
            <b>{active.length}</b>
            <small>aktiv im Lager</small>
          </button>
          <button
            type="button"
            onClick={() => setFilter(filter === "nachbestellen" ? "aktiv" : "nachbestellen")}
            className={`${lowCount > 0 ? "warn" : ""} ${filter === "nachbestellen" ? "on" : ""}`}
          >
            <span>Nachbestellen</span>
            <b>{lowCount}</b>
            <small>{lowCount > 0 ? "am oder unter Mindestbestand" : "alles ausreichend"}</small>
          </button>
          <div>
            <span>Lagerwert</span>
            <b>{mapi.fmtMoney(stockValue, currency)}</b>
            <small>Bestand × Einkaufspreis</small>
          </div>
        </div>

        {notice && <p className={`mt-msg ${notice.ok ? "ok" : "err"}`}>{notice.text}</p>}

        <details className="mt-import">
          <summary>📄 Lieferschein einlesen (KI) – Wareneingang per Foto</summary>
          <DeliveryNoteImport tenantId={tenantId} onBooked={loadMaterials} />
        </details>

        <div className="mt-toolbar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen: Material, Lieferant, Lagerort …"
            aria-label="Material suchen"
          />
          {categories.length > 0 && (
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategorie">
              <option value="Alle">Alle Kategorien</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <div className="mt-seg" role="group" aria-label="Filter">
            {(
              [
                ["aktiv", "Aktiv"],
                ["nachbestellen", "Nachbestellen"],
                ["inaktiv", "Inaktiv"],
                ["alle", "Alle"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button key={key} type="button" className={filter === key ? "on" : ""} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            + Neues Material
          </button>
        </div>

        {loading ? (
          <p className="mt-empty">Materialien werden geladen …</p>
        ) : materials.length === 0 ? (
          <p className="mt-empty">
            Noch keine Materialien angelegt. Tippen Sie auf <b>„+ Neues Material“</b> oder lesen Sie einen Lieferschein ein.
          </p>
        ) : visible.length === 0 ? (
          <p className="mt-empty">Keine Materialien für diese Auswahl.</p>
        ) : (
          <div className="mt-list">
            {visible.map((m) => {
              const low = m.is_active && mapi.isLow(m);
              const min = Number(m.minimum_quantity || 0);
              const pct = min > 0 ? Math.min(100, (Number(m.stock_quantity || 0) / (min * 2)) * 100) : 100;
              return (
                <div key={m.id} className={`mt-row${low ? " low" : ""}${m.is_active ? "" : " inactive"}`}>
                  <div className="mt-name">
                    <b>{m.name}</b>
                    <small>
                      {m.category && <span className="mt-tag">{m.category}</span>}
                      {!m.is_active && <span className="mt-tag">Inaktiv</span>}
                      {low && <span className="mt-tag low">Nachbestellen</span>}
                      {[m.supplier, m.storage_location && `Lager: ${m.storage_location}`].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                  <div className="mt-stock">
                    <b>
                      {mapi.fmtQty(m.stock_quantity)} {m.unit}
                    </b>
                    <small>{min > 0 ? `Mindestbestand ${mapi.fmtQty(min)}` : "kein Mindestbestand"}</small>
                    {min > 0 && (
                      <div className="mt-bar" aria-hidden>
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="mt-price">
                    {mapi.fmtMoney(m.purchase_price, currency)}
                    <small>je {m.unit}</small>
                  </div>
                  <div className="mt-actions">
                    {m.is_active && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setStockFor(m);
                          setStockQty("");
                          setStockNote("");
                          setFormError("");
                        }}
                      >
                        + Eingang
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary" onClick={() => openHistory(m)}>
                      Verlauf
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => openEdit(m)}>
                      Bearbeiten
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Anlegen / Bearbeiten */}
      {editing && (
        <div className="mt-modal" role="dialog" aria-modal="true" onClick={() => !saving && setEditing(null)}>
          <form className="mt-dialog" onSubmit={saveMaterial} onClick={(e) => e.stopPropagation()}>
            <h3>{editing === "new" ? "Neues Material" : "Material bearbeiten"}</h3>
            <p>{editing === "new" ? "Stammdaten und Anfangsbestand erfassen." : "Der Bestand ändert sich nur über Wareneingang und Aufträge."}</p>
            <div className="mt-form">
              <div className="mt-field full">
                <label htmlFor="mt-name">Materialname *</label>
                <input id="mt-name" {...field("name")} placeholder="z. B. Innenfarbe Weiß 12,5 L" autoFocus />
              </div>
              <div className="mt-field">
                <label htmlFor="mt-unit">Einheit</label>
                <input id="mt-unit" list="mt-units" {...field("unit")} />
                <datalist id="mt-units">
                  {UNIT_SUGGESTIONS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
              <div className="mt-field full">
                <label htmlFor="mt-cat">Kategorie</label>
                <input
                  id="mt-cat"
                  ref={categoryRef}
                  {...field("category")}
                  placeholder={categoryNewMode ? "Neue Kategorie eintippen, z. B. Lösemittel" : "z. B. Farbe, Werkzeug, Abdeckung"}
                  autoComplete="off"
                />
                <div className="mt-chips" role="group" aria-label="Kategorie wählen">
                  {categories.map((c) => {
                    const on = form.category.trim().toLowerCase() === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`mt-chip${on ? " on" : ""}`}
                        aria-pressed={on}
                        onClick={() => {
                          setCategoryNewMode(false);
                          setForm((f) => ({ ...f, category: on ? "" : c }));
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="mt-chip add"
                    onClick={() => {
                      setCategoryNewMode(true);
                      setForm((f) => ({ ...f, category: "" }));
                      window.setTimeout(() => categoryRef.current?.focus(), 0);
                    }}
                  >
                    + Neue Kategorie
                  </button>
                </div>
                <small>
                  {categories.length > 0 ? "Vorhandene antippen oder eine neue eintippen." : "Einfach eine Kategorie eintippen, z. B. Farbe oder Lösemittel."}
                </small>
              </div>
              {editing === "new" && (
                <div className="mt-field">
                  <label htmlFor="mt-initial">Anfangsbestand</label>
                  <input id="mt-initial" inputMode="decimal" {...field("initialStock")} placeholder="z. B. 10" />
                </div>
              )}
              <div className="mt-field">
                <label htmlFor="mt-min">Mindestbestand</label>
                <input id="mt-min" inputMode="decimal" {...field("minimum")} />
                <small>Darunter erscheint „Nachbestellen“.</small>
              </div>
              <div className="mt-field">
                <label htmlFor="mt-price">Einkaufspreis je Einheit ({currency})</label>
                <input id="mt-price" inputMode="decimal" {...field("price")} placeholder="z. B. 69,90" />
              </div>
              <div className="mt-field">
                <label htmlFor="mt-sup">Lieferant</label>
                <input id="mt-sup" {...field("supplier")} placeholder="z. B. Brillux" />
              </div>
              <div className="mt-field">
                <label htmlFor="mt-loc">Lagerort</label>
                <input id="mt-loc" {...field("location")} placeholder="z. B. Regal A3" />
              </div>
              <div className="mt-field full">
                <label htmlFor="mt-desc">Beschreibung</label>
                <textarea id="mt-desc" {...field("description")} placeholder="z. B. Farbton, Artikelnummer" />
              </div>
              {editing !== "new" && (
                <label className="mt-check full">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                  Aktiv (kann Aufträgen zugewiesen werden)
                </label>
              )}
            </div>
            {formError && <p className="mt-msg err" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="mt-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={saving}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Speichert …" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Wareneingang */}
      {stockFor && (
        <div className="mt-modal" role="dialog" aria-modal="true" onClick={() => !saving && setStockFor(null)}>
          <form className="mt-dialog" onSubmit={bookStockIn} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3>Wareneingang</h3>
            <p>
              {stockFor.name} · aktuell {mapi.fmtQty(stockFor.stock_quantity)} {stockFor.unit}
            </p>
            <div className="mt-form">
              <div className="mt-field full">
                <label htmlFor="mt-in-qty">Menge ({stockFor.unit}) *</label>
                <input id="mt-in-qty" inputMode="decimal" value={stockQty} onChange={(e) => setStockQty(e.target.value)} autoFocus />
              </div>
              <div className="mt-field full">
                <label htmlFor="mt-in-note">Notiz</label>
                <input id="mt-in-note" value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="z. B. Lieferung Brillux Nr. 4711" />
              </div>
            </div>
            {formError && <p className="mt-msg err" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="mt-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStockFor(null)} disabled={saving}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Bucht …" : "Einbuchen"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Verlauf */}
      {historyFor && (
        <div className="mt-modal" role="dialog" aria-modal="true" onClick={() => setHistoryFor(null)}>
          <div className="mt-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Verlauf: {historyFor.name}</h3>
            <p>
              Aktueller Bestand {mapi.fmtQty(historyFor.stock_quantity)} {historyFor.unit}
            </p>
            {historyError && <p className="mt-msg err">{historyError}</p>}
            {history === null ? (
              <p className="mt-empty">Wird geladen …</p>
            ) : history.length === 0 ? (
              <p className="mt-empty">Noch keine Buchungen.</p>
            ) : (
              <ul className="mt-moves">
                {history.map((h) => (
                  <li key={h.key} className={h.kind === "usage" ? "usage" : ""}>
                    <span>
                      <b>{h.label}</b>
                      {h.site ? <span className="mt-site"> · {h.site}</span> : ""}
                    </span>
                    <b className={h.delta == null ? "" : h.delta > 0 ? "plus" : h.delta < 0 ? "minus" : ""}>
                      {h.delta == null ? "" : h.delta > 0 ? "+" : h.delta < 0 ? "−" : ""}
                      {mapi.fmtQty(h.delta == null || h.delta === 0 ? h.quantity : Math.abs(h.delta))} {historyFor.unit}
                    </b>
                    <small>
                      {new Date(h.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                      {h.by ? ` · ${h.kind === "usage" ? "von" : "gebucht von"} ${h.by}` : ""}
                      {h.to && h.to !== h.by ? ` · an ${h.to}` : ""}
                      {h.stockAfter != null ? ` · Bestand danach ${mapi.fmtQty(h.stockAfter)}` : ""}
                      {h.note ? ` · „${h.note}“` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setHistoryFor(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
