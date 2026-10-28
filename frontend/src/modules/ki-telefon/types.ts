export type WeekAvailability = Record<string, [string, string][]>;

export type AiPhoneSettings = {
  tenant_id: number;
  enabled: boolean;
  webhook_key: string;
  phone_number: string | null;
  company_name: string | null;
  greeting: string | null;
  assistant_instructions: string | null;
  timezone: string;
  visit_duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_horizon_days: number;
  slot_step_minutes: number;
  availability: WeekAvailability;
  updated_at?: string;
};

export type CallbackRequest = {
  id: number;
  tenant_id: number;
  caller_name: string | null;
  caller_phone: string | null;
  concern: string | null;
  preferred_time: string | null;
  status: "offen" | "erledigt";
  handled_by: number | null;
  handled_at: string | null;
  note: string | null;
  created_at: string;
};

export type AiCall = {
  id: number;
  provider: string;
  provider_call_id: string;
  caller_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
  outcome: "termin" | "rueckruf" | "info" | string | null;
  appointment_id: number | null;
  created_at: string;
};

export type AiAppointment = {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
};

export type Provider = "elevenlabs" | "retell" | "vapi";

export const WEEKDAYS: { key: string; label: string }[] = [
  { key: "1", label: "Montag" },
  { key: "2", label: "Dienstag" },
  { key: "3", label: "Mittwoch" },
  { key: "4", label: "Donnerstag" },
  { key: "5", label: "Freitag" },
  { key: "6", label: "Samstag" },
  { key: "7", label: "Sonntag" },
];

export const TIMEZONES = [
  { value: "Europe/Berlin", label: "Deutschland (Berlin)" },
  { value: "Europe/Vienna", label: "Österreich (Wien)" },
  { value: "Europe/Zurich", label: "Schweiz (Zürich)" },
  { value: "Europe/Madrid", label: "Spanien (Madrid/Palma)" },
];

export const OUTCOME_LABELS: Record<string, string> = {
  termin: "Termin gebucht",
  rueckruf: "Rückruf gewünscht",
  info: "Auskunft",
};

/** Business oder Enterprise */
export function hasAiPhoneAccess(plan: string | null | undefined): boolean {
  return plan === "business" || plan === "enterprise";
}
