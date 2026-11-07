// Vite-Erweiterung: erzeugt nach dem Bauen für jede öffentliche Seite eine eigene HTML-Datei
// mit richtigem Titel, Beschreibung und Hauptadresse (canonical) – damit Google das sofort sieht,
// ohne auf das Programm im Browser zu warten.
//
//   dist/index.html            Startseite  (canonical https://maler-saas.com/)
//   dist/app.html              alle anderen Adressen der App (ohne feste canonical-Angabe)
//   dist/seo/<seite>/index.html  je öffentliche Seite (siehe src/seo/seoPages.ts)
//
// Die Weiterleitungen dazu stehen in vercel.json. Schlägt etwas fehl, bricht der Build ab –
// dann bleibt die bisherige Version online.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { SEO_PAGES } from "./src/seo/seoPages";

const SITE = "https://maler-saas.com";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function replaceOnce(html: string, re: RegExp, value: string, what: string): string {
  if (!re.test(html)) throw new Error(`seoPrerender: ${what} nicht in index.html gefunden`);
  return html.replace(re, value);
}

export function pageHtml(base: string, p: { path: string; title: string; description: string; h1: string; intro: string }): string {
  const url = SITE + p.path;
  let h = base;
  h = replaceOnce(h, /<title>[\s\S]*?<\/title>/, `<title>${esc(p.title)}</title>`, "title");
  h = replaceOnce(h, /<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${esc(p.description)}" />`, "description");
  h = replaceOnce(h, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`, "canonical");
  h = replaceOnce(h, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`, "og:url");
  h = replaceOnce(h, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/, `<meta property="og:title" content="${esc(p.title)}" />`, "og:title");
  h = replaceOnce(h, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${esc(p.description)}" />`, "og:description");
  h = replaceOnce(h, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${esc(p.title)}" />`, "twitter:title");
  h = replaceOnce(h, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${esc(p.description)}" />`, "twitter:description");
  // Überschrift + Kurztext schon im HTML; React ersetzt das beim Start durch die richtige Seite
  const intro = p.intro || p.description;
  h = replaceOnce(
    h,
    /<div id="root"><\/div>/,
    `<div id="root"><main style="max-width:760px;margin:0 auto;padding:64px 16px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a"><h1 style="font-size:2rem;line-height:1.2;margin:0 0 16px">${esc(p.h1)}</h1><p style="font-size:1.1rem;line-height:1.6;color:#475569;margin:0">${esc(intro)}</p></main></div>`,
    "root"
  );
  return h;
}

export function appHtml(base: string): string {
  return replaceOnce(base, /\s*<link rel="canonical" href="[^"]*" \/>/, "", "canonical");
}

export default function seoPrerender(): Plugin {
  let outDir = "dist";
  return {
    name: "seo-prerender",
    apply: "build",
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const base = readFileSync(join(outDir, "index.html"), "utf8");
      writeFileSync(join(outDir, "app.html"), appHtml(base));
      const seen = new Set<string>();
      for (const p of SEO_PAGES) {
        const slug = p.path.replace(/^\/+|\/+$/g, "");
        if (!/^[a-z0-9-]+$/.test(slug) || seen.has(slug)) throw new Error(`seoPrerender: ungültige oder doppelte Seite ${p.path}`);
        seen.add(slug);
        const dir = join(outDir, "seo", slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "index.html"), pageHtml(base, p));
      }
    },
  };
}
