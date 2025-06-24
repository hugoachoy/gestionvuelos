
export interface AuthUser {
  id: string;
  email?: string;
  is_admin?: boolean; // Añadido para almacenar el estado de admin
  first_name?: string; // Añadido para el nombre del piloto
  last_name?: string;  // Añadido para el apellido del piloto
}

export interface Pilot {
  id: string;
  first_name: string;
  last_name: string;
  category_ids: string[]; // IDs of PilotCategory
  medical_expiry: string; // Store as ISO string YYYY-MM-DD
  auth_user_id?: string | null; // ID del usuario de Supabase Auth vinculado
  is_admin?: boolean; // Re-añadido para el estado de administrador
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
  type: 'Tow Plane' | 'Glider' | 'Avión';
  created_at?: string;
}

export const FLIGHT_TYPES = [
  { id: 'instruction_taken', name: 'Instrucción (Recibida)' },
  { id: 'instruction_given', name: 'Instrucción (Impartida)' },
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

export interface DailyObservation {
  date: string; // Primary Key: YYYY-MM-DD
  observation_text: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DailyNews {
  id: string;
  date: string; // YYYY-MM-DD
  news_text: string;
  pilot_id: string; // ID of the auth user who added it
  pilot_full_name: string; // Full name of the pilot for display
  created_at?: string;
}

// --- Libro de Vuelo Types ---
export type LogbookEntryType = 'glider' | 'engine';

export interface BaseCompletedFlight {
  id: string;
  schedule_entry_id?: string | null; // Link to the planned entry, if any
  date: string; // YYYY-MM-DD
  pilot_id: string; // Pilot in command
  instructor_id?: string | null; // Instructor, if applicable
  departure_time: string; // HH:MM
  arrival_time: string; // HH:MM
  flight_duration_decimal: number; // e.g., 1.5 for 1h 30m
  notes?: string | null;
  created_at?: string;
  auth_user_id?: string | null; // User who created this log entry
}

export const GLIDER_FLIGHT_PURPOSES = [
  'entrenamiento', 'readaptacion', 'deportivo', 'instruction_taken', 'instruction_given'
] as const;
export type GliderFlightPurpose = typeof GLIDER_FLIGHT_PURPOSES[number];

export const ENGINE_FLIGHT_PURPOSES = [
  'entrenamiento', 'readaptacion', 'towage', 'instruction_taken', 'instruction_given', 'local', 'trip'
] as const;
export type EngineFlightPurpose = typeof ENGINE_FLIGHT_PURPOSES[number];

export type AnyFlightPurpose = GliderFlightPurpose | EngineFlightPurpose;

export const FLIGHT_PURPOSE_DISPLAY_MAP: Record<string, string> = {
  // Common
  'entrenamiento': 'Entrenamiento',
  'readaptacion': 'Readaptación',
  'local': 'Local',
  'trip': 'Viaje',
  'deportivo': 'Deportivo',
  'towage': 'Remolque planeador',
  // Unified
  'instruction_taken': 'Instrucción (Recibida)',
  'instruction_given': 'Instrucción (Impartida)',
};

export interface CompletedGliderFlight extends BaseCompletedFlight {
  logbook_type: 'glider';
  tow_pilot_id?: string | null; // Tow pilot, if applicable
  glider_aircraft_id: string;
  tow_aircraft_id?: string | null; // Tow plane used, if applicable
  flight_purpose: GliderFlightPurpose;
}

export interface CompletedEngineFlight extends BaseCompletedFlight {
  logbook_type: 'engine';
  engine_aircraft_id: string;
  flight_purpose: EngineFlightPurpose;
  billable_minutes?: number | null; // Typically for engine flights
  route_from_to?: string | null;
  landings_count?: number | null;
  tows_count?: number | null; // If this engine flight was a tow
  oil_added_liters?: number | null;
  fuel_added_liters?: number | null;
}

export type CompletedFlight = CompletedGliderFlight | CompletedEngineFlight;
