// Lieferscheine einlesen: Datei hochladen, KI-Erkennung (Funktion delivery-note-ai), Wareneingang buchen.

import { supabase, supabaseUrl } from "../../lib/supabase";

const BUCKET = "delivery-notes";
const DONE_STATUS = ["fertig", "abgerechnet", "abgeschlossen", "erledigt", "storniert"];

export type RecognizedLine = {
  article_number: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_net: number | null;
  material_id: number | null;
  quantity_in_material_unit: number | null;
  new_name: string;
  new_unit: string;
  confidence: "hoch" | "mittel" | "niedrig";
};
export type Recognized = { supplier: string; note_date: string | null; note_number: string; reference: string; lines: RecognizedLine[] };

export type MaterialLite = { id: number; name: string; unit: string; supplier: string | null; purchase_price: number | null; stock_quantity: number };
export type OrderLite = { id: number; title: string; status: string; address_city: string | null };
export type DeliveryNote = {
  id: number;
  file_path: string | null;
  supplier: string | null;
  note_date: string | null;
  note_number: string | null;
  reference: string | null;
  target: "warehouse" | "order";
  order_id: number | null;
  lines: { material_id: number; name: string; quantity: number; unit: string; unit_price: number | null; created: boolean }[];
  created_at: string;
};

/** Eine zu buchende Zeile (nach Prüfung durch den Nutzer) */
export type BookLine = {
  material_id: number | null; // null = neu anlegen
  new_name: string;
  new_unit: string;
  quantity: number; // in der Einheit des Materials
  unit_price: number | null; // netto je Materialeinheit
};

function missingUpdate(msg: string) {
  return /delivery_notes|delivery-notes|bucket not found|material_staff/i.test(msg) && /does not exist|schema cache|not found/i.test(msg);
}
const UPDATE_HINT = "Für Lieferscheine fehlt noch ein Datenbank-Update. Bitte die SQL-Datei supabase/migrations/20261108090000_lieferscheine.sql im Supabase SQL-Editor ausführen.";

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht verarbeitet werden."))), "image/jpeg", 0.88));
}

export async function uploadNote(tenantId: number, file: File): Promise<string> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let body: Blob = file;
  let type = isPdf ? "application/pdf" : "image/jpeg";
  if (!isPdf) {
    if (!file.type.startsWith("image/")) throw new Error("Bitte ein Foto (JPG, PNG) oder ein PDF wählen.");
    try {
      body = await shrinkImage(file);
    } catch {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Dieses Bildformat wird nicht unterstützt (z. B. HEIC). Bitte ein Foto direkt mit der Kamera aufnehmen oder als JPG speichern.");
      }
      body = file;
      type = file.type;
    }
  }
  if (body.size > 10 * 1024 * 1024) throw new Error("Die Datei ist zu groß (höchstens 10 MB).");
  const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const path = `${tenantId}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: false });
  if (error) throw new Error(missingUpdate(error.message) || /bucket/i.test(error.message) ? UPDATE_HINT : error.message || "Datei konnte nicht hochgeladen werden.");
  return path;
}

export async function recognize(path: string): Promise<{ data: Recognized; used: number; limit: number }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Bitte erneut anmelden.");
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/delivery-note-ai`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ file_path: path }),
    });
  } catch {
    throw new Error("Die Lieferschein-Erkennung ist nicht erreichbar. Ist die Funktion delivery-note-ai veröffentlicht?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Erkennung fehlgeschlagen (Status ${res.status}).`);
  return { data: data.data as Recognized, used: data.used ?? 0, limit: data.limit ?? 0 };
}

export async function loadMaterials(tenantId: number): Promise<MaterialLite[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("id, name, unit, supplier, purchase_price, stock_quantity")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error("Materialien konnten nicht geladen werden.");
  return (data ?? []) as MaterialLite[];
}

export async function loadOpenOrders(tenantId: number): Promise<OrderLite[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, title, status, address_city")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Aufträge konnten nicht geladen werden.");
  return ((data ?? []) as OrderLite[]).filter((o) => !DONE_STATUS.includes(String(o.status)));
}

export async function currentAppUserId(): Promise<number | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("app_users").select("id").eq("auth_user_id", auth.user.id).maybeSingle();
  return data ? Number(data.id) : null;
}

export async function projectManagerOf(orderId: number): Promise<number | null> {
  const { data } = await supabase.from("order_assignments").select("user_id").eq("order_id", orderId).eq("assignment_role", "project_manager").maybeSingle();
  return data ? Number(data.user_id) : null;
}

