// Herkunft eines Besuchers (Werbe-Link) – nur im Arbeitsspeicher, keine Cookies, kein localStorage.
// Quellen: ?utm_source=…&utm_campaign=… oder Kurzlink /go/<code>-<kanal>.
// Wird bei der Registrierung mitgeschickt (signup_origin) und im Owner-Bereich ausgewertet.
import { supabase } from "./supabase";

export type Origin = { source: string; medium: string; campaign: string; code?: string; landing: string; at: string };

let current: Origin | null = null;

const SUFFIX: Record<string, string> = { f: "facebook", i: "instagram", l: "linkedin", v: "video", y: "youtube", g: "google", m: "email" };
export const SUFFIX_OF: Record<string, string> = Object.fromEntries(Object.entries(SUFFIX).map(([k, v]) => [v, k]));

const clean = (v: string | null, max = 80) => (v ?? "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, max);

/** Kurzlink zerlegen: „winter7k-f“ → { code: "winter7k", source: "facebook" } */
export function parseShort(path: string): { code: string; source: string } | null {
  const m = /^\/go\/([a-z0-9]{3,24})(?:-([a-z]))?\/?$/i.exec(path);
  if (!m) return null;
  return { code: m[1].toLowerCase(), source: SUFFIX[(m[2] ?? "").toLowerCase()] ?? "direkt" };
}

/** Beim Start der App einmal aufrufen */
export function captureAttribution(): void {
  try {
    const url = new URL(window.location.href);
    const short = parseShort(url.pathname);
    if (short) {
      current = { source: short.source, medium: "social", campaign: short.code, code: short.code, landing: "/go", at: new Date().toISOString() };
      // Adresse aufräumen, die App zeigt die Startseite
      window.history.replaceState({}, document.title, "/");
      void supabase.rpc("resolve_short_link", { p_code: short.code }).then(({ data }) => {
        if (current && current.code === short.code && typeof data === "string" && data) current = { ...current, campaign: data };
      });
      return;
    }
    const source = clean(url.searchParams.get("utm_source"));
    if (!source) return;
    current = {
      source,
      medium: clean(url.searchParams.get("utm_medium")) || "social",
      campaign: clean(url.searchParams.get("utm_campaign")) || "ohne",
      landing: url.pathname.slice(0, 80),
      at: new Date().toISOString(),
    };
    // UTM-Parameter aus der Adresse entfernen (andere Parameter bleiben)
    let changed = false;
    for (const k of [...url.searchParams.keys()]) {
      if (k.startsWith("utm_")) {
        url.searchParams.delete(k);
        changed = true;
      }
    }
    if (changed) window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : "") + url.hash);
  } catch {
    /* nie die App blockieren */
  }
}

export const getAttribution = (): Origin | null => current;
