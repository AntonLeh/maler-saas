import { useMemo, useState } from "react";
import { filterQuotes, quoteKpis, type QuoteRow } from "./kpis";
import { STATUS_FILTERS, formatDate, formatMoney, quoteStatusKey, quoteStatusLabel, type QuoteStatusKey } from "./status";
import "./angebote.css";

type Props = {
  quotes: QuoteRow[];
  loading: boolean;
  message: string;
  currencySymbol: string;
  customerName: (id: number) => string;
  onOpen: (id: number) => void;
  onBack: () => void;
};

type FilterKey = "all" | "open" | QuoteStatusKey;

export default function QuotesList({ quotes, loading, message, currencySymbol, customerName, onOpen, onBack }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const kpis = useMemo(() => quoteKpis(quotes), [quotes]);
  const rows = useMemo(() => filterQuotes(quotes, filter, search, customerName), [quotes, filter, search, customerName]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: quotes.length, open: 0 };
    for (const q of quotes) {
      const k = quoteStatusKey(q);
      c[k] = (c[k] || 0) + 1;
      if (k === "draft" || k === "sent") c.open++;
    }
    return c;
  }, [quotes]);

  const money = (v: number) => formatMoney(v, currencySymbol);

  return (
    <section className="single-page-section">
      <div className="card ag-root">
        <div className="ag-head">
          <div>
            <h2>Angebote</h2>
            <p className="ag-muted">Übersicht über alle Angebote.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>Zurück zum Dashboard</button>
        </div>

        <div className="ag-kpis">
          <div>
            <span>Offen</span>
            <b>{kpis.openCount}</b>
            <small>{money(kpis.openSum)}</small>
          </div>
          <div>
            <span>Angenommen diesen Monat</span>
            <b>{kpis.acceptedMonthCount}</b>
            <small>{money(kpis.acceptedMonthSum)}</small>
          </div>
          <div>
            <span>Annahmequote</span>
            <b>{kpis.rate == null ? "–" : `${kpis.rate} %`}</b>
            <small>ohne Entwürfe</small>
          </div>
          <div className={kpis.expiredCount > 0 ? "warn" : ""}>
            <span>Abgelaufen</span>
            <b>{kpis.expiredCount}</b>
            <small>{kpis.expiredCount > 0 ? "nachfassen?" : "alles im Rahmen"}</small>
          </div>
        </div>

        <div className="ag-tools">
          <input
            type="search"
            className="ag-search"
            placeholder="Kunde, Titel oder Nr. suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ag-chips" role="tablist" aria-label="Status-Filter">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={filter === f.key ? "on" : ""}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <i>{counts[f.key] || 0}</i>
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="info-text">Angebote werden geladen...</p>}
        {message && <p className="info-text">{message}</p>}

        {!loading && rows.length === 0 ? (
          <div className="ag-empty">
            {quotes.length === 0
              ? "Noch keine Angebote vorhanden. Angebote entstehen aus einer Besichtigung / einem Aufmaß."
              : "Keine Angebote zu dieser Suche oder diesem Filter."}
          </div>
        ) : (
          <>
            <div className="ag-table-wrap">
              <table className="ag-table">
                <thead>
                  <tr>
                    <th>Nr.</th>
                    <th>Datum</th>
                    <th>Titel</th>
                    <th>Kunde</th>
                    <th className="r">Netto</th>
                    <th className="r">Brutto</th>
                    <th>Gültig bis</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q) => {
                    const key = quoteStatusKey(q);
                    return (
                      <tr key={q.id} onClick={() => onOpen(q.id)} tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") onOpen(q.id); }}>
                        <td><button type="button" className="ag-nr" onClick={(e) => { e.stopPropagation(); onOpen(q.id); }}>{q.quote_number || "–"}</button></td>
                        <td>{formatDate(q.quote_date)}</td>
                        <td className="ag-title">{q.title}</td>
                        <td>{customerName(q.customer_id)}</td>
                        <td className="r">{money(q.subtotal)}</td>
                        <td className="r"><b>{money(q.total_amount)}</b></td>
                        <td className={key === "expired" ? "ag-late" : ""}>{formatDate(q.valid_until)}</td>
                        <td><span className={`ag-badge s-${key}`}>{quoteStatusLabel(q)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="ag-cards">
              {rows.map((q) => {
                const key = quoteStatusKey(q);
                return (
                  <li key={q.id}>
                    <button type="button" onClick={() => onOpen(q.id)}>
                      <div className="ag-card-top">
                        <span className="ag-card-nr">{q.quote_number || "–"} · {formatDate(q.quote_date)}</span>
                        <span className={`ag-badge s-${key}`}>{quoteStatusLabel(q)}</span>
                      </div>
                      <strong>{q.title}</strong>
                      <span className="ag-muted">{customerName(q.customer_id)}</span>
                      <div className="ag-card-bottom">
                        <span className={key === "expired" ? "ag-late" : "ag-muted"}>
                          {q.valid_until ? `gültig bis ${formatDate(q.valid_until)}` : ""}
                        </span>
                        <b>{money(q.total_amount)}</b>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
