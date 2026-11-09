// Video-Generator: Hochkant-Video (1080×1920) aus Szenen mit Bild, Text und optional KI-Stimme.
// Läuft komplett im Browser (Canvas + MediaRecorder).

import { loadImage, wrapLines } from "./graphic";

export type Scene = { text: string; image: string | null; seconds: number; hint?: string };

/**
 * Skript der KI in Szenen zerlegen.
 * Erwartetes Format je Zeile: „0–3 s | BILD: … | TEXT/STIMME: …“ (tolerant gegenüber Abweichungen)
 */
export function parseScript(script: string): Scene[] {
  const scenes: Scene[] = [];
  for (const raw of String(script ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("|").map((p) => p.trim());
    let seconds = 4;
    const time = line.match(/(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)\s*s/i);
    if (time) seconds = Math.max(1.5, Number(time[2].replace(",", ".")) - Number(time[1].replace(",", ".")));
    const pick = (re: RegExp) => parts.find((p) => re.test(p))?.replace(re, "").trim() ?? "";
    const text = pick(/^(TEXT\s*\/\s*STIMME|STIMME\s*\/\s*TEXT|TEXT|STIMME|SPRECHER|VOICE)\s*:\s*/i);
    const hint = pick(/^(BILD|SZENE|VISUAL|ZEIGEN)\s*:\s*/i);
    if (!text && parts.length === 1 && !time) {
      // freie Zeile ohne Format
      scenes.push({ text: line.replace(/^[-–•*]\s*/, ""), image: null, seconds: 4 });
      continue;
    }
    if (text) scenes.push({ text: text.replace(/^[„"]|[“"]$/g, ""), image: null, seconds: Math.min(12, seconds), hint });
  }
  return scenes.slice(0, 10);
}

export type RenderOptions = {
  scenes: Scene[];
  imageUrls: (string | null)[]; // bereits aufgelöste Bild-URLs je Szene
  audio: (ArrayBuffer | null)[]; // MP3 je Szene (oder null)
  logoUrl?: string;
  endText?: string;
  onProgress?: (p: number) => void;
  preview?: HTMLCanvasElement | null;
};

const W = 1080;
const H = 1920;
const NAVY = "#0f172a";
const FONT = `"Inter", "Segoe UI", system-ui, -apple-system, Arial, sans-serif`;

export function pickMime(): string {
  const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const m of list) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* weiter */
    }
  }
  return "";
}

export const canRecord = () => typeof MediaRecorder !== "undefined" && !!pickMime() && typeof HTMLCanvasElement.prototype.captureStream === "function";

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawScene(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, text: string, local: number, dur: number, logo: HTMLImageElement | null) {
  // Hintergrund
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, NAVY);
  g.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const p = Math.min(1, local / Math.max(0.1, dur));
  if (img) {
    // unscharfer, abgedunkelter Hintergrund aus dem Bild
    const cover = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.filter = "blur(18px)";
    ctx.drawImage(img, (W - img.naturalWidth * cover) / 2, (H - img.naturalHeight * cover) / 2, img.naturalWidth * cover, img.naturalHeight * cover);
    ctx.restore();
    // Bild im Rahmen mit langsamem Zoom
    const boxW = W - 120;
    const boxH = 1050;
    const fit = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight) * (1 + 0.06 * p);
    const dw = img.naturalWidth * fit;
    const dh = img.naturalHeight * fit;
    const dx = (W - dw) / 2;
    const dy = 260 + (boxH - dh) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    rr(ctx, dx, dy, dw, dh, 26);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, dx, dy, dw, dh, 26);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }
  // Logo oben
  if (logo) {
    ctx.save();
    rr(ctx, 60, 120, 72, 72, 16);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, 66, 126, 60, 60);
    ctx.restore();
  }
  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText("MalerSaaS", logo ? 150 : 60, 158);
  // Text unten (Untertitel), mit kurzer Einblendung
  const appear = Math.min(1, local / 0.35);
  const size = img ? 58 : 76;
  ctx.font = `800 ${size}px ${FONT}`;
  const lines = wrapLines((s) => ctx.measureText(s).width, text, W - 200, img ? 4 : 7);
  const boxH = lines.length * size * 1.22 + 70;
  const boxY = img ? H - boxH - 230 : (H - boxH) / 2;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.translate(0, (1 - appear) * 30);
  rr(ctx, 60, boxY, W - 120, boxH, 30);
  ctx.fillStyle = img ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.fillStyle = img ? NAVY : "#fff";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, 100, boxY + 35 + i * size * 1.22));
  ctx.restore();
}

