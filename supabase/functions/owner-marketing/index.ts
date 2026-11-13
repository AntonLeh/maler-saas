// @ts-nocheck
// =====================================================================
// Owner-Werbung – KI-Texte für MalerSaaS (nur Plattform-Inhaber, Rolle 1)
//
// POST …/functions/v1/owner-marketing   Authorization: Bearer <Login-Token>
//   { topic, goal, keywords, youtube: boolean, image_paths?: string[] }   (Bilder im Bucket owner-marketing)
//   -> { ok, result: { title, graphic: {headline, subline, points}, texts: {...} } }   (gespeichert wird im Browser)
//   { action: "voice", text, voice: "female"|"male" }      -> { ok, audio: base64 (MP3) }   ElevenLabs Text-to-Speech
//   { action: "shotlist", topic, script }                 -> { ok, shotlist }   Drehanleitung fürs YouTube-Erklärvideo
//   { action: "plan", start, weeks, weekdays, mix, youtube_per_month } -> { ok, items }   Redaktionsplan-Vorschlag (nicht gespeichert)
//   { action: "seo_keywords" }                           -> { ok, items }   Suchbegriffe für Ratgeber-Artikel
//   { action: "seo_article", keyword, title? }          -> { ok, article }  Ratgeber-Artikel (gespeichert wird im Browser)
//   { action: "prepare", ids? }                            -> { ok, done, remaining }   Texte für bis zu 3 Beiträge ohne Texte schreiben
// POST …/owner-marketing?hook=<DELETION_HOOK_TOKEN>  { action: "auto" }  (Zeitplan, täglich): ab dem 25. Plan für den
//   Folgemonat (wenn Automatik an), danach je Lauf bis zu 3 Beiträge vorbereiten, Nachricht an den Inhaber, wenn fertig.
// Secrets (vorhanden): ANTHROPIC_API_KEY, ELEVENLABS_API_KEY (Berechtigung „Text to Speech“ nötig).
// Optional: OWNER_MARKETING_MODEL (Standard claude-sonnet-5-5), OWNER_VOICE_FEMALE / OWNER_VOICE_MALE (ElevenLabs-Stimmen-ID)
// Deploy:  npx supabase functions deploy owner-marketing --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SHOTLIST_PROMPT, SHOTLIST_TOOL, SYSTEM_PROMPT, TOOL, VOICES, cleanResult, cleanShotlist, speakable, userPrompt } from "./logic.ts";
import { KNOWLEDGE_WITH_PRICES } from "../help-chat/prompt.ts";
import { encodeBase64, mediaTypeFor } from "../receipt-ai/logic.ts";
import * as A from "./agent.ts";
import * as S from "./seo.ts";

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

/** Texte für einen Beitrag schreiben (gemeinsam für „Neuer Beitrag“ und den Agenten) */
async function writeTexts(topic: string, goal: string, keywords: string, youtube: boolean, paths: string[] = []) {
  const content: any[] = [];
  for (const p of paths.slice(0, 4)) {
    const { data: blob } = await db.storage.from("owner-marketing").download(p);
    if (!blob || blob.size > 4.5 * 1024 * 1024) continue;
    const mt = mediaTypeFor(p, blob.type);
    if (!mt || mt === "application/pdf") continue;
    content.push({ type: "image", source: { type: "base64", media_type: mt, data: encodeBase64(new Uint8Array(await blob.arrayBuffer())) } });
  }
  content.push({ type: "text", text: userPrompt({ topic: topic.slice(0, 200), goal, keywords, youtube, images: content.length }) });
  const data = await callClaude({
    max_tokens: youtube ? 6000 : 3500,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "werbung" },
    messages: [{ role: "user", content }],
  });
  const block = (data.content ?? []).find((c: any) => c.type === "tool_use");
  return cleanResult(block?.input, youtube);
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Themen der letzten 60 Tage und alle künftigen – damit der Agent nichts wiederholt */
async function recentTopics(): Promise<string[]> {
  const since = A.addDays(todayIso(), -60);
  const { data } = await db.from("owner_marketing_posts").select("topic, title, planned_for, created_at").or(`planned_for.gte.${since},created_at.gte.${since}T00:00:00`).limit(200);
  return [...new Set((data ?? []).map((p: any) => `${p.planned_for ?? String(p.created_at).slice(0, 10)}: ${p.topic}${p.title && p.title !== p.topic ? ` (${p.title})` : ""}`))];
}

