// Grafik-Generator für MalerSaaS-Werbung (Canvas, ohne externe Bibliotheken)

export type Template = "funktion" | "tipp" | "angebot";
export type Format = "1x1" | "4x5" | "9x16";

export type GraphicSpec = {
  template: Template;
  format: Format;
  headline: string;
  subline: string;
  points: string[];
  imageUrl: string | null; // Screenshot / eigenes Bild
  footer: string; // z. B. maler-saas.com
};

export const FORMATS: Record<Format, { w: number; h: number; label: string }> = {
  "1x1": { w: 1080, h: 1080, label: "Quadrat 1:1 (Feed)" },
  "4x5": { w: 1080, h: 1350, label: "Hochformat 4:5 (Feed)" },
  "9x16": { w: 1080, h: 1920, label: "Story / Reel 9:16" },
};

export const TEMPLATES: Record<Template, string> = {
  funktion: "Funktion mit Screenshot",
  tipp: "Tipp-Kachel",
  angebot: "14 Tage kostenlos",
};

/** Mitgelieferte Screenshots der App (öffentliche Bilder der Website) */
export const SCREENSHOTS: { url: string; label: string }[] = [
  { url: "/images/Aufmaß.png", label: "Aufmaß" },
  { url: "/images/angebot-malersaas.png", label: "Angebot" },
  { url: "/images/auftragsverwaltung-malersaas.png", label: "Aufträge" },
  { url: "/images/zeiterfassung-malersaas.png", label: "Zeiterfassung" },
  { url: "/images/materialverwaltung-uebersicht-malersaas.png", label: "Material" },
  { url: "/images/rechnungen-malersaas.png", label: "Rechnungen" },
  { url: "/images/rechnung-pdf-malersaas.png", label: "Rechnung PDF" },
  { url: "/images/kundenportal-projektfortschritt.png", label: "Kundenportal" },
  { url: "/images/maler-saas-landing-collage.png", label: "Übersicht" },
];

const NAVY = "#0f172a";
const BLUE = "#1d4ed8";
const BLUE2 = "#2563eb";
const FONT = `"Inter", "Segoe UI", system-ui, -apple-system, Arial, sans-serif`;

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    img.src = url;
  });
}

/** Text auf Breite umbrechen; gibt Zeilen zurück (höchstens maxLines, letzte Zeile mit …) */
export function wrapLines(measure: (s: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (measure(test) <= maxWidth || !cur) cur = test;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight: number, color: string, maxLines: number, lineH = 1.15) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  const lines = wrapLines((s) => ctx.measureText(s).width, text, maxW, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lineH));
  return y + lines.length * size * lineH;
}

/** Bild „contain“ in einen Rahmen mit abgerundeten Ecken und Schatten */
function drawFramed(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, dx, dy, dw, dh, 22);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, dx, dy, dw, dh, 22);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function brand(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, y: number, light: boolean) {
  const size = 64;
  if (logo) {
    ctx.save();
    roundRect(ctx, x, y, size, size, 14);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, x + 6, y + 6, size - 12, size - 12);
    ctx.restore();
  }
  ctx.font = `800 38px ${FONT}`;
  ctx.fillStyle = light ? "#fff" : NAVY;
  ctx.textBaseline = "middle";
  ctx.fillText("MalerSaaS", x + (logo ? size + 18 : 0), y + size / 2 + 2);
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string, size = 30) {
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.4;
  const h = size * 1.9;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + size * 0.7, y + h / 2 + 1);
  return { w, h };
}

function checkList(ctx: CanvasRenderingContext2D, points: string[], x: number, y: number, maxW: number, size: number, color: string, accent: string) {
  let cy = y;
  for (const p of points.filter(Boolean).slice(0, 3)) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + size * 0.45, cy + size * 0.6, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = size * 0.12;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.22, cy + size * 0.62);
    ctx.lineTo(x + size * 0.4, cy + size * 0.8);
    ctx.lineTo(x + size * 0.7, cy + size * 0.42);
    ctx.stroke();
    cy = drawText(ctx, p, x + size * 1.3, cy, maxW - size * 1.3, size, 650, color, 2, 1.2) + size * 0.45;
  }
  return cy;
}

