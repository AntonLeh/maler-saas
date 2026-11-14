// MalerTreff: Nachweise (Gewerbeschein usw.) 30 Tage nach der Entscheidung der Moderation löschen
/* eslint-disable @typescript-eslint/no-explicit-any */
export const PROOF_KEEP_DAYS = 30;

export async function cleanupCommunityProofs(db: any, now = Date.now()): Promise<number> {
  const before = new Date(now - PROOF_KEEP_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("community_members")
    .select("id, proof_path")
    .not("proof_path", "is", null)
    .in("proof_status", ["geprueft", "abgelehnt"])
    .lt("proof_decided_at", before)
    .limit(200);
  if (error) {
    // Tabelle fehlt (Community-Update noch nicht eingespielt) – nichts zu tun
    console.warn("community proofs", error.message);
    return 0;
  }
  const rows = (data ?? []) as { id: number; proof_path: string }[];
  if (!rows.length) return 0;
  await db.storage.from("community-proofs").remove(rows.map((r) => r.proof_path));
  await db.from("community_members").update({ proof_path: null }).in("id", rows.map((r) => r.id));
  return rows.length;
}
