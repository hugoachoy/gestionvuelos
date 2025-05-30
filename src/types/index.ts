
export interface AuthUser {
  id: string;
  email?: string;
  // Agrega otros campos de Supabase User que necesites
}

export interface Pilot {
  id: string;
  first_name: string;
  last_name: string;
  category_ids: string[]; // IDs of PilotCategory
  medical_expiry: string; // Store as ISO string YYYY-MM-DD
  auth_user_id?: string | null; // ID del usuario de Supabase Auth vinculado
  // is_admin?: boolean; // Eliminado según solicitud previa
  created_at?: string; // Timestamps from Supabase
}

export interface PilotCategory {
  id: string;
  name: string;
  created_at?: string;
}

export interface Aircraft {
  id: string;
  name: string; // Registration or common name
  type: 'Tow Plane' | 'Glider';
  created_at?: string;
}

export const FLIGHT_TYPES = [
  { id: 'instruction', name: 'Instrucción' },
  { id: 'local', name: 'Local' },
  { id: 'sport', name: 'Deportivo' },
  { id: 'towage', name: 'Remolque' },
] as const;

export type FlightType = typeof FLIGHT_TYPES[number];
export type FlightTypeName = FlightType['name'];
export type FlightTypeId = FlightType['id'];

export interface ScheduleEntry {
  id: string;
  date: string; // Store as ISO string YYYY-MM-DD
  start_time: string; // e.g., "09:00"
  pilot_id: string;
  pilot_category_id: string; // Category chosen for this specific flight/slot
  is_tow_pilot_available?: boolean; // Relevant if pilot_category_id corresponds to "Remolcador"
  flight_type_id: FlightTypeId;
  aircraft_id?: string | null; // Optional: which specific aircraft, can be null
  auth_user_id?: string | null; // ID of the user who created this entry
  created_at?: string;
}

// Type for daily observations, matching the Supabase table structure.
export interface DailyObservation {
  date: string; // Primary Key: YYYY-MM-DD
  observation_text: string | null;
  created_at?: string;
  updated_at?: string;
}
