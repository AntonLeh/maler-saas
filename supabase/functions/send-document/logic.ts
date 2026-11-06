// Reine Hilfsfunktionen für den Versand (ohne Netzwerk) – testbar

export const MAX_PER_DAY = 200;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function cleanEmail(v: unknown): string | null {
  const e = String(v ?? "").trim();
  if (e.length > 200 || !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[A-Za-z]{2,}$/.test(e)) return null;
  return e;
}

/** Absendername: Firmenname ohne Zeichen, die im Kopf stören */
export function senderName(company: unknown): string {
  const n = String(company ?? "").replace(/[<>"\r\n@]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
  return n || "Rechnung";
}

export function cleanSubject(v: unknown): string {
  return String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

export function cleanFileName(v: unknown): string | null {
  const n = String(v ?? "").replace(/[\\/:*?"<>|\r\n]+/g, "-").trim();
  if (!/\.(pdf|xml)$/i.test(n) || n.length > 120) return null;
  return n;
}

/** Text der E-Mail (vom Nutzer bearbeitbar) als einfaches HTML */
/** Nur öffentliche https-Bild-URLs als Logo zulassen */
export function logoUrl(v: unknown): string | null {
  const u = String(v ?? "").trim();
  if (!/^https:\/\/[^\s"'<>]+$/i.test(u) || u.length > 1000) return null;
  return u;
}

export function bodyHtml(text: string, footer: string[], logo?: { url: string | null; alt: string }): string {
  const paras = text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  const foot = footer.filter(Boolean).map(esc).join(" · ");
  const head = logo?.url
    ? `<p style="margin:0 0 20px"><img src="${esc(logo.url)}" alt="${esc(logo.alt)}" style="max-width:200px;max-height:80px;width:auto;height:auto;border:0;display:block"></p>\n`
    : "";
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">
${head}${paras}
${foot ? `<p style="margin:24px 0 0;padding-top:10px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">${foot}</p>` : ""}
</div>`;
}

export function base64Size(b64: string): number {
  const s = b64.replace(/\s/g, "");
  return Math.floor((s.length * 3) / 4) - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
}