export async function loadNotes(tenantId: number): Promise<DeliveryNote[]> {
  const { data, error } = await supabase.from("delivery_notes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30);
  if (error) {
    if (missingUpdate(error.message)) throw new Error(UPDATE_HINT);
    throw new Error("Lieferscheine konnten nicht geladen werden.");
  }
  return (data ?? []) as DeliveryNote[];
}

export async function noteFileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/**
 * Wareneingang buchen: neue Materialien anlegen, Einkaufspreise aktualisieren, Bestand buchen.
 * Ziel Lager: Lieferant → Lager (Bestand steigt).
 * Ziel Auftrag: Lieferant → Projektleiter des Auftrags (Lagerbestand bleibt), dazu Zuweisung zum Auftrag (übergeben).
 */
export async function bookDeliveryNote(input: {
  tenantId: number;
  userId: number;
  filePath: string | null;
  head: { supplier: string; note_date: string | null; note_number: string; reference: string };
  target: "warehouse" | "order";
  orderId: number | null;
  projectManagerId: number | null;
  lines: BookLine[];
  materials: MaterialLite[];
}): Promise<{ booked: number; created: number; failed: string[] }> {
  const { tenantId, userId, head, target, orderId, projectManagerId, materials } = input;
  if (target === "order" && (!orderId || !projectManagerId)) throw new Error("Bitte einen Auftrag mit Projektleiter wählen.");
  const failed: string[] = [];
  let created = 0;

  // 1. neue Materialien anlegen und Preise aktualisieren
  const resolved: { material_id: number; name: string; unit: string; quantity: number; unit_price: number | null; created: boolean }[] = [];
  for (const l of input.lines) {
    let id = l.material_id;
    let name = "";
    let unit = "";
    let isNew = false;
    if (id == null) {
      const { data, error } = await supabase
        .from("materials")
        .insert({
          tenant_id: tenantId,
          name: l.new_name.trim().slice(0, 120) || "Neues Material",
          unit: l.new_unit.trim().slice(0, 20) || "Stk",
          stock_quantity: 0,
          minimum_quantity: 0,
          purchase_price: l.unit_price,
          supplier: head.supplier || null,
          is_active: true,
        })
        .select("id, name, unit")
        .single();
      if (error || !data) {
        failed.push(`${l.new_name}: Material konnte nicht angelegt werden`);
        continue;
      }
      id = Number(data.id);
      name = data.name;
      unit = data.unit;
      isNew = true;
      created++;
    } else {
      const m = materials.find((x) => x.id === id);
      name = m?.name ?? "";
      unit = m?.unit ?? "";
      if (l.unit_price != null && l.unit_price !== m?.purchase_price) {
        const patch: Record<string, unknown> = { purchase_price: l.unit_price, updated_at: new Date().toISOString() };
        if (!m?.supplier && head.supplier) patch.supplier = head.supplier;
        await supabase.from("materials").update(patch).eq("id", id).eq("tenant_id", tenantId);
      }
    }
    resolved.push({ material_id: id, name, unit, quantity: l.quantity, unit_price: l.unit_price, created: isNew });
  }

  // 2. Lieferschein speichern (Nachweis)
  const { data: note, error: noteErr } = await supabase
    .from("delivery_notes")
    .insert({
      tenant_id: tenantId,
      file_path: input.filePath,
      supplier: head.supplier || null,
      note_date: head.note_date || null,
      note_number: head.note_number || null,
      reference: head.reference || null,
      target,
      order_id: target === "order" ? orderId : null,
      lines: resolved,
      booked_by: userId,
    })
    .select("id")
    .single();
  if (noteErr) throw new Error(missingUpdate(noteErr.message) ? UPDATE_HINT : "Lieferschein konnte nicht gespeichert werden.");
  const noteId = Number(note.id);
  const label = [head.supplier, head.note_number ? `Nr. ${head.note_number}` : ""].filter(Boolean).join(" ");

  // 3. Bestand buchen
  let booked = 0;
  for (const r of resolved) {
    const { error } = await supabase.rpc("book_material_stock", {
      p_material_id: r.material_id,
      p_movement_type: "purchase",
      p_quantity: r.quantity,
      p_from_holder_type: "supplier",
      p_from_holder_id: null,
      p_to_holder_type: target === "order" ? "project_manager" : "warehouse",
      p_to_holder_id: target === "order" ? projectManagerId : null,
      p_order_id: target === "order" ? orderId : null,
      p_reference_type: "delivery_note",
      p_reference_id: noteId,
      p_note: `Lieferschein${label ? ` ${label}` : ""}${target === "order" ? " – direkt zum Auftrag" : ""}`.slice(0, 300),
    });
    if (error) {
      failed.push(`${r.name}: ${error.message}`);
      continue;
    }
    if (target === "order") {
      const { error: aErr } = await supabase.from("order_material_assignments").insert({
        tenant_id: tenantId,
        order_id: orderId,
        material_id: r.material_id,
        assigned_to_user_id: projectManagerId,
        assigned_by_user_id: userId,
        quantity: r.quantity,
        unit: r.unit || "Stk",
        status: "handed_over",
        updated_at: new Date().toISOString(),
      });
      if (aErr) failed.push(`${r.name}: gebucht, aber nicht in der Materialliste des Auftrags eingetragen`);
    }
    booked++;
  }
  return { booked, created, failed };
}
