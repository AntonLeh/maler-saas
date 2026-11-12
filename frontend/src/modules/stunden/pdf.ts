// PDFs: Monatsliste für den Steuerberater, Stundennachweis (Zeitarbeitsfirma), Leistungsnachweis (Subunternehmer)
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EMPLOYMENT } from "../mitarbeiter-arten/logic";
import type { Pay } from "../mitarbeiter-arten/logic";
import {
  byWeek,
  deDate,
  fmtH,
  fmtMoney,
  hours,
  monthLabel,
  nameOf,
} from "./logic";
import type { AbsenceCtx, ExternalCost, Person, ProofRow, StbRow } from "./logic";
import { countDays, DEFAULT_WEEKDAYS, KINDS } from "../urlaub/logic";
import { monthRange } from "./logic";

type Company = { name: string; street: string; city: string };
const NAVY: [number, number, number] = [15, 23, 42];

function head(doc: jsPDF, title: string, sub: string, company: Company) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(title, 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(sub, 14, 25);
  const right = [company.name, company.street, company.city].filter(Boolean);
  right.forEach((l, i) => doc.text(l, 196, 14 + i * 5, { align: "right" }));
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 30, 196, 30);
}

function foot(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Erstellt am ${new Date().toLocaleDateString("de-DE")} mit MalerSaaS · Seite ${i} von ${n}`,
      14,
      289,
    );
  }
}

const tableStyle = {
  styles: { fontSize: 8.5, cellPadding: 1.8, textColor: NAVY },
  headStyles: {
    fillColor: NAVY,
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold" as const,
  },
  alternateRowStyles: {
    fillColor: [248, 250, 252] as [number, number, number],
  },
  margin: { left: 14, right: 14 },
};

const lastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 40;

// ---------- Monatsliste Steuerberater ----------
export function stbPdf(month: string, rows: StbRow[], company: Company, ctx?: AbsenceCtx | null): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  head(
    doc,
    `Arbeitsstunden ${monthLabel(month)}`,
    "Monatsliste für die Lohnabrechnung (eigenes Personal)",
    company,
  );

  autoTable(doc, {
    ...tableStyle,
    startY: 36,
    head: [
      ctx
        ? ["Mitarbeiter", "Beschäftigung", "Arbeitstage", "Stunden", "Abwesend (Tage)", "Hinweis"]
        : ["Mitarbeiter", "Beschäftigung", "Arbeitstage", "Stunden", "Hinweis"],
    ],
    body: rows.map((r) =>
      ctx
        ? [nameOf(r.person), EMPLOYMENT[r.type].short, String(r.days.length), fmtH(r.minutes), r.absText || "–", r.note || "–"]
        : [nameOf(r.person), EMPLOYMENT[r.type].short, String(r.days.length), fmtH(r.minutes), r.note || "–"],
    ),
    columnStyles: ctx
      ? { 2: { halign: "right" }, 3: { halign: "right" }, 4: { cellWidth: 34 }, 5: { cellWidth: 56 } }
      : { 2: { halign: "right" }, 3: { halign: "right" }, 4: { cellWidth: 72 } },
  });

  // Abwesenheiten im Monat (Urlaub, Krankheit …)
  const absRows = ctx
    ? rows.flatMap((r) => {
        const wd = ctx.leaves.get(Number(r.person.id))?.work_weekdays ?? DEFAULT_WEEKDAYS;
        const { from, to } = monthRange(month);
        return r.absences.map((a) => [
          nameOf(r.person),
          KINDS[a.kind].label,
          a.start_date === a.end_date ? deDate(a.start_date) : `${deDate(a.start_date)} – ${deDate(a.end_date)}`,
          String(countDays(a, wd, ctx.cal, from, to)).replace(".", ","),
          [a.au_present ? "AU liegt vor" : "", a.start_half || a.end_half ? "mit halbem Tag" : "", a.note ?? ""].filter(Boolean).join(" · ") || "–",
        ]);
      })
    : [];
  if (absRows.length) {
    let y0 = lastY(doc) + 10;
    if (y0 > 250) {
      doc.addPage();
      y0 = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("Abwesenheiten", 14, y0);
    autoTable(doc, {
      ...tableStyle,
      startY: y0 + 3,
      head: [["Mitarbeiter", "Art", "Zeitraum", "Arbeitstage im Monat", "Hinweis"]],
      body: absRows,
      columnStyles: { 3: { halign: "right", cellWidth: 26 } },
    });
  }

  for (const r of rows) {
    if (!r.days.length) continue;
    let y = lastY(doc) + 10;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(`${nameOf(r.person)} – ${fmtH(r.minutes)} Std.`, 14, y);
    autoTable(doc, {
      ...tableStyle,
      startY: y + 3,
      head: [["Datum", "Stunden", "Aufträge"]],
      body: r.days.map((d) => [
        deDate(d.day),
        fmtH(d.minutes),
        d.orders.join(", "),
      ]),
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 20, halign: "right" },
      },
    });
  }

  let y = lastY(doc) + 10;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    ctx
      ? "Stunden = erfasste Nettoarbeitszeit (ohne Pausen). Soll-Stunden aus den Wochenstunden an den Arbeitstagen, ohne Feiertage und Abwesenheiten."
      : "Stunden = erfasste Nettoarbeitszeit (ohne Pausen). Soll-Stunden aus den Wochenstunden, Mo–Fr, ohne Feiertage und Urlaub.",
    14,
    y,
  );
  foot(doc);
  return doc.output("blob");
}

// ---------- Nachweis Leiharbeit / Subunternehmer ----------
export function proofPdf(o: {
  kind: "leih" | "sub";
  person: Person;
  pay: Pay | null;
  from: string;
  to: string;
  rows: ProofRow[];
  external: (ExternalCost & { orderTitle: string })[];
  company: Company;
}): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const leih = o.kind === "leih";
  const partner = leih
    ? o.pay?.agency_name || "Zeitarbeitsfirma"
    : o.pay?.sub_company || nameOf(o.person);
  const period = `${new Date(`${o.from}T12:00:00`).toLocaleDateString("de-DE")} – ${new Date(`${o.to}T12:00:00`).toLocaleDateString("de-DE")}`;
  head(
    doc,
    leih
      ? "Stundennachweis Arbeitnehmerüberlassung"
      : "Leistungsnachweis Subunternehmer",
    `${nameOf(o.person)} · ${partner} · Zeitraum ${period}`,
    o.company,
  );

  const rate = leih
    ? (o.pay?.agency_rate ?? o.person.hourly_rate)
    : o.pay?.sub_billing === "stunde"
      ? (o.pay?.sub_rate ?? o.person.hourly_rate)
      : null;
  const minutes = o.rows.reduce((s, r) => s + r.minutes, 0);

  if (o.rows.length) {
    autoTable(doc, {
      ...tableStyle,
      startY: 36,
      head: [
        ["Datum", "Auftrag / Baustelle", "Von", "Bis", "Pause", "Stunden"],
      ],
      body: byWeek(o.rows).flatMap((w, _i, weeks) => [
        ...w.rows.map((r) => [
          deDate(r.day),
          r.order + (r.manual ? " *" : ""),
          r.from,
          r.to,
          r.breakMin ? `${r.breakMin} min` : "–",
          fmtH(r.minutes),
        ]),
        ...(weeks.length < 2
          ? []
          : [
              [
                {
                  content: `Summe ${w.label}`,
                  colSpan: 5,
                  styles: {
                    fontStyle: "bold" as const,
                    fillColor: [241, 245, 249] as [number, number, number],
                  },
                },
                {
                  content: fmtH(w.minutes),
                  styles: {
                    fontStyle: "bold" as const,
                    halign: "right" as const,
                    fillColor: [241, 245, 249] as [number, number, number],
                  },
                },
              ],
            ]),
      ]),
      foot: [["", "Summe", "", "", "", fmtH(minutes)]],
      footStyles: {
        fillColor: [226, 232, 240],
        textColor: NAVY,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 14 },
        3: { cellWidth: 14 },
        4: { cellWidth: 16, halign: "right" },
        5: { cellWidth: 18, halign: "right" },
      },
    });
  }

  let y = o.rows.length ? lastY(doc) + 8 : 40;
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  if (!o.rows.length && !o.external.length) {
    doc.text(
      "Im Zeitraum sind keine Stunden oder Fremdleistungen erfasst.",
      14,
      y,
    );
    y += 8;
  }
  if (rate != null && minutes > 0) {
    doc.setFont("helvetica", "bold");
    doc.text(
      `${fmtH(minutes)} Std. × ${fmtMoney(rate)} = ${fmtMoney(hours(minutes) * rate)} netto`,
      14,
      y,
    );
    doc.setFont("helvetica", "normal");
    y += 6;
  }

  if (o.external.length) {
    autoTable(doc, {
      ...tableStyle,
      startY: y + 2,
      head: [
        ["Rechnungsdatum", "Rechnungs-Nr.", "Auftrag", "Leistung", "Netto"],
      ],
      body: o.external.map((x) => [
        x.invoice_date
          ? new Date(`${x.invoice_date}T12:00:00`).toLocaleDateString("de-DE")
          : "–",
        x.invoice_no || "–",
        x.orderTitle,
        `${x.description || ""}${x.reverse_charge ? " (§ 13b)" : ""}`,
        fmtMoney(Number(x.amount_net)),
      ]),
      foot: [
        [
          "",
          "",
          "",
          "Summe Fremdleistungen",
          fmtMoney(o.external.reduce((s, x) => s + Number(x.amount_net), 0)),
        ],
      ],
      footStyles: {
        fillColor: [226, 232, 240],
        textColor: NAVY,
        fontStyle: "bold",
      },
      columnStyles: { 4: { halign: "right" } },
    });
    y = lastY(doc) + 8;
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const notes = [
    "Stunden = Nettoarbeitszeit ohne Pausen." +
      (o.rows.some((r) => r.manual) ? " * = vom Betrieb nachgetragen." : ""),
    leih
      ? "Dient zum Abgleich mit der Rechnung der Zeitarbeitsfirma. Beträge netto zzgl. gesetzlicher Umsatzsteuer."
      : "Dient zum Abgleich mit der Rechnung des Subunternehmers.",
  ];
  notes.forEach((n, i) => doc.text(n, 14, y + i * 4));
  y += 20;
  if (y > 255) {
    doc.addPage();
    y = 30;
  }
  doc.setDrawColor(148, 163, 184);
  doc.line(14, y + 12, 90, y + 12);
  doc.line(120, y + 12, 196, y + 12);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Datum, Unterschrift ${o.company.name || "Betrieb"}`, 14, y + 17);
  doc.text(`Datum, Unterschrift ${partner}`, 120, y + 17);
  foot(doc);
  return doc.output("blob");
}
