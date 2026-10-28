export type AppointmentStatus =
  | "geplant"
  | "weitergeleitet"
  | "bestaetigt"
  | "abgelehnt"
  | "abgesagt";

export type AppointmentType =
  | "besichtigung"
  | "aufmass"
  | "beratung"
  | "ausfuehrung"
  | "abnahme"
  | "intern"
  | "sonstiges";

export type Appointment = {
  id: number;
  tenant_id: number;
  created_by: number | null;
  assigned_to: number | null;
  customer_id: number | null;
  order_id: number | null;
  title: string;
  appointment_type: AppointmentType;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  forward_note: string | null;
  response_note: string | null;
  forwarded_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentInput = {
  title: string;
  appointment_type: AppointmentType;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  customer_id: number | null;
  order_id: number | null;
};

export type CalendarPerson = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type CalendarCustomer = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
};

export type CalendarOrder = {
  id: number;
  customer_id: number | null;
  title: string;
  status: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
};

export const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: "besichtigung", label: "Besichtigung" },
  { value: "aufmass", label: "Aufmaß" },
  { value: "beratung", label: "Beratung" },
  { value: "ausfuehrung", label: "Ausführung" },
  { value: "abnahme", label: "Abnahme" },
  { value: "intern", label: "Intern" },
  { value: "sonstiges", label: "Sonstiges" },
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  geplant: "Geplant",
  weitergeleitet: "Weitergeleitet",
  bestaetigt: "Bestätigt",
  abgelehnt: "Abgelehnt",
  abgesagt: "Abgesagt",
};

export function typeLabel(type: string): string {
  return APPOINTMENT_TYPES.find((t) => t.value === type)?.label ?? "Sonstiges";
}

export function personName(person: CalendarPerson | undefined | null): string {
  if (!person) return "–";
  const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  return name || person.email || `Benutzer ${person.id}`;
}

export function customerName(customer: CalendarCustomer | undefined | null): string {
  if (!customer) return "";
  if (customer.company_name) return customer.company_name;
  return `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
}

export function customerAddress(customer: CalendarCustomer | undefined | null): string {
  if (!customer) return "";
  return [customer.street, [customer.zip, customer.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

export function orderAddress(order: CalendarOrder | undefined | null): string {
  if (!order) return "";
  return [order.address_street, [order.address_zip, order.address_city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}
