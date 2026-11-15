// Leistungsregeln & Bonusregeln: Texte und Prüfungen (ohne React, testbar)

export type Criterion = {
  id: number;
  category?: string | null;
  name?: string | null;
  description?: string | null;
  default_points?: number | null;
  is_active?: boolean | null;
  evaluation_mode?: string | null;
  auto_evaluation_enabled?: boolean | null;
  evaluation_key?: string | null;
  evaluation_operator?: string | null;
  evaluation_value?: number | string | null;
  points_on_success?: number | null;
  points_on_failure?: number | null;
};
export type Reward = {
  id: number;
  reward_name?: string | null;
  badge_name?: string | null;
  stars?: number | null;
  min_points?: number | null;
  max_points?: number | null;
  reward_type?: string | null;
  reward_value?: number | string | null;
  description?: string | null;
  is_active?: boolean | null;
};

/** Messwerte der automatischen Bewertung (Namen wie in der Datenbank-Prüfregel).
 *  ready = wird von der Datenbank berechnet. Nicht messbare Werte (z. B. noch keine Kundenbewertung) werden übersprungen. */
export const METRICS: Record<string, { label: string; kind: "bool" | "number"; hint?: string; explain: string; ready: boolean }> = {
  order_completed: { label: "Auftrag fertiggestellt", kind: "bool", ready: true, explain: "Ja, sobald der Auftrag auf „Fertig“ oder „Abgerechnet“ steht." },
  punctuality: { label: "Pünktlich fertig", kind: "bool", ready: true, explain: "Ja, wenn der Auftrag am oder vor dem geplanten Enddatum fertig wurde. Ohne Enddatum wird die Regel übersprungen." },
  photos_uploaded: { label: "Fotos hochgeladen", kind: "number", hint: "Anzahl", ready: true, explain: "Anzahl der Fortschrittsfotos, die der Mitarbeiter zu diesem Auftrag hochgeladen hat." },
  customer_rating: {
    label: "Kundenbewertung (Sterne)",
    kind: "number",
    hint: "1 bis 5",
    ready: true,
    explain: "Seine Sterne vom Kunden im Kundenportal – sonst die Gesamtnote. Solange keine Bewertung da ist, wird die Regel übersprungen und nach der Bewertung nachberechnet.",
  },
  work_time: { label: "Arbeitszeit (Stunden)", kind: "number", hint: "Stunden", ready: true, explain: "Seine gestempelten Netto-Stunden an diesem Auftrag (ohne Pausen)." },
  complaints: { label: "Reklamationen", kind: "number", hint: "Anzahl", ready: false, explain: "Reklamationen werden in MalerSaaS noch nicht erfasst." },
  material_consumption: { label: "Materialverbrauch", kind: "number", ready: false, explain: "Kein sinnvoller fester Vergleichswert möglich." },
};
export const OPERATORS: Record<string, string> = { "=": "gleich", "!=": "ungleich", ">": "größer als", ">=": "mindestens", "<": "kleiner als", "<=": "höchstens" };

export const REWARD_TYPES: Record<string, { label: string; icon: string; unit: (v: number, cur: string) => string }> = {
  money: { label: "Geld", icon: "💰", unit: (v, cur) => fmtMoney(v, cur) },
  vacation: { label: "Urlaubstag", icon: "🏖", unit: (v) => `${fmtNum(v)} ${v === 1 ? "Tag" : "Tage"}` },
  voucher: { label: "Gutschein", icon: "🎁", unit: (v, cur) => `Gutschein ${fmtMoney(v, cur)}` },
  material: { label: "Sachprämie", icon: "🧰", unit: (v, cur) => `Sachprämie im Wert von ${fmtMoney(v, cur)}` },
};

const fmtNum = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const fmtMoney = (n: number, cur: string) => {
  try {
    return n.toLocaleString("de-DE", { style: "currency", currency: cur || "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  } catch {
    return `${fmtNum(n)} €`;
  }
};

export const isAutomatic = (c: Criterion) => (c.evaluation_mode ? c.evaluation_mode === "automatic" : !!c.auto_evaluation_enabled);
export const signed = (n: number | null | undefined) => (n == null ? "–" : n > 0 ? `+${n}` : String(n));

/** „Fotodokumentation vorhanden = ja“ / „Kundenbewertung (Sterne) mindestens 4“ */
export function ruleText(c: Criterion) {
  if (!isAutomatic(c)) return "Wird von Ihnen von Hand vergeben";
  const m = METRICS[c.evaluation_key ?? ""];
  if (!m) return "Kein Messwert festgelegt – bitte bearbeiten";
  const v = Number(c.evaluation_value);
  if (m.kind === "bool") {
    const yes = (c.evaluation_operator === "!=" ? v !== 1 : v === 1);
    return `${m.label}: ${yes ? "ja" : "nein"}`;
  }
  return `${m.label} ${OPERATORS[c.evaluation_operator ?? ""] ?? c.evaluation_operator ?? ""} ${Number.isFinite(v) ? fmtNum(v) : "?"}`;
}

/** Automatische Regel, die derzeit nicht wirklich ausgewertet wird (kein oder noch nicht berechneter Messwert) */
export const notEvaluated = (c: Criterion) => isAutomatic(c) && !METRICS[c.evaluation_key ?? ""]?.ready;

export function pointsText(c: Criterion) {
  if (!isAutomatic(c)) return signed(c.default_points ?? 0);
  return `${signed(c.points_on_success ?? c.default_points ?? 0)} / ${signed(c.points_on_failure ?? 0)}`;
}

export const rewardName = (r: Reward) => (r.reward_name || r.badge_name || "").trim();
export const rangeText = (r: Reward) => (r.max_points == null ? `ab ${r.min_points ?? 0} Punkten` : `${r.min_points ?? 0}–${r.max_points} Punkte`);
export const rewardText = (r: Reward, cur: string) => {
  const t = REWARD_TYPES[r.reward_type ?? ""];
  const v = Number(r.reward_value ?? 0);
  return t ? `${t.icon} ${t.unit(v, cur)}` : `${fmtNum(v)}`;
};

/** Aktive Bonusregeln, deren Punktebereiche sich überschneiden */
export function overlaps(rewards: Reward[]): [Reward, Reward][] {
  const act = rewards.filter((r) => r.is_active !== false).sort((a, b) => (a.min_points ?? 0) - (b.min_points ?? 0));
  const out: [Reward, Reward][] = [];
  for (let i = 0; i < act.length; i++)
    for (let j = i + 1; j < act.length; j++) {
      const a = act[i];
      const b = act[j];
      const aMax = a.max_points ?? Infinity;
      if ((b.min_points ?? 0) <= aMax) out.push([a, b]);
    }
  return out;
}
