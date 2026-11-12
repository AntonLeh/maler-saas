// Freigabecenter: Kosten des Auftrags nach Beschäftigungsart + Fremdleistungen + Material
import { useEffect, useState } from "react";
import * as api from "./api";
import { costSplit, fmtH, fmtMoney, GROUP_LABELS } from "./logic";
import type { Entry, ExternalCost, Group, Person } from "./logic";

type Props = { orderId: number; entries: Entry[]; people: Person[]; materialCost: number; currencySymbol?: string };

export default function ApprovalCosts({ orderId, entries, people, materialCost, currencySymbol: cur = "€" }: Props) {
  const [external, setExternal] = useState<ExternalCost[]>([]);
  useEffect(() => {
    let cancel = false;
    api.loadExternalCosts(null, { orderId }).then((x) => !cancel && setExternal(x));
    return () => {
      cancel = true;
    };
  }, [orderId]);

  const s = costSplit(entries, people, external);
  const groups = (["own", "leih", "sub"] as Group[]).filter((g) => s[g].minutes > 0);
  const line = { margin: 0, color: "#475569" };

  return (
    <>
      {groups.length === 0 ? (
        <p style={line}>
          💰 Arbeitskosten: <strong>{fmtMoney(0, cur)}</strong>
        </p>
      ) : (
        groups.map((g) => (
          <p key={g} style={line}>
            💰 {GROUP_LABELS[g]}: <strong>{fmtMoney(s[g].cost, cur)}</strong> <span style={{ color: "#94a3b8" }}>({fmtH(s[g].minutes)} Std.)</span>
          </p>
        ))
      )}
      {s.external > 0 && (
        <p style={line}>
          🧾 Fremdleistungen: <strong>{fmtMoney(s.external, cur)}</strong>
        </p>
      )}
      <p style={line}>
        🎨 Materialkosten: <strong>{fmtMoney(materialCost, cur)}</strong>
      </p>
      <p style={{ margin: 0, color: "#0f172a", fontWeight: 700 }}>
        📊 Gesamtkosten: <strong>{fmtMoney(s.total + materialCost, cur)}</strong>
      </p>
    </>
  );
}
