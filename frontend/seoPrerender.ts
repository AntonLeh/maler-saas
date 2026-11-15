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

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/** Volle Seite statt Kurztext: vorab gerendertes HTML sichtbar in #ssr, die App startet unsichtbar in #root
 *  und blendet #ssr aus, sobald sie fertig ist (siehe src/main.tsx). Ohne JavaScript bleibt #ssr stehen. */
export function withFullPage(html: string, body: string, cssFiles: string[]): string {
  let h = html.replace(
    /<div id="root">[\s\S]*?<\/main><\/div>/,
    () => `<div id="ssr">${body}</div><div id="root" data-ssr="1" style="display:none"></div>`,
  );
  if (!h.includes('<div id="ssr">')) throw new Error("seoPrerender: Platz für die volle Seite nicht gefunden");
  if (cssFiles.length) h = h.replace("</head>", () => `${cssFiles.map((f) => `<link rel="stylesheet" href="/${f}" />`).join("")}</head>`);
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
    async closeBundle() {
      const base = readFileSync(join(outDir, "index.html"), "utf8");
      // CSS-Dateien der einzelnen Seiten aus dem Build-Verzeichnis (manifest)
      const manifestPath = join(outDir, ".vite", "manifest.json");
      const manifest: Record<string, { css?: string[]; imports?: string[] }> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
      const cssOf = (src: string | null) => {
        if (!src || !manifest[src]) return [];
        const out = new Set<string>();
        const walk = (k: string, depth: number) => {
          const e = manifest[k];
          if (!e || depth > 4) return;
          (e.css ?? []).forEach((c) => out.add(c));
          (e.imports ?? []).forEach((i) => walk(i, depth + 1));
        };
        walk(src, 0);
        return [...out].filter((c) => !base.includes(c)); // schon in index.html eingebunden
      };
      // Seiten-Komponenten im Build-Prozess laden (Vite übersetzt TSX/CSS-Importe)
      const ssr: { render: ((path: string) => { html: string; source: string | null } | null) | null } = { render: null };
      let server: { ssrLoadModule: (id: string) => Promise<Record<string, unknown>>; close: () => Promise<void> } | null = null;
      try {
        const { createServer } = await import("vite");
        const react = (await import("@vitejs/plugin-react")).default;
        server = await createServer({ configFile: false, plugins: [react()], root: process.cwd(), logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false } });
        ssr.render = (await server.ssrLoadModule("/src/seo/ssrPages.tsx")).renderPage as typeof ssr.render;
      } catch (e) {
        console.warn("seoPrerender: volle Seiten nicht möglich, nur Überschrift + Kurztext:", e);
      }
      writeFileSync(join(outDir, "app.html"), appHtml(base));
      const seen = new Set<string>();
      for (const p of SEO_PAGES) {
        const slug = p.path.replace(/^\/+|\/+$/g, "");
        if (!/^[a-z0-9-]+$/.test(slug) || seen.has(slug)) throw new Error(`seoPrerender: ungültige oder doppelte Seite ${p.path}`);
        seen.add(slug);
        const dir = join(outDir, "seo", slug);
        mkdirSync(dir, { recursive: true });
        let html = pageHtml(base, p);
        try {
          const full = ssr.render?.(p.path);
          if (full && full.html.length > 500) html = withFullPage(html, full.html, cssOf(full.source));
        } catch (e) {
          console.warn(`seoPrerender: ${p.path} nur mit Kurztext:`, e);
        }
        writeFileSync(join(dir, "index.html"), html);
      }
      await server?.close();
      rmSync(join(outDir, ".vite"), { recursive: true, force: true }); // Manifest nicht veröffentlichen
    },
  };
}