function drawEnd(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, endText: string, local: number) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1d4ed8");
  g.addColorStop(1, NAVY);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const a = Math.min(1, local / 0.4);
  ctx.save();
  ctx.globalAlpha = a;
  if (logo) {
    rr(ctx, W / 2 - 90, 560, 180, 180, 36);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.drawImage(logo, W / 2 - 75, 575, 150, 150);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";
  ctx.font = `850 92px ${FONT}`;
  ctx.fillText("MalerSaaS", W / 2, 790);
  ctx.font = `600 48px ${FONT}`;
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(endText, W / 2, 920);
  // Pille
  ctx.font = `800 52px ${FONT}`;
  const label = "maler-saas.com";
  const tw = ctx.measureText(label).width + 90;
  rr(ctx, (W - tw) / 2, 1060, tw, 110, 55);
  ctx.fillStyle = "#facc15";
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.textBaseline = "middle";
  ctx.fillText(label, W / 2, 1117);
  ctx.font = `700 44px ${FONT}`;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  ctx.fillText("Link in der Bio", W / 2, 1230);
  ctx.restore();
  ctx.textAlign = "left";
}

/** Video aufnehmen. Achtung: läuft in Echtzeit – der Tab muss sichtbar bleiben. */
export async function renderVideo(opts: RenderOptions): Promise<{ blob: Blob; mime: string; seconds: number }> {
  const mime = pickMime();
  if (!mime) throw new Error("Dieser Browser kann keine Videos erstellen. Bitte Chrome, Edge oder Safari verwenden.");
  const canvas = opts.preview ?? document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Grafik nicht verfügbar.");

  const [logo, ...imgs] = await Promise.all([
    loadImage(opts.logoUrl ?? "/images/logo.png").catch(() => null),
    ...opts.imageUrls.map((u) => (u ? loadImage(u).catch(() => null) : Promise.resolve(null))),
  ]);

  // Audio vorbereiten
  const hasAudio = opts.audio.some(Boolean);
  const actx = hasAudio ? new AudioContext() : null;
  const buffers: (AudioBuffer | null)[] = await Promise.all(
    opts.audio.map(async (a) => (a && actx ? actx.decodeAudioData(a.slice(0)).catch(() => null) : null))
  );
  const durations = opts.scenes.map((s, i) => (buffers[i] ? Math.max(1.8, buffers[i]!.duration + 0.45) : Math.max(1.5, s.seconds)));
  const END = 3;
  const total = durations.reduce((a, b) => a + b, 0) + END;
  const starts: number[] = [];
  durations.reduce((acc, d) => (starts.push(acc), acc + d), 0);

  const stream = canvas.captureStream(30);
  let dest: MediaStreamAudioDestinationNode | null = null;
  if (actx) {
    dest = actx.createMediaStreamDestination();
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));

  // erstes Bild zeichnen, dann starten
  drawScene(ctx, imgs[0] ?? null, opts.scenes[0]?.text ?? "", 0, durations[0] ?? 3, logo);
  if (actx && actx.state === "suspended") await actx.resume();
  rec.start(250);
  const t0 = performance.now();
  if (actx && dest) {
    const base = actx.currentTime + 0.05;
    buffers.forEach((b, i) => {
      if (!b) return;
      const src = actx.createBufferSource();
      src.buffer = b;
      src.connect(dest!);
      src.start(base + starts[i] + 0.15);
    });
  }

  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      opts.onProgress?.(Math.min(1, t / total));
      if (t >= total) return resolve();
      const i = starts.findIndex((s, k) => t >= s && t < s + durations[k]);
      if (i === -1) drawEnd(ctx, logo, opts.endText ?? "14 Tage kostenlos testen", t - (total - END));
      else drawScene(ctx, imgs[i] ?? null, opts.scenes[i].text, t - starts[i], durations[i], logo);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  await actx?.close().catch(() => undefined);
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), mime, seconds: Math.round(total) };
}

export const fileExt = (mime: string) => (mime.includes("mp4") ? "mp4" : "webm");
