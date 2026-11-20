// Zusatzmitarbeiter (je 19 € im Monat bzw. 190 € im Jahr): Anzeige und Buchung
import { supabase } from "./supabase";

export type SeatInfo = { plan: string; extra_seats: number; max_users: number; base_users: number; used: number };

/** Zusatzplätze und Mitarbeiter mit App-Zugang; null, wenn das Datenbank-Update noch fehlt */
export async function loadSeatInfo(tenantId: number | null | undefined): Promise<SeatInfo | null> {
  const { data, error } = await supabase.rpc("my_seat_info");
  if (error || !data) return null;
  let used = 0;
  if (tenantId) {
    const { count } = await supabase
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("app_access", true)
      .in("role_id", [3, 4]);
    used = count ?? 0;
  }
  const d = data as Omit<SeatInfo, "used">;
  return { ...d, extra_seats: Number(d.extra_seats || 0), base_users: Number(d.base_users || 0), max_users: Number(d.max_users || 0), used };
}

/** Anzahl Zusatzplätze setzen – bei bezahltem Abo rechnet Stripe anteilig ab */
export async function saveSeats(seats: number): Promise<void> {
  const { data: fresh } = await supabase.auth.refreshSession();
  const accessToken = fresh.session?.access_token ?? (await supabase.auth.getSession()).data.session?.access_token;
  if (!accessToken) throw new Error("Ihre Anmeldung ist abgelaufen. Bitte melden Sie sich neu an.");
  const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
    body: { action: "seats", seats },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) {
    let msg = "";
    try {
      const ctx = (error as { context?: Response }).context;
      msg = ctx ? String((await ctx.json())?.error ?? "") : "";
    } catch {
      /* keine Details */
    }
    throw new Error(msg || "Die zusätzlichen Mitarbeiter konnten nicht gespeichert werden.");
  }
  if (!data?.ok) throw new Error(data?.error || "Die zusätzlichen Mitarbeiter konnten nicht gespeichert werden.");
}
