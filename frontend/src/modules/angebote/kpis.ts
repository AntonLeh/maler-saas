import { isOpen, quoteStatusKey, todayIso, type QuoteStatusKey } from "./status";

export type QuoteRow = {
  id: number;
  quote_number: string | null;
  title: string;
  quote_date: string | null;
  valid_until?: string | null;
  accepted_at?: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  customer_id: number;
};

export type QuoteKpis = {
  openCount: number;
  openSum: number;
  acceptedMonthCount: number;
  acceptedMonthSum: number;
  expiredCount: number;
  rate: number | null; // Annahmequote in %, nur über entschiedene/abgelaufene/gesendete Angebote
};

export function quoteKpis(rows: QuoteRow[], now = new Date()): QuoteKpis {
  const today = todayIso(now);
  const month = today.slice(0, 7);
  let openCount = 0, openSum = 0, accM = 0, accMSum = 0, expired = 0, accepted = 0, decided = 0;
  for (const q of rows) {
    const k = quoteStatusKey(q, today);
    const total = Number(q.total_amount || 0);
    if (isOpen(k)) { openCount++; openSum += total; }
    if (k === "expired") expired++;
    if (k === "accepted") {
      accepted++;
      const when = (q.accepted_at || q.quote_date || "").slice(0, 7);
      if (when === month) { accM++; accMSum += total; }
    }
    if (k !== "draft" && k !== "other") decided++;
  }
  return {
    openCount, openSum,
    acceptedMonthCount: accM, acceptedMonthSum: accMSum,
    expiredCount: expired,
    rate: decided > 0 ? Math.round((accepted / decided) * 100) : null,
  };
}

export function filterQuotes(
  rows: QuoteRow[],
  filter: "all" | "open" | QuoteStatusKey,
  search: string,
  customerName: (id: number) => string,
  now = new Date(),
): QuoteRow[] {
  const today = todayIso(now);
  const s = search.trim().toLowerCase();
  return rows.filter((q) => {
    const k = quoteStatusKey(q, today);
    if (filter === "open" && !isOpen(k)) return false;
    if (filter !== "all" && filter !== "open" && k !== filter) return false;
    if (!s) return true;
    return [q.quote_number, q.title, customerName(q.customer_id)]
      .some((v) => (v || "").toLowerCase().includes(s));
  });
}
