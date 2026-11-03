// =====================================================================
// Vercel Routing Middleware (proxy, eingetragen in vercel.json) – eigene Adressen der Firmen-Websites
//
// Anfragen an  <betrieb>.maler-saas.com  oder an eine eigene Domain des Betriebs
// werden intern an /api/site weitergereicht (?host=…&page=…).
// Alles auf maler-saas.com, www.maler-saas.com, *.vercel.app und localhost läuft UNVERÄNDERT weiter.
// Bei jedem Fehler: unverändert weiter (die App darf nie durch diese Datei ausfallen).
// =====================================================================

import { next, rewrite } from "@vercel/functions";

/** Adressen der App selbst (nicht umleiten) */
const PLATFORM_HOST = /^(www\.)?maler-saas\.com$|\.vercel\.app$|^localhost$|^127\.0\.0\.1$/;
/** Subdomains, die nie zu einer Firmen-Website gehören */
const RESERVED_SUB = /^(www|app|api|admin|mail|smtp|imap|pop|ftp|webmail|autoconfig|autodiscover|status|cdn|static|assets)\.maler-saas\.com$/;

export function siteRewriteTarget(requestUrl: string, hostHeader: string | null): string | null {
  const url = new URL(requestUrl);
  const host = (hostHeader || url.host).toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host || PLATFORM_HOST.test(host) || RESERVED_SUB.test(host)) return null;
  const target = new URL("/api/site", url);
  target.searchParams.set("host", host);
  const page = url.pathname.replace(/^\/+|\/+$/g, "");
  if (page) target.searchParams.set("page", page);
  url.searchParams.forEach((v, k) => {
    if (k !== "host" && k !== "page" && k !== "slug") target.searchParams.set(k, v);
  });
  return target.toString();
}

export default function proxy(request: Request): Response {
  try {
    const target = siteRewriteTarget(request.url, request.headers.get("host"));
    return target ? rewrite(target) : next();
  } catch {
    return next();
  }
}
