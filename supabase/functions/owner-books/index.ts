// @ts-nocheck
// =====================================================================
// Owner-Buchhaltung (Spanien) – nur für den Plattform-Inhaber (Rolle 1)
//
// POST …/functions/v1/owner-books   Authorization: Bearer <Login-Token>
//   { action: "sync" }                      Stripe-Rechnungen + Gutschriften ab Buchhaltungsbeginn übernehmen
//   { action: "scan", file_path: "…" }      Beleg (Bucket owner-receipts) per KI auslesen – nichts wird gespeichert
//   { action: "rate", from, date }          EZB-Kurs → EUR
// Secrets (vorhanden): STRIPE_SECRET_KEY, ANTHROPIC_API_KEY
// Deploy:  npx supabase functions deploy owner-books --no-verify-jwt   (Anmeldung wird selbst geprüft)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SCAN_PROMPT, SCAN_TOOL, cleanScan, mapCreditNote, mapInvoice, withEur } from "./logic.ts";
import { encodeBase64, exchangeRate, mediaTypeFor } from "../receipt-ai/logic.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

async function rateToEur(currency: string, date: string, cache: Map<string, number>) {
  if (currency === "EUR") return 1;
  const key = `${currency}|${date}`;
  if (cache.has(key)) return cache.get(key)!;
  const r = await exchangeRate(currency, "EUR", date);
  cache.set(key, r.rate);
  return r.rate;
}

async function callClaude(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  let last: any = null;
  for (const model of [...new Set([Deno.env.get("RECEIPT_AI_MODEL") || "claude-sonnet-5-5", "claude-haiku-5-5"])]) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    last = { status: res.status };
    console.error("anthropic", model, res.status, JSON.stringify(data).slice(0, 300));
    if (![400, 404].includes(res.status) || !JSON.stringify(data).includes("model")) break;
  }
  throw new Error(`anthropic ${last?.status}`);
}

async function sync() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
  const stripe = new Stripe(key, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });

  const { data: settings } = await db.from("owner_book_settings").select("books_start").eq("id", 1).maybeSingle();
  const start = String(settings?.books_start ?? "2026-11-03");
  const gte = Math.floor(new Date(`${start}T00:00:00Z`).getTime() / 1000) - 86400; // 1 Tag Puffer (Zeitzone)

  const { data: locked } = await db.from("owner_income").select("stripe_id").eq("treatment_locked", true);
  const lockedIds = new Set((locked ?? []).map((r) => r.stripe_id));

  const fx = new Map<string, number>();
  const rows: any[] = [];
  const byInvoice = new Map<string, any>();
  const warnings: string[] = [];

  for await (const inv of stripe.invoices.list({ status: "paid", created: { gte }, limit: 100, expand: ["data.total_tax_amounts.tax_rate"] })) {
    const row = mapInvoice(inv);
    if (row.issue_date < start) continue;
    if (row.total === 0 && row.net === 0) continue; // 0-€-Rechnungen (z. B. Testphase) nicht buchen
    let rate = 1;
    try {
      rate = await rateToEur(row.currency, row.issue_date, fx);
    } catch {
      warnings.push(`${row.number ?? row.stripe_id}: kein EZB-Kurs für ${row.currency} – bitte prüfen`);
    }
    const full = withEur(row, rate);
    byInvoice.set(row.stripe_id, full);
    rows.push(full);
  }

  for await (const cn of stripe.creditNotes.list({ created: { gte }, limit: 100 })) {
    const invId = typeof cn.invoice === "string" ? cn.invoice : cn.invoice?.id;
    let orig = invId ? byInvoice.get(invId) ?? null : null;
    if (!orig && invId) {
      const { data } = await db.from("owner_income").select("*").eq("stripe_id", invId).maybeSingle();
      orig = data ?? null;
    }
    const row = mapCreditNote(cn, orig);
    if (row.issue_date < start) continue;
    let rate = orig?.fx_rate ?? 1;
    if (row.currency !== "EUR" && !orig) {
      try {
        rate = await rateToEur(row.currency, row.issue_date, fx);
      } catch {
        /* Kurs 1 */
      }
    }
    rows.push(withEur(row, rate));
  }

  for (const r of rows) {
    if (lockedIds.has(r.stripe_id)) delete r.treatment;
    r.updated_at = new Date().toISOString();
  }
  // in Blöcken speichern
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("owner_income").upsert(rows.slice(i, i + 200), { onConflict: "stripe_id" });
    if (error) throw new Error(`Speichern fehlgeschlagen: ${error.message}`);
  }
  await db.from("owner_book_settings").update({ last_sync_at: new Date().toISOString() }).eq("id", 1);
  return { count: rows.length, warnings };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("id, role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || Number(user.role_id) !== 1) return json({ ok: false, error: "Nur für den Plattform-Inhaber." }, 403);

    const body = await req.json().catch(() => ({}));

    if (body.action === "sync") {
      const r = await sync();
      return json({ ok: true, ...r });
    }

    if (body.action === "rate") {
      const from = String(body.from ?? "").toUpperCase();
      const date = String(body.date ?? "");
      if (!/^[A-Z]{3}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok: false, error: "Ungültige Angaben." }, 400);
      try {
        const r = await exchangeRate(from, "EUR", date);
        return json({ ok: true, rate: r.rate, date: r.date });
      } catch {
        return json({ ok: false, error: `Für ${from} gibt es keinen EZB-Kurs. Bitte den Euro-Betrag selbst eintragen.` }, 502);
      }
    }

    if (body.action === "scan") {
      const path = String(body.file_path ?? "");
      if (!path || path.includes("..")) return json({ ok: false, error: "Ungültige Datei." }, 400);
      const { data: blob, error: dlErr } = await db.storage.from("owner-receipts").download(path);
      if (dlErr || !blob) return json({ ok: false, error: "Die Beleg-Datei wurde nicht gefunden." }, 404);
      const mediaType = mediaTypeFor(path, blob.type);
      if (!mediaType) return json({ ok: false, error: "Dieses Dateiformat kann die KI nicht lesen (JPG, PNG, WEBP oder PDF)." }, 400);
      if (blob.size > 10 * 1024 * 1024) return json({ ok: false, error: "Die Datei ist zu groß (höchstens 10 MB)." }, 400);
      const source = { type: "base64", media_type: mediaType, data: encodeBase64(new Uint8Array(await blob.arrayBuffer())) };
      const fileBlock = mediaType === "application/pdf" ? { type: "document", source } : { type: "image", source };
      const data = await callClaude({
        max_tokens: 1500,
        system: SCAN_PROMPT,
        tools: [SCAN_TOOL],
        tool_choice: { type: "tool", name: "gasto_daten" },
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: "Bitte lies diesen Beleg aus." }] }],
      });
      const block = (data.content ?? []).find((c: any) => c.type === "tool_use");
      const result = cleanScan(block?.input);
      if (!result) return json({ ok: false, error: "Der Beleg konnte nicht gelesen werden. Bitte die Angaben selbst eintragen." }, 422);
      return json({ ok: true, data: result });
    }

    return json({ ok: false, error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    console.error("owner-books", e);
    const msg = String(e?.message ?? e);
    return json({ ok: false, error: msg.includes("STRIPE") ? "Stripe ist nicht erreichbar oder der Schlüssel fehlt." : "Das hat gerade nicht geklappt. Bitte gleich noch einmal versuchen." }, 500);
  }
});