async function makePlan(slotList: A.Slot[]): Promise<A.PlanItem[] | null> {
  if (!slotList.length) return [];
  const data = await callClaude({
    max_tokens: 6000,
    system: A.PLAN_SYSTEM,
    tools: [A.PLAN_TOOL],
    tool_choice: { type: "tool", name: "redaktionsplan" },
    messages: [{ role: "user", content: A.planPrompt(slotList, await recentTopics(), todayIso()) }],
  });
  const block = (data.content ?? []).find((c: any) => c.type === "tool_use");
  return A.cleanPlan(block?.input, slotList);
}

function buildSlots(dates: string[], mix: A.Mix, youtubePerMonth: number): A.Slot[] {
  const goals = A.goalSequence(dates.length, mix);
  const span = dates.length ? (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000 + 1 : 30;
  const yt = A.youtubeFlags(goals, youtubePerMonth, Math.max(7, span));
  return dates.map((date, i) => ({ date, goal: goals[i], youtube: yt[i] }));
}

/** Bis zu `limit` Beiträge ohne Texte vorbereiten (parallel) */
async function prepare(ids: number[] | null, limit = 3) {
  let q = db.from("owner_marketing_posts").select("*").neq("status", "veroeffentlicht").order("planned_for", { ascending: true, nullsFirst: false }).limit(200);
  if (ids?.length) q = q.in("id", ids);
  const { data } = await q;
  const open = (data ?? []).filter((p: any) => A.emptyTexts(p.texts) && !(p.prepare_error && !ids?.length));
  const batch = open.slice(0, limit);
  // Bildbibliothek (Design-Agent); ohne Datenbank-Update leer
  const { data: lib } = await db.from("owner_marketing_images").select("id, path, description, tags, last_used_at").limit(500);
  const images: A.LibImage[] = lib ?? [];
  const taken = new Set<string>();
  const photoFor = new Map<number, A.LibImage | null>();
  for (const p of batch) {
    const img = images.length ? A.pickImage(images, [p.topic, p.hook, p.keywords].filter(Boolean).join(" "), p.goal, p.planned_for, taken) : null;
    if (img) taken.add(img.path);
    photoFor.set(p.id, img);
  }
  const results = await Promise.allSettled(
    batch.map(async (p: any) => {
      const yt = Array.isArray(p.channels) && p.channels.includes("youtube");
      const kw = [p.hook ? `Aufhänger: ${p.hook}` : "", p.keywords ? `Stichworte: ${p.keywords}` : ""].filter(Boolean).join("\n");
      const r = await writeTexts(p.topic, p.goal, kw, yt, Array.isArray(p.images) ? p.images : []);
      if (!r) throw new Error("leer");
      const photo = photoFor.get(p.id) ?? null;
      const g = p.graphic && p.graphic.headline ? p.graphic : A.graphicFor(p.goal, p.topic, r.graphic, photo?.path ?? null);
      if (photo && g.image === photo.path) await db.from("owner_marketing_images").update({ last_used_at: new Date().toISOString() }).eq("id", photo.id);
      const { error } = await db
        .from("owner_marketing_posts")
        .update({ title: r.title || p.topic, texts: r.texts, graphic: g, utm_campaign: p.utm_campaign || A.campaignSlug(r.title || p.topic), prepare_error: null, updated_at: new Date().toISOString() })
        .eq("id", p.id);
      if (error) throw error;
    }),
  );
  let done = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") done++;
    else {
      console.error("prepare", batch[i].id, (results[i] as PromiseRejectedResult).reason);
      await db.from("owner_marketing_posts").update({ prepare_error: "Texte konnten nicht erstellt werden – bitte erneut versuchen." }).eq("id", batch[i].id);
    }
  }
  return { done, failed: results.length - done, remaining: Math.max(0, open.length - done) };
}

