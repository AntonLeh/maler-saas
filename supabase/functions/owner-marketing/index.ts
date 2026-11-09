// @ts-nocheck
// =====================================================================
// Owner-Werbung – KI-Texte für MalerSaaS (nur Plattform-Inhaber, Rolle 1)
//
// POST …/functions/v1/owner-marketing   Authorization: Bearer <Login-Token>
//   { topic, goal, keywords, youtube: boolean, image_paths?: string[] }   (Bilder im Bucket owner-marketing)
//   -> { ok, result: { title, graphic: {headline, subline, points}, texts: {...} } }   (gespeichert wird im Browser)
// Secrets (vorhanden): ANTHROPIC_API_KEY.  Optional: OWNER_MARKETING_MODEL (Standard claude-sonnet-5-5)
// Deploy:  npx supabase functions deploy owner-marketing --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SYSTEM_PROMPT, TOOL, cleanResult, userPrompt } from "./logic.ts";
import { encodeBase64, mediaTypeFor } from "../receipt-ai/logic.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

async function callClaude(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  let last: any = null;
  for (const model of [...new Set([Deno.env.get("OWNER_MARKETING_MODEL") || "claude-sonnet-5-5", "claude-haiku-5-5"])]) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    last = res.status;
    console.error("anthropic", model, res.status, JSON.stringify(data).slice(0, 300));
    if (![400, 404].includes(res.status) || !JSON.stringify(data).includes("model")) break;
  }
  throw new Error(`anthropic ${last}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: authData } = token ? await db.auth.getUser(token) : { data: null };
    if (!authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || Number(user.role_id) !== 1) return json({ ok: false, error: "Nur für den Plattform-Inhaber." }, 403);

    const body = await req.json().catch(() => ({}));
    const youtube = !!body.youtube;
    const paths: string[] = (Array.isArray(body.image_paths) ? body.image_paths : []).filter((p: unknown) => typeof p === "string" && !p.includes("..")).slice(0, 4);

    const content: any[] = [];
    for (const p of paths) {
      const { data: blob } = await db.storage.from("owner-marketing").download(p);
      if (!blob || blob.size > 4.5 * 1024 * 1024) continue;
      const mt = mediaTypeFor(p, blob.type);
      if (!mt || mt === "application/pdf") continue;
      content.push({ type: "image", source: { type: "base64", media_type: mt, data: encodeBase64(new Uint8Array(await blob.arrayBuffer())) } });
    }
    content.push({
      type: "text",
      text: userPrompt({ topic: String(body.topic ?? "").slice(0, 200), goal: String(body.goal ?? "frei"), keywords: String(body.keywords ?? ""), youtube, images: content.length }),
    });

    const data = await callClaude({
      max_tokens: youtube ? 6000 : 3500,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "werbung" },
      messages: [{ role: "user", content }],
    });
    const block = (data.content ?? []).find((c: any) => c.type === "tool_use");
    const result = cleanResult(block?.input, youtube);
    if (!result) return json({ ok: false, error: "Die KI hat keinen brauchbaren Text geliefert. Bitte noch einmal versuchen." }, 422);
    return json({ ok: true, result });
  } catch (e) {
    console.error("owner-marketing", e);
    return json({ ok: false, error: "Die Texte konnten gerade nicht erstellt werden. Bitte gleich noch einmal versuchen." }, 500);
  }
});
