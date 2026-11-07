// Teilen der Werbe-Beiträge: am Handy über das Teilen-Menü (Bilder + Text), am Computer Bilder herunterladen + Text kopieren.
// Instagram und Facebook übernehmen beim Teilen nur die Bilder – der Text wird deshalb immer zusätzlich kopiert.

import type { MarketingChannel } from "./types";
import { processImage } from "./api";

export const SOCIAL_CHANNELS: { key: Exclude<MarketingChannel, "website">; label: string; max: number; open?: string; hint: string }[] = [
  { key: "instagram", label: "Instagram", max: 2200, open: "https://www.instagram.com/", hint: "Beim Posten in das Textfeld tippen und „Einfügen“ wählen." },
  { key: "facebook", label: "Facebook", max: 2000, open: "https://www.facebook.com/", hint: "Beim Posten in das Textfeld tippen und „Einfügen“ wählen." },
  { key: "google", label: "Google-Profil", max: 1500, open: "https://business.google.com/", hint: "Im Google-Profil „Update hinzufügen“ wählen, Fotos hochladen, Text einfügen." },
  { key: "whatsapp", label: "WhatsApp-Status", max: 400, hint: "In WhatsApp „Mein Status“ wählen; der Text ist kopiert." },
];

/** Bilder für das Teilen vorbereiten: verkleinern und ohne Kamera-/Standortdaten neu speichern */
export async function buildShareFiles(urls: string[], baseName: string): Promise<File[]> {
  const files: File[] = [];
  let i = 0;
  for (const url of urls.slice(0, 10)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Ein Bild konnte nicht geladen werden.");
    const blob = await processImage(await res.blob(), 1600);
    files.push(new File([blob], `${baseName || "projekt"}-${++i}.jpg`, { type: "image/jpeg" }));
  }
  return files;
}

export function fileBaseName(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "projekt"
  );
}

export function canShareFiles(files: File[]): boolean {
  try {
    return !!files.length && typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files });
  } catch {
    return false;
  }
}

/** Text in die Zwischenablage (mit Rückfall für ältere Browser) */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadFiles(files: File[]) {
  files.forEach((f, i) => {
    window.setTimeout(() => {
      const url = URL.createObjectURL(f);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, i * 350);
  });
}