/** Täglicher Lauf (Zeitplan) */
async function autoRun() {
  const { data: s } = await db.from("owner_marketing_agent").select("*").eq("id", 1).maybeSingle();
  const today = todayIso();
  const month = A.nextMonth(today);
  const out: Record<string, unknown> = { planned: 0 };
  if (s?.auto_enabled && Number(today.slice(8, 10)) >= 25 && s.last_plan_month !== month) {
    const weekdays = A.cleanWeekdays(s.weekdays);
    const items = await makePlan(buildSlots(A.monthSlots(month, weekdays), A.cleanMix(s.mix), Number(s.youtube_per_month) || 0));
    if (items?.length) {
      const channels = (s.channels ?? []).filter((c: string) => A.ALL_CHANNELS.includes(c));
      const rows = items.map((it) => ({
        topic: it.topic,
        goal: it.goal,
        keywords: it.keywords || null,
        hook: it.hook || null,
        agent_reason: it.reason || null,
        title: it.topic,
        texts: {},
        status: "entwurf",
        planned_for: it.date,
        source: "agent",
        plan_month: month,
        channels: it.youtube ? [...new Set([...channels, "youtube"])] : channels.filter((c: string) => c !== "youtube"),
      }));
      const { error } = await db.from("owner_marketing_posts").insert(rows);
      if (!error) {
        await db.from("owner_marketing_agent").update({ last_plan_month: month, updated_at: new Date().toISOString() }).eq("id", 1);
        out.planned = rows.length;
      } else console.error("auto insert", error);
    }
  }
  out.prepare = await prepare(null, 3);
  // Nachricht, sobald der Plan des Monats komplett vorbereitet ist
  const planMonth = s?.last_plan_month && s.last_plan_month !== s.notified_month ? s.last_plan_month : out.planned ? month : null;
  if (planMonth) {
    const { data: posts } = await db.from("owner_marketing_posts").select("texts").eq("plan_month", planMonth).eq("source", "agent");
    if (posts?.length && posts.every((p: any) => !A.emptyTexts(p.texts))) {
      const { data: owners } = await db.from("app_users").select("id, tenant_id").eq("role_id", 1);
      const label = new Date(`${planMonth}-01T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      for (const o of owners ?? []) {
        await db.from("messages").insert({ tenant_id: o.tenant_id, sender_id: o.id, recipient_id: o.id, order_id: null, message_type: "direct", message: `🤖 Werbeplan für ${label} ist fertig: ${posts.length} Beiträge warten unter Owner → Werbung → „Zur Freigabe“.`, image_url: null }).then(() => null, () => null);
      }
      await db.from("owner_marketing_agent").update({ notified_month: planMonth }).eq("id", 1);
      out.notified = planMonth;
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    // ---------- Zeitplan (ohne Anmeldung, mit Schlüssel) ----------
    const hook = new URL(req.url).searchParams.get("hook") ?? "";
    if (hook) {
      const expected = Deno.env.get("DELETION_HOOK_TOKEN");
      if (!expected || hook !== expected) return json({ ok: false, error: "Ungültiger Schlüssel." }, 403);
      return json({ ok: true, ...(await autoRun()) });
    }

    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: authData } = token ? await db.auth.getUser(token) : { data: null };
    if (!authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || Number(user.role_id) !== 1) return json({ ok: false, error: "Nur für den Plattform-Inhaber." }, 403);

    const body = await req.json().catch(() => ({}));

    // ---------- Stimme ----------
    if (body.action === "voice") {
      const key = Deno.env.get("ELEVENLABS_API_KEY");
      if (!key) return json({ ok: false, error: "Der ElevenLabs-Schlüssel fehlt." }, 500);
      const text = speakable(String(body.text ?? ""));
      if (!text) return json({ ok: false, error: "Kein Text zum Sprechen." }, 400);
      const which = body.voice === "male" ? "male" : "female";
      const voiceId = Deno.env.get(which === "male" ? "OWNER_VOICE_MALE" : "OWNER_VOICE_FEMALE") || VOICES[which];
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        console.error("elevenlabs tts", res.status, detail);
        const msg =
          res.status === 401 || /permission|missing_permissions/i.test(detail)
            ? "ElevenLabs lehnt ab: Bitte beim API-Schlüssel die Berechtigung „Text to Speech“ einschalten."
            : res.status === 404 || /voice/i.test(detail)
              ? "Diese Stimme gibt es in Ihrem ElevenLabs-Konto nicht. Bitte die andere Stimme wählen oder eine Stimmen-ID hinterlegen."
              : /quota|credits/i.test(detail)
                ? "Das ElevenLabs-Guthaben ist aufgebraucht."
                : "Die Stimme konnte gerade nicht erzeugt werden.";
        return json({ ok: false, error: msg }, 502);
      }
      return json({ ok: true, audio: encodeBase64(new Uint8Array(await res.arrayBuffer())) });
    }

    // ---------- Drehanleitung ----------
    if (body.action === "shotlist") {
      const data = await callClaude({
        max_tokens: 4000,
        system: SHOTLIST_PROMPT.replace("{FACTS}", KNOWLEDGE_WITH_PRICES),
        tools: [SHOTLIST_TOOL],
        tool_choice: { type: "tool", name: "drehanleitung" },
        messages: [{
          role: "user",
          content: `Thema: ${String(body.topic ?? "").slice(0, 200)}\n\nVorhandenes Skript (falls vorhanden):\n<skript>\n${String(body.script ?? "").slice(0, 6000)}\n</skript>\n\nErstelle die Drehanleitung.`,
        }],
      });
      const block = (data.content ?? []).find((c: any) => c.type === "tool_use");
      const shotlist = cleanShotlist(block?.input);
      if (!shotlist) return json({ ok: false, error: "Die Drehanleitung konnte nicht erstellt werden. Bitte noch einmal versuchen." }, 422);
      return json({ ok: true, shotlist });
    }

    // ---------- Agent: Plan vorschlagen ----------
    if (body.action === "plan") {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(String(body.start ?? "")) ? String(body.start) : A.addDays(todayIso(), 1);
      const dates = A.slots(start, Number(body.weeks) || 4, A.cleanWeekdays(body.weekdays)).slice(0, 40);
      if (!dates.length) return json({ ok: false, error: "Im Zeitraum liegt kein gewählter Wochentag." }, 400);
      const items = await makePlan(buildSlots(dates, A.cleanMix(body.mix), Number(body.youtube_per_month) || 0));
      if (!items?.length) return json({ ok: false, error: "Der Plan konnte nicht erstellt werden. Bitte noch einmal versuchen." }, 422);
      return json({ ok: true, items });
    }

    // ---------- Agent: Texte für übernommene Beiträge schreiben ----------
    if (body.action === "prepare") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 100);
      return json({ ok: true, ...(await prepare(ids.length ? ids : null, 3)) });
    }

    // ---------- SEO-Agent ----------
    if (body.action === "seo_keywords") {
      const { data: arts } = await db.from("owner_articles").select("keyword, title").limit(500);
      const existing = (arts ?? []).flatMap((a: any) => [a.keyword, a.title]).filter(Boolean);
      const data = await callClaude({
        max_tokens: 3000,
        system: S.KEYWORD_SYSTEM,
        tools: [S.KEYWORD_TOOL],
        tool_choice: { type: "tool", name: "suchbegriffe" },
        messages: [{ role: "user", content: `Bereits vorhandene Artikel:\n<vorhanden>\n${existing.slice(0, 200).map((t: string) => `- ${String(t).slice(0, 100)}`).join("\n") || "(noch keine)"}\n</vorhanden>\n\nSchlage 10 neue Suchbegriffe vor.` }],
      });
      const items = S.cleanKeywords((data.content ?? []).find((c: any) => c.type === "tool_use")?.input, existing);
      if (!items.length) return json({ ok: false, error: "Es konnten keine Vorschläge erstellt werden. Bitte noch einmal versuchen." }, 422);
      return json({ ok: true, items });
    }
    if (body.action === "seo_article") {
      const keyword = String(body.keyword ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (!keyword) return json({ ok: false, error: "Bitte einen Suchbegriff angeben." }, 400);
      const data = await callClaude({
        max_tokens: 8000,
        system: S.ARTICLE_SYSTEM,
        tools: [S.ARTICLE_TOOL],
        tool_choice: { type: "tool", name: "artikel" },
        messages: [{ role: "user", content: `Suchbegriff: ${keyword}\nArbeitstitel: ${String(body.title ?? "").slice(0, 90) || "(frei)"}\n\nSchreibe den Artikel.` }],
      });
      const article = S.cleanArticle((data.content ?? []).find((c: any) => c.type === "tool_use")?.input, keyword);
      if (!article) return json({ ok: false, error: "Der Artikel konnte nicht erstellt werden. Bitte noch einmal versuchen." }, 422);
      return json({ ok: true, article });
    }

    // ---------- Design-Agent: Bilder beschreiben ----------
    if (body.action === "tag_images") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 200);
      let q = db.from("owner_marketing_images").select("id, path").is("description", null).order("id").limit(200);
      if (ids.length) q = db.from("owner_marketing_images").select("id, path").in("id", ids).order("id");
      const { data: todo, error } = await q;
      if (error) return json({ ok: false, error: "Für die Bildbibliothek fehlt noch das Datenbank-Update (SQL „Owner-Bilder“)." }, 400);
      const batch = (todo ?? []).slice(0, 4);
      const results = await Promise.allSettled(
        batch.map(async (img: any) => {
          const { data: blob } = await db.storage.from("owner-marketing").download(img.path);
          if (!blob || blob.size > 4.5 * 1024 * 1024) throw new Error("Bild zu groß");
          const mt = mediaTypeFor(img.path, blob.type);
          if (!mt || mt === "application/pdf") throw new Error("Format");
          const data = await callClaude({
            max_tokens: 600,
            tools: [A.IMAGE_TOOL],
            tool_choice: { type: "tool", name: "bild" },
            messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mt, data: encodeBase64(new Uint8Array(await blob.arrayBuffer())) } }, { type: "text", text: A.IMAGE_PROMPT }] }],
          });
          const info = A.cleanImageInfo((data.content ?? []).find((c: any) => c.type === "tool_use")?.input);
          if (!info) throw new Error("leer");
          const { error: upErr } = await db.from("owner_marketing_images").update(info).eq("id", img.id);
          if (upErr) throw upErr;
        }),
      );
      const done = results.filter((r) => r.status === "fulfilled").length;
      for (const r of results) if (r.status === "rejected") console.error("tag_images", r.reason);
      return json({ ok: true, done, failed: batch.length - done, remaining: Math.max(0, (todo ?? []).length - done) });
    }

    // ---------- Agent: Automatik jetzt ausführen (zum Testen) ----------
    if (body.action === "auto") return json({ ok: true, ...(await autoRun()) });

    const youtube = !!body.youtube;
    const paths: string[] = (Array.isArray(body.image_paths) ? body.image_paths : []).filter((p: unknown) => typeof p === "string" && !p.includes("..")).slice(0, 4);
    const result = await writeTexts(String(body.topic ?? ""), String(body.goal ?? "frei"), String(body.keywords ?? ""), youtube, paths);
    if (!result) return json({ ok: false, error: "Die KI hat keinen brauchbaren Text geliefert. Bitte noch einmal versuchen." }, 422);
    return json({ ok: true, result });
  } catch (e) {
    console.error("owner-marketing", e);
    return json({ ok: false, error: "Die Texte konnten gerade nicht erstellt werden. Bitte gleich noch einmal versuchen." }, 500);
  }
});
