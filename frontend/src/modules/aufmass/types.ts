// Formular „Besichtigung / Aufmaß“ – Datentypen (werden auch in App.tsx verwendet)

export type SiteVisitRoomForm = {
  temp_id: number;
  room_name: string;
  length_m: string;
  width_m: string;
  height_m: string;
  notes: string;
  paint_ceiling: boolean;
  manual_wall_area_sqm: string;
  /** Anzahl Anstriche (1–3), fehlt = 1 */
  wall_coats?: number;
  ceiling_coats?: number;
};

export type SiteVisitCustomServiceForm = {
  temp_id: number;
  title: string;
  description: string;
  hours: string;
};

export type SiteVisitWindowForm = {
  temp_id: number;
  room_temp_id: number | null;
  count_items: string;
  width_m: string;
  height_m: string;
  notes: string;
};

export type SiteVisitDoorForm = {
  temp_id: number;
  room_temp_id: number | null;
  count_items: string;
  width_m: string;
  height_m: string;
  frame_included: boolean;
  notes: string;
};

export type SiteVisitRadiatorForm = {
  temp_id: number;
  room_temp_id: number | null;
  count_items: string;
  width_m: string;
  height_m: string;
  radiator_type: string;
  notes: string;
};

export type SiteVisitFormState = {
  customer_id: string;
  title: string;
  object_street: string;
  object_zip: string;
  object_city: string;
  visit_date: string;
  notes: string;
  rooms: SiteVisitRoomForm[];
  windows: SiteVisitWindowForm[];
  doors: SiteVisitDoorForm[];
  radiators: SiteVisitRadiatorForm[];
  custom_services: SiteVisitCustomServiceForm[];
};
