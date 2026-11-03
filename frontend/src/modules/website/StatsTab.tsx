import { useEffect, useMemo, useRef, useState } from "react";
import type { WebsiteService } from "./types";
import { serviceSlugs } from "./types";
import type { WebsiteStats } from "./api";
import { loadStats } from "./api";

const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  bing: "Bing",
  social: "Soziale Netzwerke",
  direkt: "Direkt (Adresse eingetippt, Lesezeichen, QR-Code …)",
  andere: "Andere Websites",
};

const fmt = (n: number) => n.toLocaleString("de-DE");
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

export default function StatsTab({ tenantId, services, onError }: { tenantId: number; services: WebsiteService[]; onError: (msg: string) => void }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<WebsiteStats | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Diagramm in echter Breite zeichnen (sonst wird die Schrift am Handy winzig)
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartW, setChartW] = useState(720);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setChartW(Math.max(280, Math.round(entries[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [stats]);

  useEffect(() => {
    let cancelled = false;
    loadStats(tenantId, days)
      .then((s) => !cancelled && setStats(s))
      .catch((e) => !cancelled && onError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [tenantId, days, onError]);

  // Seitennamen lesbar machen ("fassadenanstrich" -> "Fassadenanstrich")
  const pageNames = useMemo(() => {
    const titles = services.map((s) => s.title.trim()).filter(Boolean);
    const slugs = serviceSlugs(titles);
    const map: Record<string, string> = { "": "Startseite", impressum: "Impressum", datenschutz: "Datenschutz" };
    slugs.forEach((sl, i) => (map[sl] = titles[i]));
    return map;
  }, [services]);

  if (!stats) return <p className="tk-empty">Statistik wird geladen …</p>;

  const visits = stats.daily.reduce((a, d) => a + d.visits, 0);
  const views = stats.daily.reduce((a, d) => a + d.views, 0);
  const leads = stats.daily.reduce((a, d) => a + d.leads, 0);
  const rate = visits ? (leads / visits) * 100 : 0;
  const max = Math.max(1, ...stats.daily.map((d) => d.visits));
  const maxPage = Math.max(1, ...stats.pages.map((p) => p.views));
  const maxSource = Math.max(1, ...stats.sources.map((s) => s.visits));

  // Diagramm: Säulen pro Tag (eine Reihe, eine Farbe), 2px Abstand, oben abgerundet
  const W = chartW;
  const H = chartW < 480 ? 160 : 180;
  const pad = { l: 34, r: 8, t: 10, b: 22 };
  const n = stats.daily.length;
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.max(2, slot - 2);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const h = hover !== null ? stats.daily[hover] : null;

  return (
    <div className="ws-stack">
      <div className="ws-row ws-stats-head">
        <div className="tk-segment" role="tablist" aria-label="Zeitraum">
          {[7, 30, 90, 365].map((d) => (
            <button key={d} type="button" role="tab" aria-selected={days === d} className={days === d ? "active" : ""} onClick={() => {
                if (d !== days) {
                  setStats(null);
                  setDays(d);
                }
              }}>
              {d === 365 ? "12 Monate" : `${d} Tage`}
            </button>
          ))}
        </div>
        <span className="tk-muted">ohne Cookies gezählt – Suchmaschinen-Roboter werden nicht mitgezählt</span>
      </div>

      <div className="ws-rv-stats">
        <div className="ws-rv-stat">
          <strong>{fmt(visits)}</strong>
          <span className="tk-muted">Besuche</span>
        </div>
        <div className="ws-rv-stat">
          <strong>{fmt(views)}</strong>
          <span className="tk-muted">Seitenaufrufe</span>
        </div>
        <div className="ws-rv-stat">
          <strong>{fmt(leads)}</strong>
          <span className="tk-muted">Anfragen über das Formular</span>
        </div>
        <div className="ws-rv-stat">
          <strong>{visits ? `${rate.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %` : "–"}</strong>
          <span className="tk-muted">der Besuche führen zu einer Anfrage</span>
        </div>
      </div>

      <section className="ws-panel">
        <h3>Besuche pro Tag</h3>
        {visits === 0 ? (
          <p className="tk-muted">
            Noch keine Besuche in diesem Zeitraum. Gezählt wird ab dem 3. November 2026, nur bei veröffentlichter Website und nicht in der Vorschau.
          </p>
        ) : (
          <div className="ws-chart" ref={chartRef} onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Besuche pro Tag, insgesamt ${visits}`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="ws-chart-grid" />
                  <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="ws-chart-axis">
                    {t}
                  </text>
                </g>
              ))}
              {stats.daily.map((d, i) => {
                const x = pad.l + i * slot + 1;
                const top = y(d.visits);
                const hgt = H - pad.b - top;
                return (
                  <g key={d.day}>
                    {d.visits > 0 && (
                      <path
                        className={`ws-chart-bar${hover === i ? " on" : ""}`}
                        d={roundTop(x, top, bw, hgt, Math.min(4, bw / 2, hgt))}
                      />
                    )}
                    {/* größere, unsichtbare Fläche für das Überfahren */}
                    <rect
                      x={pad.l + i * slot}
                      y={pad.t}
                      width={slot}
                      height={H - pad.t - pad.b}
                      fill="transparent"
                      onMouseEnter={() => setHover(i)}
                      onClick={() => setHover(i)}
                    />
                  </g>
                );
              })}
              <text x={pad.l} y={H - 5} className="ws-chart-axis">
                {dayLabel(stats.daily[0].day)}
              </text>
              <text x={W - pad.r} y={H - 5} textAnchor="end" className="ws-chart-axis">
                {dayLabel(stats.daily[n - 1].day)}
              </text>
            </svg>
            {h && (
              <div className="ws-chart-tip" style={{ left: `${((pad.l + (hover! + 0.5) * slot) / W) * 100}%` }} role="status">
                <strong>{dayLabel(h.day)}</strong>
                <span>
                  {fmt(h.visits)} Besuche · {fmt(h.views)} Aufrufe{h.leads ? ` · ${h.leads} Anfrage${h.leads > 1 ? "n" : ""}` : ""}
                </span>
              </div>
            )}
          </div>
        )}
        <details className="ws-chart-table">
          <summary>Als Tabelle anzeigen</summary>
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Besuche</th>
                <th>Seitenaufrufe</th>
                <th>Anfragen</th>
              </tr>
            </thead>
            <tbody>
              {[...stats.daily].reverse().map((d) => (
                <tr key={d.day}>
                  <td>{dayLabel(d.day)}</td>
                  <td>{fmt(d.visits)}</td>
                  <td>{fmt(d.views)}</td>
                  <td>{fmt(d.leads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="ws-stats-cols">
        <section className="ws-panel">
          <h3>Beliebteste Seiten</h3>
          {stats.pages.length === 0 ? (
            <p className="tk-muted">Noch keine Daten.</p>
          ) : (
            <ul className="ws-hbars">
              {stats.pages.map((p) => (
                <li key={p.page}>
                  <span className="ws-hbar-label">{pageNames[p.page] ?? p.page}</span>
                  <span className="ws-hbar-track">
                    <span className="ws-hbar" style={{ width: `${(p.views / maxPage) * 100}%` }} />
                  </span>
                  <span className="ws-hbar-val">{fmt(p.views)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="ws-panel">
          <h3>Woher kommen die Besucher?</h3>
          {stats.sources.length === 0 ? (
            <p className="tk-muted">Noch keine Daten.</p>
          ) : (
            <ul className="ws-hbars">
              {stats.sources.map((s) => (
                <li key={s.source}>
                  <span className="ws-hbar-label">{SOURCE_LABELS[s.source] ?? s.source}</span>
                  <span className="ws-hbar-track">
                    <span className="ws-hbar" style={{ width: `${(s.visits / maxSource) * 100}%` }} />
                  </span>
                  <span className="ws-hbar-val">{fmt(s.visits)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="tk-muted ws-stats-hint">Tipp: Viele Besuche über „Direkt“ kommen oft von Visitenkarte, Autobeschriftung oder QR-Code.</p>
        </section>
      </div>
    </div>
  );
}

/** Säule mit abgerundeten oberen Ecken, unten gerade (an der Grundlinie) */
function roundTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.max(0, Math.min(r, h));
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
