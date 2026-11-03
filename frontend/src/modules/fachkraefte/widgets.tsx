import { HardHat, Lock } from "lucide-react";

/** Button für die Aktionsleiste im Admin-Dashboard */
export function FachkraefteButton({ onOpen, hasAccess = true }: { onOpen: () => void; hasAccess?: boolean }) {
  const Icon = hasAccess ? HardHat : Lock;
  return (
    <button type="button" className="btn btn-analysis" onClick={onOpen}>
      <Icon size={18} strokeWidth={2.25} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
      Fachkräfte
    </button>
  );
}
