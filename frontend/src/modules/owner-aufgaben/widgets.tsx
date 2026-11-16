// Zahl am Knopf „Aufgaben“ in der Plattform-Übersicht: heute oder früher fällige offene Aufgaben
import { useEffect, useState } from "react";
import { loadTodos } from "./api";
import { dueCount } from "./logic";

export function OwnerTasksBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let cancel = false;
    loadTodos()
      .then((t) => !cancel && setN(dueCount(t)))
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);
  return n > 0 ? (
    <span className="cm-tile-badge" title="Heute oder früher fällig">
      {n}
    </span>
  ) : null;
}
