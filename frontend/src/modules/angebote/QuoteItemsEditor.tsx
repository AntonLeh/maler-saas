import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { showAlert, showConfirm } from "../../lib/dialogs";
import { addQuoteItem, deleteQuoteItem, updateQuoteItem } from "./api";
import { groupItems, joinTitle, nextSortOrder, parseNum, splitTitle } from "./items";
import { formatMoney } from "./status";

export type EditorItem = {
  id: number;
  sort_order: number;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

type Props = {
  tenantId: number;
  quoteId: number;
  items: EditorItem[];
  currencySymbol: string;
  locked: boolean; // angenommene Angebote nicht mehr ändern
  onChanged: () => Promise<void> | void;
};

type Draft = { room: string | null; service: string; description: string; quantity: string; unit: string; unit_price: string };

const UNITS = ["m²", "m", "Stk", "Std.", "pauschal", "lfm", "kg", "l"];

const fmtNum = (n: number) => Number(n || 0).toLocaleString("de-DE", { maximumFractionDigits: 2 });

function toDraft(it: EditorItem): Draft {
  const { room, service } = splitTitle(it.title);
  return {
    room, service,
    description: it.description || "",
    quantity: fmtNum(it.quantity),
    unit: it.unit || "",
    unit_price: Number(it.unit_price || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}

const EMPTY: Draft = { room: null, service: "", description: "", quantity: "1", unit: "Stk", unit_price: "" };

export default function QuoteItemsEditor({ tenantId, quoteId, items, currencySymbol, locked, onChanged }: Props) {
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const money = (v: number) => formatMoney(v, currencySymbol);
  const groups = groupItems(items);
  const rooms = groups.map((g) => g.room).filter((r) => r !== "Sonstige Leistungen");

  const startEdit = (it: EditorItem) => { setEditId(it.id); setDraft(toDraft(it)); setError(""); };
  const startNew = (room: string | null) => { setEditId("new"); setDraft({ ...EMPTY, room }); setError(""); };
  const cancel = () => { setEditId(null); setError(""); };

  const qty = parseNum(draft.quantity);
  const price = parseNum(draft.unit_price);
  const preview = qty != null && price != null ? qty * price : null;

  const save = async () => {
    if (!draft.service.trim()) { setError("Bitte eine Bezeichnung eingeben."); return; }
    if (qty == null || qty <= 0) { setError("Bitte eine gültige Menge eingeben (z. B. 12,5)."); return; }
    if (price == null || price < 0) { setError("Bitte einen gültigen Einzelpreis eingeben (z. B. 8,50)."); return; }
    const patch = {
      title: joinTitle(draft.room, draft.service),
      description: draft.description.trim() || null,
      quantity: Math.round(qty * 100) / 100,
      unit: draft.unit.trim() || "Stk",
      unit_price: Math.round(price * 100) / 100,
    };
    setBusy(true); setError("");
    try {
      if (editId === "new") await addQuoteItem(tenantId, quoteId, nextSortOrder(items), patch);
      else if (typeof editId === "number") await updateQuoteItem(tenantId, editId, patch);
      setEditId(null);
      await onChanged();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || "Speichern hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (it: EditorItem) => {
    const ok = await showConfirm(`Position „${splitTitle(it.title).service}“ wirklich löschen?`, { danger: true, confirmLabel: "Ja, löschen" });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteQuoteItem(tenantId, it.id);
      if (editId === it.id) setEditId(null);
      await onChanged();
    } catch (e: unknown) {
      await showAlert((e as { message?: string })?.message || "Löschen hat nicht geklappt.", { tone: "error", title: "Das hat nicht geklappt" });
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <div className="ag-edit">
      <div className="ag-edit-grid">
        <label className="ag-f ag-f-wide">
          <span>Bezeichnung{draft.room ? ` (Bereich: ${draft.room})` : ""}</span>
          <input value={draft.service} onChange={(e) => setDraft({ ...draft, service: e.target.value })} placeholder="z. B. Wände spachteln Q2" autoFocus />
        </label>
        {editId === "new" && (
          <label className="ag-f ag-f-wide">
            <span>Bereich</span>
            <select value={draft.room ?? ""} onChange={(e) => setDraft({ ...draft, room: e.target.value || null })}>
              <option value="">Sonstige Leistungen</option>
              {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
        <label className="ag-f">
          <span>Menge</span>
          <input inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
        </label>
        <label className="ag-f">
          <span>Einheit</span>
          <input list="ag-units" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
        </label>
        <label className="ag-f">
          <span>Einzelpreis ({currencySymbol})</span>
          <input inputMode="decimal" value={draft.unit_price} onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })} placeholder="0,00" />
        </label>
        <label className="ag-f ag-f-wide">
          <span>Beschreibung (optional, erscheint im PDF)</span>
          <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </label>
      </div>
      {error && <p className="ag-error">{error}</p>}
      <div className="ag-edit-bar">
        <span className="ag-muted">{preview != null ? <>Gesamt: <b>{money(preview)}</b> netto</> : " "}</span>
        <div>
          <button type="button" className="btn btn-secondary" onClick={cancel} disabled={busy}>Abbrechen</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button>
        </div>
      </div>
      <datalist id="ag-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
    </div>
  );

  return (
    <div className="settings-section ag-items">
      <div className="ag-items-head">
        <h3>Positionen nach Bereichen</h3>
        {!locked && editId === null && (
          <button type="button" className="btn btn-secondary btn-small" onClick={() => startNew(null)}>
            <Plus size={16} /> Freie Position
          </button>
        )}
      </div>
      {locked && <p className="ag-muted">Das Angebot ist angenommen – die Positionen können nicht mehr geändert werden.</p>}

      {items.length === 0 && editId !== "new" ? (
        <p className="info-text">Keine Positionen vorhanden.</p>
      ) : (
        <div className="quote-room-groups">
          {groups.map((g) => (
            <div key={g.room} className="quote-room-card">
              <div className="quote-room-card-header">
                <div>
                  <span>Bereich</span>
                  <h4>{g.room}</h4>
                </div>
                <strong>{money(g.total)}</strong>
              </div>
              <div className="quote-room-items">
                {g.items.map((it) =>
                  editId === it.id ? (
                    <div key={it.id}>{form}</div>
                  ) : (
                    <div key={it.id} className="quote-room-item">
                      <div>
                        <strong>{splitTitle(it.title).service}</strong>
                        {it.description && <p>{it.description}</p>}
                      </div>
                      <div className="quote-room-item-meta">
                        <span>{fmtNum(it.quantity)} {it.unit}</span>
                        <span>× {money(it.unit_price)}</span>
                        <strong>{money(it.line_total)}</strong>
                        {!locked && (
                          <span className="ag-item-actions">
                            <button type="button" title="Position bearbeiten" aria-label="Position bearbeiten" onClick={() => startEdit(it)} disabled={busy}><Pencil size={16} /></button>
                            <button type="button" title="Position löschen" aria-label="Position löschen" className="del" onClick={() => remove(it)} disabled={busy}><Trash2 size={16} /></button>
                          </span>
                        )}
                      </div>
                    </div>
                  ),
                )}
                {!locked && editId === null && g.room !== "Sonstige Leistungen" && (
                  <button type="button" className="ag-add-in-room" onClick={() => startNew(g.room)}>+ Position in {g.room}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editId === "new" && <div className="ag-new">{form}</div>}
    </div>
  );
}
