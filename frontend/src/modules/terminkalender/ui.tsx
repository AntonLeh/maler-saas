import { useEffect, type ReactNode } from "react";
import type { Appointment, AppointmentStatus } from "./types";
import { STATUS_LABELS } from "./types";
import { formatTime } from "./dateUtils";

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`tk-badge tk-status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tk-modal-backdrop" onMouseDown={onClose}>
      <div
        className="tk-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tk-modal-head">
          <h2>{title}</h2>
          <button type="button" className="tk-icon-btn" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <div className="tk-modal-body">{children}</div>
        {footer && <div className="tk-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function AppointmentChip({
  appointment,
  onClick,
  compact = false,
  assigneeName,
}: {
  appointment: Appointment;
  onClick: () => void;
  compact?: boolean;
  assigneeName?: string;
}) {
  return (
    <button
      type="button"
      className={`tk-chip tk-status-${appointment.status}${compact ? " tk-chip-compact" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={appointment.title}
    >
      <span className="tk-chip-time">{formatTime(appointment.starts_at)}</span>
      <span className="tk-chip-title">
        {appointment.source === "ki_telefon" && <span title="Vom KI-Telefon gebucht">🤖 </span>}
        {appointment.title}
      </span>
      {!compact && assigneeName && <span className="tk-chip-meta">{assigneeName}</span>}
    </button>
  );
}

export function Notice({
  kind,
  children,
  onClose,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className={`tk-notice tk-notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="tk-icon-btn" onClick={onClose} aria-label="Ausblenden">
          ×
        </button>
      )}
    </div>
  );
}
