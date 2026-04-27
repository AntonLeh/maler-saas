import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type EmployeeTimeSummary = {
  employee_id: number;
  employee_name: string;
  total_entries: number;
  total_net_minutes: number;
  total_net_hours: number;
  hourly_rate: number;
  labor_cost: number;
};

type OrderTimeSummary = {
  order_id: number;
  order_title: string;
  total_entries: number;
  total_net_minutes: number;
  total_net_hours: number;
};

type TimeEvaluationRow = {
  time_entry_id: number;
  work_date: string;
  employee_id: number;
  employee_name: string;
  order_id: number;
  order_title: string;
  started_at: string;
  ended_at: string;
  break_minutes: number;
  gross_minutes: number;
  net_minutes: number;
  net_hours: number;
  hourly_rate: number;
  labor_cost: number;
};

const formatEuropeanDate = (value: string) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const formatEuropeanTime = (value: string) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatMinutesToReadable = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hrs = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hrs} Std. ${mins.toString().padStart(2, "0")} Min.`;
};

const formatEuropeanNumber = (value: number) => {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
};

export default function AdminTimeEvaluation() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [employeeSummary, setEmployeeSummary] = useState<EmployeeTimeSummary[]>([]);
  const [orderSummary, setOrderSummary] = useState<OrderTimeSummary[]>([]);
  const [details, setDetails] = useState<TimeEvaluationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorText("");

      const [
        { data: empData, error: empError },
        { data: orderData, error: orderError },
        { data: detailData, error: detailError },
      ] = await Promise.all([
        supabase.rpc("admin_get_employee_time_summary", {
          p_from: fromDate || null,
          p_to: toDate || null,
        }),
        supabase.rpc("admin_get_order_time_summary", {
          p_from: fromDate || null,
          p_to: toDate || null,
        }),
        supabase.rpc("admin_get_time_evaluation", {
          p_from: fromDate || null,
          p_to: toDate || null,
          p_employee_id: null,
          p_order_id: null,
        }),
      ]);

      if (empError) throw empError;
      if (orderError) throw orderError;
      if (detailError) throw detailError;

      setEmployeeSummary((empData ?? []) as EmployeeTimeSummary[]);
      setOrderSummary((orderData ?? []) as OrderTimeSummary[]);
      setDetails((detailData ?? []) as TimeEvaluationRow[]);
    } catch (error: any) {
      setErrorText(error?.message || "Fehler beim Laden der Zeitauswertung.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "end",
          marginBottom: "20px",
        }}
      >
        <div>
          <label>Von</label>
          <br />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div>
          <label>Bis</label>
          <br />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div>
          <button onClick={loadData}>Auswertung laden</button>
        </div>
      </div>

      {loading && <p>Lade Zeitauswertung...</p>}
      {errorText && <p style={{ color: "red" }}>{errorText}</p>}

      <h3>Gesamtstunden pro Mitarbeiter</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
              Mitarbeiter
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
              Einträge
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
              Nettozeit
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
              Lohnkosten
            </th>
          </tr>
        </thead>
        <tbody>
          {employeeSummary.map((row) => (
            <tr key={row.employee_id}>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {row.employee_name}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {row.total_entries}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {formatMinutesToReadable(row.total_net_minutes)}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
                {formatEuropeanNumber(row.labor_cost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Gesamtstunden pro Auftrag</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
              Auftrag
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
              Einträge
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
              Nettozeit
            </th>
          </tr>
        </thead>
        <tbody>
          {orderSummary.map((row) => (
            <tr key={row.order_id}>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {row.order_title}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {row.total_entries}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {formatMinutesToReadable(row.total_net_minutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Details</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Datum</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Mitarbeiter</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Auftrag</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Start</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Ende</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Pause</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Bruttozeit</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Nettozeit</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Stundensatz</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Lohnkosten</th>
          </tr>
        </thead>
        <tbody>
          {details.map((row) => (
            <tr key={row.time_entry_id}>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {formatEuropeanDate(row.started_at)}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {row.employee_name}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {row.order_title}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {formatEuropeanTime(row.started_at)}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {formatEuropeanTime(row.ended_at)}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {Math.round(Number(row.break_minutes) || 0)} Min.
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {formatMinutesToReadable(row.gross_minutes)}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {formatMinutesToReadable(row.net_minutes)}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {formatEuropeanNumber(row.hourly_rate)}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
                {formatEuropeanNumber(row.labor_cost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}