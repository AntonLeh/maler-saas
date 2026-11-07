// Hilfen für das vollständige Löschen einer Firma (ohne Netzwerk testbar)

/** Speicherordner und wie die Dateien einer Firma darin abgelegt sind */
export const TENANT_BUCKETS = ["receipts", "company-logos", "website-media", "message-images", "site-visit-images"]; // Ordner = tenant_id
export const ORDER_BUCKET = "order-progress-images"; // Ordner = order_id

type ListItem = { name: string; id: string | null; metadata?: unknown };
export type StorageLike = {
  from(bucket: string): {
    list(path: string, opts: { limit: number; offset: number }): Promise<{ data: ListItem[] | null; error: { message: string } | null }>;
    remove(paths: string[]): Promise<{ error: { message: string } | null }>;
  };
};

/** Alle Dateipfade unter einem Ordner (rekursiv) */
export async function listAll(storage: StorageLike, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    const items = data ?? [];
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      // Ordner haben keine id
      if (it.id === null) out.push(...(await listAll(storage, bucket, path, depth + 1)));
      else out.push(path);
    }
    if (items.length < 1000) break;
  }
  return out;
}

export async function removeAll(storage: StorageLike, bucket: string, paths: string[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error } = await storage.from(bucket).remove(chunk);
    if (error) throw new Error(`${bucket}: ${error.message}`);
    n += chunk.length;
  }
  return n;
}

/** Bestätigung: der eingegebene Firmenname muss passen (Groß-/Kleinschreibung und Leerzeichen egal) */
export const sameName = (a: unknown, b: unknown) =>
  String(a ?? "").replace(/\s+/g, " ").trim().toLowerCase() === String(b ?? "").replace(/\s+/g, " ").trim().toLowerCase();
