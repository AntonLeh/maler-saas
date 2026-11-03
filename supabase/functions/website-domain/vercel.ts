// Vercel-API für eigene Domains der Firmen-Websites (ohne Netzwerk testbar über fetch-Ersatz)

export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string; note?: string };

const env = (k: string) => (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k) ?? "";

export class VercelError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function q(): string {
  const team = env("VERCEL_TEAM_ID");
  return team ? `?teamId=${encodeURIComponent(team)}` : "";
}

async function api(method: string, path: string, body?: unknown) {
  const token = env("VERCEL_TOKEN");
  if (!token) throw new VercelError(503, "no_token", "Die Domain-Verbindung ist noch nicht eingerichtet (VERCEL_TOKEN fehlt).");
  const sep = path.includes("?") ? "&" : "?";
  const qs = q();
  const res = await fetch(`https://api.vercel.com${path}${qs ? sep + qs.slice(1) : ""}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new VercelError(res.status, data?.error?.code ?? "", data?.error?.message ?? `Vercel ${res.status}`);
  return data;
}

const project = () => encodeURIComponent(env("VERCEL_PROJECT_ID"));

/**
 * Eingabe des Betriebs in eine saubere Domain umwandeln.
 * "https://Maler-Prinz.de/kontakt" -> { primary: "www.maler-prinz.de", apex: "maler-prinz.de" }
 * "website.maler-prinz.de"        -> { primary: "website.maler-prinz.de", apex: null }
 */
export function normalizeDomain(input: string): { primary: string; apex: string | null } | null {
  let s = String(input ?? "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/\.$/, "");
  let host: string;
  try {
    host = new URL(`https://${s}`).hostname; // Umlaute -> Punycode
  } catch {
    return null;
  }
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host) || host.length > 253) return null;
  if (/(^|\.)maler-saas\.com$/.test(host) || /\.vercel\.app$/.test(host)) return null;
  const parts = host.split(".");
  // einfache Regel: 2 Teile = Hauptdomain (auch .de, .com, .at); "www." davor = Hauptdomain mit www
  if (parts.length === 2) return { primary: `www.${host}`, apex: host };
  if (parts.length === 3 && parts[0] === "www") return { primary: host, apex: parts.slice(1).join(".") };
  // Länder mit zweiteiliger Endung (z. B. co.uk) oder andere Subdomain: genau so verwenden
  return { primary: host, apex: null };
}

export async function addDomain(primary: string, apex: string | null) {
  try {
    await api("POST", `/v10/projects/${project()}/domains`, { name: primary });
  } catch (e) {
    // schon im Projekt -> in Ordnung
    if (!(e instanceof VercelError && (e.code === "domain_already_in_use_by_project" || e.code === "domain_already_exists" || e.status === 409 && /this project/i.test(e.message)))) throw e;
  }
  if (apex) {
    try {
      await api("POST", `/v10/projects/${project()}/domains`, { name: apex, redirect: primary, redirectStatusCode: 308 });
    } catch (e) {
      console.warn("apex redirect", e instanceof Error ? e.message : e);
    }
  }
}

export async function removeDomain(name: string) {
  try {
    await api("DELETE", `/v9/projects/${project()}/domains/${encodeURIComponent(name)}`);
  } catch (e) {
    if (!(e instanceof VercelError && e.status === 404)) throw e;
  }
}

/** Status bei Vercel: verified (Besitz bestätigt) und configured (DNS zeigt richtig) + nötige Einträge */
export async function domainStatus(primary: string, apex: string | null): Promise<{ active: boolean; records: DnsRecord[]; problem: string }> {
  let info = await api("GET", `/v9/projects/${project()}/domains/${encodeURIComponent(primary)}`);
  if (!info.verified) {
    try {
      const v = await api("POST", `/v9/projects/${project()}/domains/${encodeURIComponent(primary)}/verify`);
      info = { ...info, ...v, verification: v?.verification ?? info.verification };
    } catch (e) {
      console.warn("verify", e instanceof Error ? e.message : e);
    }
  }
  const config = await api("GET", `/v6/domains/${encodeURIComponent(primary)}/config`);
  const records = dnsRecords(primary, apex, config, info.verification);
  const active = !!info.verified && config.misconfigured === false;
  const problem = !info.verified
    ? "Die Domain wird bereits in einem anderen Vercel-Konto verwendet. Bitte zusätzlich den TXT-Eintrag setzen."
    : config.misconfigured
      ? "Die DNS-Einträge zeigen noch nicht auf Maler-SaaS. Nach dem Eintragen kann es bis zu 24 Stunden dauern."
      : "";
  return { active, records, problem };
}

function pick(list: unknown, fallback: string): string {
  // Vercel liefert z. B. recommendedIPv4: [{ rank: 1, value: ["76.76.21.21"] }], recommendedCNAME: [{ rank: 1, value: "cname.vercel-dns.com." }]
  if (Array.isArray(list) && list.length) {
    const best = [...list].sort((a, b) => (a?.rank ?? 9) - (b?.rank ?? 9))[0];
    const v = Array.isArray(best?.value) ? best.value[0] : best?.value;
    if (typeof v === "string" && v) return v.replace(/\.$/, "");
  }
  return fallback;
}

export function dnsRecords(primary: string, apex: string | null, config: Record<string, unknown>, verification?: unknown): DnsRecord[] {
  const cname = pick(config?.recommendedCNAME, "cname.vercel-dns.com");
  const ip = pick(config?.recommendedIPv4, "76.76.21.21");
  const out: DnsRecord[] = [];
  const sub = apex && primary.endsWith(`.${apex}`) ? primary.slice(0, -apex.length - 1) : primary.split(".")[0];
  out.push({ type: "CNAME", name: sub, value: cname, note: `für ${primary}` });
  if (apex) out.push({ type: "A", name: "@", value: ip, note: `für ${apex} (leitet auf ${primary} weiter)` });
  for (const v of Array.isArray(verification) ? verification : []) {
    if (v?.type === "TXT" && v?.domain && v?.value) out.push({ type: "TXT", name: String(v.domain), value: String(v.value), note: "Nachweis, dass die Domain Ihnen gehört" });
  }
  return out;
}
