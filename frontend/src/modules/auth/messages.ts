// Anmeldung: Fehlermeldungen von Supabase verständlich auf Deutsch (Sie-Form)
export const MIN_PASSWORD_LENGTH = 8;

export type Tone = "error" | "success" | "info";
export type AuthMessage = { text: string; tone: Tone } | null;

export function loginErrorText(err: { message?: string; status?: number; code?: string } | null | undefined): string {
  const m = String(err?.message ?? "").toLowerCase();
  const code = String(err?.code ?? "").toLowerCase();
  if (code === "invalid_credentials" || m.includes("invalid login credentials")) return "E-Mail-Adresse oder Passwort ist falsch.";
  if (code === "email_not_confirmed" || m.includes("email not confirmed")) return "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse – den Link dazu haben wir Ihnen per E-Mail geschickt.";
  if (err?.status === 429 || code.includes("rate_limit") || m.includes("too many") || m.includes("rate limit"))
    return "Zu viele Versuche – bitte warten Sie einige Minuten und versuchen Sie es dann erneut.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.";
  return "Die Anmeldung hat nicht geklappt. Bitte versuchen Sie es erneut.";
}

export function resetErrorText(err: { message?: string; status?: number; code?: string } | null | undefined): string {
  const m = String(err?.message ?? "").toLowerCase();
  const code = String(err?.code ?? "").toLowerCase();
  if (err?.status === 429 || code.includes("rate_limit") || m.includes("security purposes") || m.includes("rate limit"))
    return "Bitte warten Sie kurz, bevor Sie erneut einen Link anfordern.";
  if (code === "same_password" || m.includes("should be different")) return "Das neue Passwort muss sich vom bisherigen unterscheiden.";
  if (code === "weak_password" || m.includes("weak") || m.includes("pwned") || m.includes("leaked"))
    return "Dieses Passwort ist zu unsicher oder schon in Datenlecks aufgetaucht. Bitte wählen Sie ein anderes.";
  if (m.includes("session") || m.includes("expired") || m.includes("invalid")) return "Der Link ist abgelaufen oder wurde schon benutzt. Bitte fordern Sie einen neuen Link an.";
  return "Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.";
}

/** Fehler aus dem Link zum Zurücksetzen (Supabase hängt ihn an die Adresse an, z. B. #error_code=otp_expired) */
export function recoveryLinkError(hash: string, search: string): string | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const q = new URLSearchParams(search);
  const code = p.get("error_code") || q.get("error_code") || p.get("error") || q.get("error");
  if (!code) return null;
  return "Der Link zum Zurücksetzen ist abgelaufen oder wurde schon benutzt. Bitte fordern Sie einen neuen Link an.";
}

export function passwordProblem(pw: string, repeat?: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
  if (repeat !== undefined && pw !== repeat) return "Die Passwörter stimmen nicht überein.";
  return null;
}

export function signupErrorText(err: { message?: string; status?: number; code?: string } | null | undefined): string {
  const m = String(err?.message ?? "").toLowerCase();
  const code = String(err?.code ?? "").toLowerCase();
  if (err?.status === 429 || code.includes("rate_limit") || m.includes("rate limit") || m.includes("security purposes"))
    return "Zu viele Versuche – bitte warten Sie einige Minuten und versuchen Sie es dann erneut.";
  if (code === "weak_password" || m.includes("pwned") || m.includes("leaked") || m.includes("weak"))
    return "Dieses Passwort ist zu unsicher oder schon in Datenlecks aufgetaucht. Bitte wählen Sie ein anderes.";
  if (m.includes("at least") && m.includes("characters")) return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
  if (code === "email_address_invalid" || m.includes("invalid") && m.includes("email")) return "Bitte prüfen Sie die E-Mail-Adresse.";
  if (code === "signup_disabled" || m.includes("signups not allowed")) return "Neue Registrierungen sind gerade nicht möglich. Bitte schreiben Sie uns an info@maler-saas.com.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.";
  return "Die Registrierung hat nicht geklappt. Bitte versuchen Sie es erneut oder schreiben Sie uns an info@maler-saas.com.";
}

export const cleanEmail = (v: string) => v.trim().toLowerCase();
