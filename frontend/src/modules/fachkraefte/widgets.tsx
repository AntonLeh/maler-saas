import { HardHat } from "lucide-react";

/** Button für die Aktionsleiste im Admin-Dashboard */
export function FachkraefteButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="btn btn-analysis" onClick={onOpen}>
      <HardHat size={18} strokeWidth={2.25} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
      Fachkräfte
    </button>
  );
}
