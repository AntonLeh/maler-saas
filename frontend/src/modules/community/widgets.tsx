// MalerTreff: Einstieg auf den Dashboards – erscheint nur, wenn die Community für diesen Nutzer freigeschaltet ist
import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import * as api from "./api";
import { COMMUNITY_NAME } from "./logic";
import type { Access } from "./logic";
import "./cm-tile.css";

export function CommunityTile({ onOpen, variant = "button", className }: { onOpen: () => void; variant?: "button" | "card"; className?: string }) {
  const [a, setA] = useState<Access | null>(null);
  useEffect(() => {
    let cancel = false;
    void api.loadAccess().then((x) => !cancel && setA(x));
    return () => {
      cancel = true;
    };
  }, []);
  if (!a?.enabled) return null;
  const badge = (a.unread ?? 0) + (a.staff_pending ?? 0);
  if (variant === "card") {
    return (
      <button type="button" className={`cm-tile-card ${className ?? ""}`} onClick={onOpen}>
        <MessagesSquare size={22} aria-hidden="true" />
        <span>
          <b>
            {COMMUNITY_NAME}
            {badge > 0 && <span className="cm-tile-badge">{badge}</span>}
          </b>
          <small>{a.member?.status === "aktiv" ? "Fragen stellen, Kollegen helfen" : "Die Community für Maler – jetzt beitreten"}</small>
        </span>
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-analysis" onClick={onOpen}>
      <MessagesSquare size={18} strokeWidth={2.25} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
      {COMMUNITY_NAME}
      {badge > 0 && <span className="cm-tile-badge">{badge}</span>}
    </button>
  );
}
