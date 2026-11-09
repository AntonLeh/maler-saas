// =====================================================================
// owner-calendar – privater Abo-Link (iCal) für die Termine des Plattform-Inhabers
//   GET ?token=…  -> text/calendar  (Google Kalender, iPhone, Outlook)
// Der Token steht in owner_calendar_feed und wird im Owner-Dashboard erzeugt.
// Deploy:  npx supabase functions deploy owner-calendar --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildIcs, sameToken } from "./logic.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const token = (new URL(req.url).searchParams.get("token") ?? "").replace(/\.ics$/, "");
  if (token.length < 32) return new Response("Not found", { status: 404 });

  const { data: feed } = await db.from("owner_calendar_feed").select("token").eq("id", 1).maybeSingle();
  if (!feed || !sameToken(token, feed.token)) return new Response("Not found", { status: 404 });

  // Termine der letzten 12 Monate und alle künftigen (Serien immer)
  const since = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data, error } = await db
    .from("owner_appointments")
    .select("id, title, kind, starts_at, ends_at, all_day, location, url, notes, recur, recur_until, updated_at")
    .or(`ends_at.gte.${since},recur.neq.none`)
    .order("starts_at")
    .limit(2000);
  if (error) {
    console.error("owner-calendar", error.message);
    return new Response("Error", { status: 500 });
  }
  return new Response(buildIcs(data ?? []), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="malersaas-termine.ics"',
      "cache-control": "private, max-age=300",
    },
  });
});
