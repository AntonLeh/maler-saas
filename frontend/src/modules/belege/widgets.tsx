import { Calculator } from "lucide-react";

/** Button für die Aktionsleiste im Admin-Dashboard */
export function BelegeButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="btn btn-analysis" onClick={onOpen}>
      <Calculator size={18} strokeWidth={2.25} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
      Buchhaltung
    </button>
  );
}
