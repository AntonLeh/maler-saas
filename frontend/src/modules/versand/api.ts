// Versand über die Funktion „send-document“
import { supabase, supabaseUrl } from "../../lib/supabase";

export type MailAttachment = { name: string; content: string };

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    r.readAsDataURL(blob);
  });
}

export async function sendDocument(body: {
  kind: "invoice" | "reminder";
  invoice_id: number;
  reminder_id?: number;
  to: string;
  subject: string;
  text: string;
  copy: boolean;
  attachments: MailAttachment[];
}): Promise<{ sent_at: string; to: string; copy_to: string | null }> {
  const call = async (refresh: boolean) => {
    const { data } = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Bitte erneut anmelden.");
    return fetch(`${supabaseUrl}/functions/v1/send-document`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  };
  let res: Response;
  try {
    res = await call(false);
    if (res.status === 401) res = await call(true);
  } catch {
    throw new Error("Der Versand ist gerade nicht erreichbar. Ist die Funktion „send-document“ veröffentlicht?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Fehler beim Versand (Status ${res.status}).`);
  return data;
}

export type SentInfo = { invoice_id: number; kind: string; reminder_id: number | null; recipient: string; sent_at: string };

/** Versandprotokoll – vor dem Update (Tabelle fehlt) einfach leer */
export async function loadSentInfo(): Promise<SentInfo[]> {
  const { data, error } = await supabase
    .from("document_emails")
    .select("invoice_id, kind, reminder_id, recipient, sent_at")
    .order("sent_at", { ascending: false })
    .limit(5000);
  if (error) return [];
  return (data ?? []) as SentInfo[];
}
