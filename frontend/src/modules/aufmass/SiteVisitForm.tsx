// Besichtigung / Aufmaß erfassen – in 4 Schritten: Kunde & Objekt → Räume → Sonderleistungen → Zusammenfassung.
// Live-Flächen rechnen wie die Angebotsfunktion (siehe calc.ts). Speichern/Angebot erledigt weiterhin App.tsx.

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { SiteVisitFormState, SiteVisitRoomForm } from "./types";
import { OPENING_LIMIT_SQM, calcRoom, calcTotals, fmt, roomLabel, toNum } from "./calc";
import { hasContent, readDraft, writeDraft } from "./draft";
import "./aufmass.css";

type CustomerLite = { id: string; first_name: string; last_name: string; company_name: string | null; street: string | null; zip: string | null; city: string | null };
type VisitLite = { id: number; visit_number?: string | null; title: string; visit_date?: string | null };

type Props = {
  tenantId: number;
  form: SiteVisitFormState;
  setForm: (updater: (prev: SiteVisitFormState) => SiteVisitFormState) => void;
  customers: CustomerLite[];
  onCustomerChange: (customerId: string) => void;
  availableSiteVisits: VisitLite[];
  loadingSiteVisits: boolean;
  selectedSiteVisitId: number | null;
  onSelectSiteVisit: (id: number | null) => void;
  editingSiteVisitId: number | null;
  roomImages: Record<number, { file: File; previewUrl: string }[]>;
  savedRoomImages: Record<number, { file_path: string; file_name: string | null; signedUrl: string }[]>;
  onRoomImages: (roomTempId: number, files: FileList | null) => void;
  saving: boolean;
  message: string;
  canCreateQuote: boolean;
  quoteLabel?: string;
  onSubmit: (e: FormEvent) => void;
  setCreateQuote: (v: boolean) => void;
  onDelete: () => void;
  onBack: () => void;
};

const ROOM_TEMPLATES: { name: string; height?: string; ceiling: boolean }[] = [
  { name: "Wohnzimmer", height: "2,50", ceiling: true },
  { name: "Schlafzimmer", height: "2,50", ceiling: true },
  { name: "Kinderzimmer", height: "2,50", ceiling: true },
  { name: "Küche", height: "2,50", ceiling: true },
  { name: "Bad", height: "2,50", ceiling: true },
  { name: "Flur", height: "2,50", ceiling: true },
  { name: "Treppenhaus", ceiling: true },
  { name: "Keller", height: "2,20", ceiling: true },
  { name: "Fassade", ceiling: false },
  { name: "Garage", ceiling: true },
];

const WINDOW_PRESETS = [
  { label: "Fenster 1,00 × 1,20", w: "1,00", h: "1,20" },
  { label: "Fenster 1,20 × 1,40", w: "1,20", h: "1,40" },
  { label: "Balkontür 0,90 × 2,20", w: "0,90", h: "2,20" },
  { label: "Terrassentür 2,00 × 2,20", w: "2,00", h: "2,20" },
];
const DOOR_PRESETS = [
  { label: "Zimmertür 0,885 × 2,01", w: "0,885", h: "2,01" },
  { label: "Haustür 1,10 × 2,10", w: "1,10", h: "2,10" },
  { label: "Doppeltür 1,76 × 2,01", w: "1,76", h: "2,01" },
];
const RADIATOR_PRESETS = [
  { label: "Heizkörper 1,00 × 0,60", w: "1,00", h: "0,60", type: "Flachheizkörper" },
  { label: "Röhrenheizkörper 0,80 × 0,60", w: "0,80", h: "0,60", type: "Röhrenheizkörper" },
  { label: "Badheizkörper 0,60 × 1,20", w: "0,60", h: "1,20", type: "Badheizkörper" },
];

const STEPS = ["Kunde & Objekt", "Räume", "Sonderleistungen", "Zusammenfassung"];

let uid = Date.now();
const nextId = () => ++uid;

