// Prüfung der Eingaben des Kontaktformulars (ohne Netzwerk testbar)
export type ContactData = { name: string; company: string | null; email: string; phone: string | null; message: string };

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);

export function checkContact(b: Record<string, unknown>): { spam?: boolean; error?: string; data?: ContactData } {
  if (String(b.website ?? "").trim()) return { spam: true }; // Fallen-Feld ausgefüllt
  const elapsed = Number(b.elapsed);
  if (Number.isFinite(elapsed) && elapsed < 3000) return { spam: true }; // schneller als ein Mensch tippt
  const name = clean(b.name, 100).replace(/\s+/g, " ");
  const email = clean(b.email, 200);
  const message = clean(b.message, 4000);
  if (!name) return { error: "Bitte Ihren Namen angeben." };
  if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[A-Za-z]{2,}$/.test(email)) return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  if (message.length < 10) return { error: "Bitte eine Nachricht mit mindestens 10 Zeichen schreiben." };
  if ((message.match(/https?:\/\//g) ?? []).length > 3) return { spam: true }; // typische Link-Spam-Nachricht
  return {
    data: {
      name,
      company: clean(b.company, 120).replace(/\s+/g, " ") || null,
      email,
      phone: clean(b.phone, 40) || null,
      message,
    },
  };
}