/** Zeichnet die Grafik in ein Canvas der Zielgröße */
export async function render(canvas: HTMLCanvasElement, spec: GraphicSpec, logoUrl = "/images/logo.png") {
  const { w, h } = FORMATS[spec.format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const [logo, img] = await Promise.all([
    loadImage(logoUrl).catch(() => null),
    spec.imageUrl ? loadImage(spec.imageUrl).catch(() => null) : Promise.resolve(null),
  ]);
  const pad = 72;
  const tall = h > w * 1.1;
  const story = spec.format === "9x16";
  const topY = story ? 150 : pad; // Story: oben Platz für die Profilzeile der App lassen
  // Hochformat ohne Bild: Inhalt weiter in die Mitte rücken und größer schreiben
  const airy = tall && !img;
  const shift = airy ? (story ? 300 : 90) : 0;
  const big = airy ? 1.18 : 1;

  if (spec.template === "tipp") {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = BLUE2;
    ctx.fillRect(0, 0, 18, h);
    brand(ctx, logo, pad, topY, false);
    let y = topY + 130 + shift;
    pill(ctx, "💡 TIPP FÜR MALERBETRIEBE", pad, y, "#dbeafe", BLUE, 28);
    y += 100;
    y = drawText(ctx, spec.headline || "Ihr Tipp", pad, y, w - pad * 2, Math.round((tall ? 82 : 74) * big), 850, NAVY, 4) + 30;
    if (spec.subline) y = drawText(ctx, spec.subline, pad, y, w - pad * 2, Math.round(38 * big), 500, "#334155", 3, 1.3) + 40;
    y = checkList(ctx, spec.points, pad, y, w - pad * 2, Math.round(40 * big), NAVY, BLUE2);
    if (img && h - y > 360) drawFramed(ctx, img, pad, y + 20, w - pad * 2, h - y - (story ? 330 : 190));
  } else {
    // dunkler Hintergrund (Funktion / Angebot)
    const g = ctx.createLinearGradient(0, 0, w, h);
    if (spec.template === "angebot") {
      g.addColorStop(0, BLUE);
      g.addColorStop(1, NAVY);
    } else {
      g.addColorStop(0, NAVY);
      g.addColorStop(1, "#1e3a8a");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // dezente Kreise
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.arc(w * 0.92, h * 0.12, w * 0.35, 0, Math.PI * 2);
    ctx.fill();
    brand(ctx, logo, pad, topY, true);
    let y = topY + 130 + shift;
    if (spec.template === "angebot") {
      pill(ctx, "14 TAGE KOSTENLOS", pad, y, "#facc15", NAVY, 32);
      y += 110;
    }
    y = drawText(ctx, spec.headline || "MalerSaaS", pad, y, w - pad * 2, Math.round((tall ? 86 : 76) * big), 850, "#fff", 3) + 26;
    if (spec.subline) y = drawText(ctx, spec.subline, pad, y, w - pad * 2, Math.round(38 * big), 500, "#cbd5e1", 3, 1.3) + 36;
    const imgSpace = h - y - (story ? 300 : 170);
    if (spec.template === "angebot" || !img || imgSpace < 300) {
      y = checkList(ctx, spec.points, pad, y, w - pad * 2, Math.round(42 * big), "#fff", "#22c55e");
      if (img && h - y > 420) drawFramed(ctx, img, pad, y + 20, w - pad * 2, h - y - (story ? 330 : 200));
    } else {
      drawFramed(ctx, img, pad, y + 10, w - pad * 2, imgSpace);
    }
  }

  // Fußzeile
  const fy = h - (story ? 250 : 110);
  if (spec.template === "tipp") {
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = BLUE;
    ctx.textBaseline = "middle";
    ctx.fillText(spec.footer || "maler-saas.com", pad, fy + 30);
  } else {
    pill(ctx, spec.footer || "maler-saas.com", pad, fy, "#fff", NAVY, 32);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Grafik konnte nicht erstellt werden."))), "image/png"));
}

/** Grafik direkt als PNG erzeugen (ohne sichtbares Canvas) */
export async function renderToBlob(spec: GraphicSpec): Promise<Blob> {
  const c = document.createElement("canvas");
  await render(c, spec);
  return canvasToBlob(c);
}