const emptyRoom = (name = "", height = "", ceiling = true): SiteVisitRoomForm => ({
  temp_id: nextId(),
  room_name: name,
  length_m: "",
  width_m: "",
  height_m: height,
  notes: "",
  paint_ceiling: ceiling,
  manual_wall_area_sqm: "",
});

const customerName = (c: CustomerLite) => (c.company_name ? `${c.company_name} – ${c.first_name} ${c.last_name}` : `${c.first_name} ${c.last_name}`.trim());

/** Zahlenfeld mit Komma-Eingabe und Zahlentastatur am Handy */
function Num({ label, value, onChange, placeholder, unit = "m" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; unit?: string }) {
  const bad = value.trim() !== "" && toNum(value) == null;
  return (
    <label className={`am-field${bad ? " bad" : ""}`}>
      <span>{label}</span>
      <div className="am-num">
        <input inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ""))} />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  );
}

export default function SiteVisitForm(p: Props) {
  const { form, setForm } = p;
  const [step, setStep] = useState(0);
  const [customerQuery, setCustomerQuery] = useState("");
  const [openRoom, setOpenRoom] = useState<number | null>(form.rooms[0]?.temp_id ?? null);
  const [draft, setDraft] = useState(() => {
    const d = readDraft(p.tenantId);
    return d && hasContent(d.form) ? d : null;
  });
  const topRef = useRef<HTMLDivElement>(null);

  const totals = useMemo(() => calcTotals(form), [form]);
  const customer = p.customers.find((c) => String(c.id) === String(form.customer_id)) ?? null;

  // ---------- Entwurf automatisch sichern ----------
  useEffect(() => {
    if (draft) return; // erst entscheiden, ob der alte Entwurf wiederhergestellt wird
    if (!hasContent(form)) return;
    const t = window.setTimeout(() => writeDraft(p.tenantId, p.editingSiteVisitId, form), 700);
    return () => window.clearTimeout(t);
  }, [form, draft, p.tenantId, p.editingSiteVisitId]);

  const goto = (s: number) => {
    setStep(s);
    window.setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  const set = <K extends keyof SiteVisitFormState>(k: K, v: SiteVisitFormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));
  const updRoom = (id: number, patch: Partial<SiteVisitRoomForm>) => setForm((prev) => ({ ...prev, rooms: prev.rooms.map((r) => (r.temp_id === id ? { ...r, ...patch } : r)) }));

  const addRoom = (name = "", height = "", ceiling = true) => {
    const r = emptyRoom(name, height, ceiling);
    setForm((prev) => ({ ...prev, rooms: [...prev.rooms, r] }));
    setOpenRoom(r.temp_id);
    window.setTimeout(() => document.getElementById(`am-room-${r.temp_id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const copyRoom = (room: SiteVisitRoomForm) => {
    const copy = { ...room, temp_id: nextId(), room_name: room.room_name ? `${room.room_name} (Kopie)` : "" };
    setForm((prev) => {
      const idx = prev.rooms.findIndex((r) => r.temp_id === room.temp_id);
      const rooms = [...prev.rooms];
      rooms.splice(idx + 1, 0, copy);
      const dup = <T extends { temp_id: number; room_temp_id: number | null }>(list: T[]) => [
        ...list,
        ...list.filter((x) => String(x.room_temp_id) === String(room.temp_id)).map((x) => ({ ...x, temp_id: nextId(), room_temp_id: copy.temp_id })),
      ];
      return { ...prev, rooms, windows: dup(prev.windows), doors: dup(prev.doors), radiators: dup(prev.radiators) };
    });
    setOpenRoom(copy.temp_id);
  };

  const removeRoom = (room: SiteVisitRoomForm) => {
    setForm((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((r) => r.temp_id !== room.temp_id),
      windows: prev.windows.filter((x) => String(x.room_temp_id) !== String(room.temp_id)),
      doors: prev.doors.filter((x) => String(x.room_temp_id) !== String(room.temp_id)),
      radiators: prev.radiators.filter((x) => String(x.room_temp_id) !== String(room.temp_id)),
    }));
  };

  const addWindow = (roomId: number, w = "", h = "") =>
    setForm((prev) => ({ ...prev, windows: [...prev.windows, { temp_id: nextId(), room_temp_id: roomId, count_items: "1", width_m: w, height_m: h, notes: "" }] }));
  const addDoor = (roomId: number, w = "", h = "") =>
    setForm((prev) => ({ ...prev, doors: [...prev.doors, { temp_id: nextId(), room_temp_id: roomId, count_items: "1", width_m: w, height_m: h, frame_included: true, notes: "" }] }));
  const addRadiator = (roomId: number, w = "", h = "", type = "") =>
    setForm((prev) => ({ ...prev, radiators: [...prev.radiators, { temp_id: nextId(), room_temp_id: roomId, count_items: "1", width_m: w, height_m: h, radiator_type: type, notes: "" }] }));

  type ListKey = "windows" | "doors" | "radiators";
  const updItem = (list: ListKey, id: number, patch: Record<string, unknown>) =>
    setForm((prev) => ({ ...prev, [list]: (prev[list] as { temp_id: number }[]).map((x) => (x.temp_id === id ? { ...x, ...patch } : x)) }));
  const delItem = (list: ListKey, id: number) => setForm((prev) => ({ ...prev, [list]: (prev[list] as { temp_id: number }[]).filter((x) => x.temp_id !== id) }));

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const list = q ? p.customers.filter((c) => [customerName(c), c.city, c.street].some((v) => (v ?? "").toLowerCase().includes(q))) : p.customers;
    return list.slice(0, 200);
  }, [p.customers, customerQuery]);

  const takeAddress = () => {
    if (!customer) return;
    setForm((prev) => ({ ...prev, object_street: customer.street ?? "", object_zip: customer.zip ?? "", object_city: customer.city ?? "" }));
  };

  const suggestTitle = () => {
    const who = customer ? customer.company_name || customer.last_name || customerName(customer) : "";
    const where = form.object_city || customer?.city || "";
    set("title", ["Besichtigung", who, where].filter(Boolean).join(" – "));
  };

  const stepDone = [
    !!form.customer_id && !!form.title.trim(),
    form.rooms.length > 0 && totals.rooms.every((x) => x.c.missing.length === 0),
    true,
    true,
  ];

  // =====================================================================
  return (
    <section className="single-page-section am-root">
      <div className="card form-page-card">
        <div className="am-head" ref={topRef}>
          <div>
            <span className="am-kicker">Besichtigung</span>
            <h2>{p.editingSiteVisitId ? "Aufmaß bearbeiten" : "Aufmaß erfassen"}</h2>
          </div>
          <button type="button" className="btn btn-secondary" onClick={p.onBack}>
            Zurück zum Dashboard
          </button>
        </div>

        {draft && (
          <div className="am-draft">
            <div>
              <strong>Nicht gespeichertes Aufmaß gefunden</strong>
              <span>
                Entwurf vom {new Date(draft.savedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                {draft.form.title ? ` – „${draft.form.title}“` : ""} mit {draft.form.rooms.length} Bereich(en). Fotos müssen ggf. neu gewählt werden.
              </span>
            </div>
            <div className="am-draft-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setForm(() => draft.form);
                  if (draft.form.customer_id) p.onCustomerChange(draft.form.customer_id);
                  setOpenRoom(draft.form.rooms[0]?.temp_id ?? null);
                  setDraft(null);
                }}
              >
                Wiederherstellen
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)}>
                Verwerfen
              </button>
            </div>
          </div>
        )}

        {/* Live-Summen */}
        <div className="am-totals">
          <div>
            <b>{fmt(totals.wall)} m²</b>
            <span>Wandfläche</span>
          </div>
          <div>
            <b>{fmt(totals.ceiling)} m²</b>
            <span>Deckenfläche</span>
          </div>
          <div>
            <b>{form.rooms.length}</b>
            <span>Bereiche</span>
          </div>
          <div>
            <b>
              {totals.windows} / {totals.doors} / {totals.radiators}
            </b>
            <span>Fenster / Türen / Heizk.</span>
          </div>
          <div>
            <b>{fmt(totals.hours)} Std.</b>
            <span>Sonderleistungen</span>
          </div>
        </div>

        {/* Schritte */}
        <ol className="am-steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" className={`${step === i ? "on" : ""}${stepDone[i] && i < 2 ? " done" : ""}`} onClick={() => goto(i)}>
                <i>{stepDone[i] && i < 2 && step !== i ? "✓" : i + 1}</i>
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ol>

        <form onSubmit={p.onSubmit} className="am-form">
          {/* ---------------- Schritt 1 ---------------- */}
          {step === 0 && (
            <div className="am-panel">
              <div className="am-grid">
                <label className="am-field am-wide">
                  <span>Kunde *</span>
                  <input type="search" placeholder="Kunde suchen (Name, Firma, Ort) …" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
                  <select
                    value={form.customer_id}
                    onChange={(e) => {
                      set("customer_id", e.target.value);
                      p.onCustomerChange(e.target.value);
                    }}
                    required
                  >
                    <option value="">{filteredCustomers.length ? "Bitte wählen" : "Kein Kunde gefunden"}</option>
                    {filteredCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {customerName(c)}
                        {c.city ? ` · ${c.city}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {p.availableSiteVisits.length > 0 && (
                  <label className="am-field am-wide">
                    <span>Gespeicherte Besichtigung dieses Kunden bearbeiten</span>
                    <select value={p.selectedSiteVisitId ?? ""} onChange={(e) => p.onSelectSiteVisit(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">– neue Besichtigung –</option>
                      {p.availableSiteVisits.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.visit_number || `ID ${v.id}`} – {v.title}
                          {v.visit_date ? ` – ${new Date(v.visit_date).toLocaleDateString("de-DE")}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {p.loadingSiteVisits && <p className="am-muted am-wide">Besichtigungen werden geladen …</p>}

                <label className="am-field am-wide">
                  <span>Titel *</span>
                  <div className="am-inline">
                    <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="z. B. Wohnung Müller – Renovierung" required />
                    <button type="button" className="btn btn-secondary btn-small" onClick={suggestTitle} disabled={!customer}>
                      Vorschlag
                    </button>
                  </div>
                </label>

                <div className="am-wide am-subhead">
                  <strong>Objektadresse</strong>
                  {customer && (customer.street || customer.city) && (
                    <button type="button" className="am-link" onClick={takeAddress}>
                      Adresse vom Kunden übernehmen
                    </button>
                  )}
                </div>
                <label className="am-field am-wide">
                  <span>Straße</span>
                  <input value={form.object_street} onChange={(e) => set("object_street", e.target.value)} autoComplete="street-address" />
                </label>
                <label className="am-field">
                  <span>PLZ</span>
                  <input value={form.object_zip} inputMode="numeric" onChange={(e) => set("object_zip", e.target.value)} autoComplete="postal-code" />
                </label>
                <label className="am-field">
                  <span>Ort</span>
                  <input value={form.object_city} onChange={(e) => set("object_city", e.target.value)} autoComplete="address-level2" />
                </label>
                <label className="am-field">
                  <span>Besichtigungsdatum</span>
                  <input type="date" value={form.visit_date} onChange={(e) => set("visit_date", e.target.value)} />
                </label>
                <label className="am-field am-wide">
                  <span>Notizen zur Besichtigung</span>
                  <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="z. B. Zugang über Hof, Möbel werden vom Kunden abgedeckt …" />
                </label>
              </div>
              <div className="am-nav">
                <span />
                <button type="button" className="btn btn-primary" onClick={() => goto(1)}>
                  Weiter: Räume →
                </button>
              </div>
            </div>
          )}

          {/* ---------------- Schritt 2 ---------------- */}
          {step === 1 && (
            <div className="am-panel">
              {form.rooms.map((room, index) => {
                const c = calcRoom(room, form);
                const open = openRoom === room.temp_id;
                const mine = <T extends { room_temp_id: number | null }>(list: T[]) => list.filter((x) => String(x.room_temp_id) === String(room.temp_id));
                const photos = (p.savedRoomImages[Number(room.temp_id)]?.length ?? 0) + (p.roomImages[room.temp_id]?.length ?? 0);
                return (
                  <article key={room.temp_id} id={`am-room-${room.temp_id}`} className={`am-room${open ? " open" : ""}`}>
                    <button type="button" className="am-room-head" onClick={() => setOpenRoom(open ? null : room.temp_id)} aria-expanded={open}>
                      <span className="am-room-title">
                        <small>Bereich {index + 1}</small>
                        <b>{roomLabel(room, index)}</b>
                      </span>
                      <span className="am-room-chips">
                        <em className={c.wall == null ? "warn" : ""}>{c.wall == null ? "Maße fehlen" : `Wand ${fmt(c.wall)} m²`}</em>
                        {c.ceiling > 0 && <em>Decke {fmt(c.ceiling)} m²</em>}
                        {c.windows + c.doors + c.radiators > 0 && <em>🪟 {c.windows} · 🚪 {c.doors} · 🔥 {c.radiators}</em>}
                        {photos > 0 && <em>📷 {photos}</em>}
                      </span>
                      <span className="am-chev" aria-hidden="true">
                        {open ? "▴" : "▾"}
                      </span>
                    </button>

                    {open && (
                      <div className="am-room-body">
                        <label className="am-field">
                          <span>Bezeichnung</span>
                          <input value={room.room_name} onChange={(e) => updRoom(room.temp_id, { room_name: e.target.value })} placeholder={`z. B. Wohnzimmer (sonst „Bereich ${index + 1}“)`} />
                        </label>
                        {!room.room_name.trim() && (
                          <div className="am-chips">
                            {ROOM_TEMPLATES.map((t) => (
                              <button
                                key={t.name}
                                type="button"
                                onClick={() => updRoom(room.temp_id, { room_name: t.name, paint_ceiling: t.ceiling, height_m: room.height_m || t.height || "" })}
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="am-grid3">
                          <Num label="Länge" value={room.length_m} onChange={(v) => updRoom(room.temp_id, { length_m: v })} placeholder="4,50" />
                          <Num label="Breite" value={room.width_m} onChange={(v) => updRoom(room.temp_id, { width_m: v })} placeholder="3,80" />
                          <Num label="Höhe" value={room.height_m} onChange={(v) => updRoom(room.temp_id, { height_m: v })} placeholder="2,50" />
                        </div>

                        <label className="am-toggle">
                          <input type="checkbox" checked={room.paint_ceiling} onChange={(e) => updRoom(room.temp_id, { paint_ceiling: e.target.checked })} />
                          <span>Decke streichen</span>
                        </label>

                        <div className="am-calc">
                          {c.manual ? (
                            <span>
                              Wand <b>{fmt(c.wall)} m²</b> (manuell eingegeben)
                            </span>
                          ) : c.wall == null ? (
                            <span className="warn">Für die Wandfläche fehlen: {c.missing.join(", ")}</span>
                          ) : (
                            <span>
                              Wand <b>{fmt(c.wall)} m²</b>
                              {c.deduction > 0 ? ` (${fmt(c.wallGross)} m² − ${fmt(c.deduction)} m² große Öffnungen)` : ""}
                            </span>
                          )}
                          {c.ceiling > 0 && (
                            <span>
                              Decke <b>{fmt(c.ceiling)} m²</b>
                            </span>
                          )}
                          {c.floor != null && <span>Boden {fmt(c.floor)} m²</span>}
                        </div>

                        {/* Fenster */}
                        <div className="am-items">
                          <div className="am-items-head">
                            <strong>🪟 Fenster</strong>
                          </div>
                          {mine(form.windows).map((w) => {
                            const a = (toNum(w.width_m) ?? 0) * (toNum(w.height_m) ?? 0);
                            return (
                              <div key={w.temp_id} className="am-item">
                                <Num label="Anzahl" unit="" value={w.count_items} onChange={(v) => updItem("windows", w.temp_id, { count_items: v })} />
                                <Num label="Breite" value={w.width_m} onChange={(v) => updItem("windows", w.temp_id, { width_m: v })} />
                                <Num label="Höhe" value={w.height_m} onChange={(v) => updItem("windows", w.temp_id, { height_m: v })} />
                                <button type="button" className="am-x" onClick={() => delItem("windows", w.temp_id)} aria-label="Fenster entfernen">
                                  ×
                                </button>
                                {a > OPENING_LIMIT_SQM && <small className="am-ded">wird abgezogen ({fmt(a)} m² je Stück)</small>}
                              </div>
                            );
                          })}
                          <div className="am-chips">
                            {WINDOW_PRESETS.map((x) => (
                              <button key={x.label} type="button" onClick={() => addWindow(room.temp_id, x.w, x.h)}>
                                + {x.label}
                              </button>
                            ))}
                            <button type="button" onClick={() => addWindow(room.temp_id)}>
                              + anderes Maß
                            </button>
                          </div>
                        </div>

                        {/* Türen */}
                        <div className="am-items">
                          <div className="am-items-head">
                            <strong>🚪 Türen</strong>
                          </div>
                          {mine(form.doors).map((d) => {
                            const a = (toNum(d.width_m) ?? 0) * (toNum(d.height_m) ?? 0);
                            return (
                              <div key={d.temp_id} className="am-item">
                                <Num label="Anzahl" unit="" value={d.count_items} onChange={(v) => updItem("doors", d.temp_id, { count_items: v })} />
                                <Num label="Breite" value={d.width_m} onChange={(v) => updItem("doors", d.temp_id, { width_m: v })} />
                                <Num label="Höhe" value={d.height_m} onChange={(v) => updItem("doors", d.temp_id, { height_m: v })} />
                                <button type="button" className="am-x" onClick={() => delItem("doors", d.temp_id)} aria-label="Tür entfernen">
                                  ×
                                </button>
                                <label className="am-toggle am-small">
                                  <input type="checkbox" checked={d.frame_included} onChange={(e) => updItem("doors", d.temp_id, { frame_included: e.target.checked })} />
                                  <span>mit Zarge</span>
                                </label>
                                {a > OPENING_LIMIT_SQM && <small className="am-ded">wird abgezogen ({fmt(a)} m² je Stück)</small>}
                              </div>
                            );
                          })}
                          <div className="am-chips">
                            {DOOR_PRESETS.map((x) => (
                              <button key={x.label} type="button" onClick={() => addDoor(room.temp_id, x.w, x.h)}>
                                + {x.label}
                              </button>
                            ))}
                            <button type="button" onClick={() => addDoor(room.temp_id)}>
                              + anderes Maß
                            </button>
                          </div>
                        </div>

                        {/* Heizkörper */}
                        <div className="am-items">
                          <div className="am-items-head">
                            <strong>🔥 Heizkörper</strong>
                          </div>
                          {mine(form.radiators).map((r) => (
                            <div key={r.temp_id} className="am-item">
                              <Num label="Anzahl" unit="" value={r.count_items} onChange={(v) => updItem("radiators", r.temp_id, { count_items: v })} />
                              <Num label="Breite" value={r.width_m} onChange={(v) => updItem("radiators", r.temp_id, { width_m: v })} />
                              <Num label="Höhe" value={r.height_m} onChange={(v) => updItem("radiators", r.temp_id, { height_m: v })} />
                              <button type="button" className="am-x" onClick={() => delItem("radiators", r.temp_id)} aria-label="Heizkörper entfernen">
                                ×
                              </button>
                              <label className="am-field am-item-wide">
                                <span>Typ</span>
                                <input value={r.radiator_type} onChange={(e) => updItem("radiators", r.temp_id, { radiator_type: e.target.value })} />
                              </label>
                            </div>
                          ))}
                          <div className="am-chips">
                            {RADIATOR_PRESETS.map((x) => (
                              <button key={x.label} type="button" onClick={() => addRadiator(room.temp_id, x.w, x.h, x.type)}>
                                + {x.label}
                              </button>
                            ))}
                            <button type="button" onClick={() => addRadiator(room.temp_id)}>
                              + anderes Maß
                            </button>
                          </div>
                        </div>

                        <details className="am-more">
                          <summary>Fotos, Notiz und manuelle Wandfläche</summary>
                          <label className="am-field">
                            <span>Fotos zum Bereich</span>
                            <input type="file" accept="image/*" multiple onChange={(e) => p.onRoomImages(room.temp_id, e.target.files)} />
                          </label>
                          {photos > 0 && (
                            <div className="am-photos">
                              {(p.savedRoomImages[Number(room.temp_id)] ?? []).map((img) => (
                                <img key={img.file_path} src={img.signedUrl} alt={img.file_name || "Foto"} />
                              ))}
                              {(p.roomImages[room.temp_id] ?? []).map((img, i) => (
                                <img key={i} src={img.previewUrl} alt={`Foto ${i + 1}`} />
                              ))}
                            </div>
                          )}
                          <label className="am-field">
                            <span>Notiz</span>
                            <textarea rows={2} value={room.notes} onChange={(e) => updRoom(room.temp_id, { notes: e.target.value })} />
                          </label>
                          <Num
                            label="Manuelle Wandfläche (ersetzt die Berechnung)"
                            unit="m²"
                            value={room.manual_wall_area_sqm}
                            onChange={(v) => updRoom(room.temp_id, { manual_wall_area_sqm: v })}
                            placeholder="z. B. 16,8"
                          />
                        </details>

                        <div className="am-room-actions">
                          <button type="button" className="btn btn-secondary btn-small" onClick={() => copyRoom(room)}>
                            ⧉ Raum kopieren
                          </button>
                          {form.rooms.length > 1 && (
                            <button type="button" className="am-link am-danger" onClick={() => removeRoom(room)}>
                              Bereich entfernen
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}

              <div className="am-add">
                <strong>+ Bereich hinzufügen</strong>
                <div className="am-chips">
                  {ROOM_TEMPLATES.map((t) => (
                    <button key={t.name} type="button" onClick={() => addRoom(t.name, t.height ?? "", t.ceiling)}>
                      {t.name}
                    </button>
                  ))}
                  <button type="button" onClick={() => addRoom()}>
                    Leerer Bereich
                  </button>
                </div>
              </div>

              <div className="am-nav">
                <button type="button" className="btn btn-secondary" onClick={() => goto(0)}>
                  ← Zurück
                </button>
                <button type="button" className="btn btn-primary" onClick={() => goto(2)}>
                  Weiter: Sonderleistungen →
                </button>
              </div>
            </div>
          )}

          {/* ---------------- Schritt 3 ---------------- */}
          {step === 2 && (
            <div className="am-panel">
              <p className="am-muted">Arbeiten nach Stunden, die nicht über Flächen abgerechnet werden – z. B. Möbel rücken, Schimmelbehandlung, Gartenarbeiten.</p>
              {form.custom_services.map((s, i) => (
                <div key={s.temp_id} className="am-service">
                  <label className="am-field am-wide">
                    <span>Leistung {i + 1}</span>
                    <input
                      value={s.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, custom_services: prev.custom_services.map((x) => (x.temp_id === s.temp_id ? { ...x, title: e.target.value } : x)) }))}
                      placeholder="z. B. Möbel rücken und abdecken"
                    />
                  </label>
                  <Num
                    label="Stunden"
                    unit="Std."
                    value={s.hours}
                    onChange={(v) => setForm((prev) => ({ ...prev, custom_services: prev.custom_services.map((x) => (x.temp_id === s.temp_id ? { ...x, hours: v } : x)) }))}
                    placeholder="3"
                  />
                  <button
                    type="button"
                    className="am-x"
                    onClick={() => setForm((prev) => ({ ...prev, custom_services: prev.custom_services.filter((x) => x.temp_id !== s.temp_id) }))}
                    aria-label="Leistung entfernen"
                  >
                    ×
                  </button>
                  <label className="am-field am-wide">
                    <span>Beschreibung (optional)</span>
                    <textarea
                      rows={2}
                      value={s.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, custom_services: prev.custom_services.map((x) => (x.temp_id === s.temp_id ? { ...x, description: e.target.value } : x)) }))}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setForm((prev) => ({ ...prev, custom_services: [...prev.custom_services, { temp_id: nextId(), title: "", description: "", hours: "" }] }))}
              >
                + Sonderleistung
              </button>
              <div className="am-nav">
                <button type="button" className="btn btn-secondary" onClick={() => goto(1)}>
                  ← Zurück
                </button>
                <button type="button" className="btn btn-primary" onClick={() => goto(3)}>
                  Weiter: Zusammenfassung →
                </button>
              </div>
            </div>
          )}

          {/* ---------------- Schritt 4 ---------------- */}
          {step === 3 && (
            <div className="am-panel">
              <div className="am-summary-head">
                <div>
                  <strong>{form.title || "Ohne Titel"}</strong>
                  <span>
                    {customer ? customerName(customer) : "Kein Kunde gewählt"}
                    {form.object_city ? ` · ${[form.object_street, `${form.object_zip} ${form.object_city}`.trim()].filter(Boolean).join(", ")}` : ""}
                  </span>
                </div>
              </div>
              <div className="am-table-wrap">
                <table className="am-table">
                  <thead>
                    <tr>
                      <th>Bereich</th>
                      <th>Wand m²</th>
                      <th>Decke m²</th>
                      <th>Fenster</th>
                      <th>Türen</th>
                      <th>Heizk.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.rooms.map(({ room, c }, i) => (
                      <tr key={room.temp_id}>
                        <td>
                          <button type="button" className="am-link" onClick={() => { setOpenRoom(room.temp_id); goto(1); }}>
                            {roomLabel(room, i)}
                          </button>
                          {c.missing.length > 0 && <small className="warn"> Maße fehlen</small>}
                          {c.deduction > 0 && <small> −{fmt(c.deduction)} m² Öffnungen</small>}
                        </td>
                        <td>{fmt(c.wall)}</td>
                        <td>{c.ceiling ? fmt(c.ceiling) : "–"}</td>
                        <td>{c.windows || "–"}</td>
                        <td>{c.doors || "–"}</td>
                        <td>{c.radiators || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Summe</td>
                      <td>{fmt(totals.wall)}</td>
                      <td>{fmt(totals.ceiling)}</td>
                      <td>{totals.windows}</td>
                      <td>{totals.doors}</td>
                      <td>{totals.radiators}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {form.custom_services.some((s) => s.title.trim()) && (
                <p className="am-muted">
                  Sonderleistungen: {form.custom_services.filter((s) => s.title.trim()).map((s) => `${s.title} (${fmt(toNum(s.hours) ?? 0)} Std.)`).join(", ")}
                </p>
              )}
              <p className="am-muted">
                Öffnungen bis {fmt(OPENING_LIMIT_SQM)} m² werden nach VOB/C übermessen, größere von der Wandfläche abgezogen. Bereiche ohne Bezeichnung erscheinen als „Bereich 1“, „Bereich 2“ …
              </p>
              <div className="am-nav">
                <button type="button" className="btn btn-secondary" onClick={() => goto(2)}>
                  ← Zurück
                </button>
                <span />
              </div>
            </div>
          )}

          {p.message && <p className="am-message">{p.message}</p>}

          {/* Knopfleiste */}
          <div className="am-bar">
            {p.editingSiteVisitId ? (
              <button type="button" className="am-link am-danger" onClick={p.onDelete}>
                Löschen
              </button>
            ) : (
              <span />
            )}
            <div className="am-bar-right">
              <button type="submit" className="btn btn-secondary" disabled={p.saving} onClick={() => p.setCreateQuote(false)}>
                {p.saving ? "Speichert …" : "Speichern"}
              </button>
              {p.canCreateQuote && (
                <button type="submit" className="btn btn-primary" disabled={p.saving} onClick={() => p.setCreateQuote(true)}>
                  {p.quoteLabel ?? "Speichern & Angebot erstellen"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
