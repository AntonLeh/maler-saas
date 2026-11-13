// Owner-Dashboard: „Heute posten“ + Beiträge zur Freigabe
import { useEffect, useState } from "react";
import * as api from "./api";
import * as L from "./logic";
import type { Post } from "./logic";
import "./ow2.css";

const dateDe = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

export default function TodayPosts({ onOpen }: { onOpen: (id: number | null) => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => {
    let cancel = false;
    api
      .loadPosts()
      .then((p) => !cancel && setPosts(p))
      .catch(() => !cancel && setPosts([]));
    return () => {
      cancel = true;
    };
  }, []);
  if (!posts) return null;
  const today = new Date().toISOString().slice(0, 10);
  const due = L.postToday(posts, today);
  const approval = posts.filter(L.needsApproval).filter(L.hasTexts).length;
  if (!due.length && !approval) return null;
  return (
    <div className="ow2-today">
      <strong>📣 Werbung</strong>
      {due.length > 0 && (
        <div className="ow2-today-list">
          <span>Heute posten:</span>
          {due.map((p) => (
            <button key={p.id} type="button" onClick={() => onOpen(p.id)}>
              {p.planned_for && p.planned_for < today ? `⚠️ ${dateDe(p.planned_for)} · ` : ""}
              {p.title}
            </button>
          ))}
        </div>
      )}
      {approval > 0 && (
        <button type="button" className="ow2-pill warn" onClick={() => onOpen(null)}>
          ✋ {approval} {approval === 1 ? "Beitrag wartet" : "Beiträge warten"} auf Freigabe
        </button>
      )}
    </div>
  );
}
